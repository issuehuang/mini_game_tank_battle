import * as THREE from 'three';
import { CONFIG } from './config.js';
import { makeTank } from './tank.js';
import {
  ensureAudio, setMuted,
  playShoot, playImpact, playHit, playExplosion, playGameOver, playPickup, playMissileLaunch,
} from './audio.js';
import { showModeMenu } from './menu.js';
import {
  SURVIVAL, resetSurvival, enemyStatsForWave, registerKill, armorReduction, hitQuadrant,
  weaponCooldown, weaponDamage, missileCooldown, missileSpeedMult, showSkillMenu,
} from './survival.js';

// ---------- 遊戲模式 ----------
let gameMode = 'endless'; // 'endless' | 'survival'，由主選單決定
let gameStarted = false; // 選好模式前，場景照常渲染但玩法邏輯不跑
let missileAbilityCooldown = 0; // 無限生存模式：飛彈變成主動技能後的冷卻計時

// ---------- 基本場景 ----------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d16);
const arenaFog = new THREE.Fog(0x1a1d16, 55, 95);
scene.fog = arenaFog;
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 200);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xdfe8c8, 0x2a2d20, 0.9));
const sun = new THREE.DirectionalLight(0xfff2d0, 1.4);
sun.position.set(20, 35, 12);
sun.castShadow = true;
sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

// ---------- 地面與圍牆 ----------
const ARENA = CONFIG.arena.size; // 半徑（正方形半邊長）
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(ARENA * 2 + 4, ARENA * 2 + 4),
  new THREE.MeshStandardMaterial({ color: 0x3a4030, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
scene.add(new THREE.GridHelper(ARENA * 2 + 4, 36, 0x4a5240, 0x2f3528));

const walls = []; // {mesh, min:{x,z}, max:{x,z}}
const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: .9 });
function addWall(x, z, w, d, h = 2.2) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
  m.position.set(x, h / 2, z);
  m.castShadow = m.receiveShadow = true;
  scene.add(m);
  walls.push({ mesh: m, min: { x: x - w / 2, z: z - d / 2 }, max: { x: x + w / 2, z: z + d / 2 } });
}
// 外圍
addWall(0, -ARENA - 1, ARENA * 2 + 4, 2, 3);
addWall(0, ARENA + 1, ARENA * 2 + 4, 2, 3);
addWall(-ARENA - 1, 0, 2, ARENA * 2 + 4, 3);
addWall(ARENA + 1, 0, 2, ARENA * 2 + 4, 3);
// 內部掩體
const layout = [
  [-14, -14, 8, 3], [14, -14, 8, 3], [-14, 14, 8, 3], [14, 14, 8, 3],
  [0, -8, 3, 8], [0, 8, 3, 8], [-24, 0, 3, 10], [24, 0, 3, 10],
];
layout.forEach(([x, z, w, d]) => addWall(x, z, w, d));

// ---------- 玩家 ----------
const player = {
  mesh: makeTank(0x7fbf5f),
  hp: CONFIG.player.maxHp, maxHp: CONFIG.player.maxHp, speed: CONFIG.player.speed, radius: CONFIG.player.radius,
  alive: true, cooldown: 0,
  shieldTimer: 0, rapidFireTimer: 0,
};
scene.add(player.mesh);

// 護盾特效（套在玩家坦克上，啟用時才顯示）
const shieldVisual = new THREE.Mesh(
  new THREE.SphereGeometry(1.9, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0x5ec8f0, transparent: true, opacity: 0.28, wireframe: true })
);
shieldVisual.position.y = 0.9;
shieldVisual.visible = false;
player.mesh.add(shieldVisual);

// 地面準星（顯示砲管實際指向的位置）
const reticle = new THREE.Mesh(
  new THREE.RingGeometry(0.35, 0.5, 24),
  new THREE.MeshBasicMaterial({ color: 0xf5f0c0, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
);
reticle.rotation.x = -Math.PI / 2;
scene.add(reticle);

// ---------- 敵人 ----------
const enemies = [];
const SPAWNS = [[-30, -30], [30, -30], [-30, 30], [30, 30]];
function spawnEnemy() {
  const [x, z] = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
  const stats = gameMode === 'survival' ? enemyStatsForWave(SURVIVAL.wave) : { hp: CONFIG.enemy.hp, dmg: CONFIG.enemy.dmg };
  const e = {
    mesh: makeTank(0xc75c4a),
    hp: stats.hp, dmg: stats.dmg, speed: CONFIG.enemy.speed, radius: CONFIG.enemy.radius,
    shootTimer: CONFIG.enemy.shootTimerInitMin + Math.random() * CONFIG.enemy.shootTimerInitRange,
    strafeDir: Math.random() < 0.5 ? 1 : -1,
  };
  e.mesh.position.set(x, 0, z);
  scene.add(e.mesh);
  enemies.push(e);
}

// ---------- 道具（護盾 / 火力強化 / 全畫面鎖定飛彈） ----------
const powerups = [];
const shieldPickupGeo = new THREE.IcosahedronGeometry(0.5, 0);
const shieldPickupMat = new THREE.MeshStandardMaterial({ color: 0x5ec8f0, emissive: 0x0e3a4a, roughness: .3 });
const boostPickupGeo = new THREE.OctahedronGeometry(0.55, 0);
const boostPickupMat = new THREE.MeshStandardMaterial({ color: 0xffcf4a, emissive: 0x5c3f0a, roughness: .3 });
const missilePickupGeo = new THREE.TetrahedronGeometry(0.6, 0);
const missilePickupMat = new THREE.MeshStandardMaterial({ color: 0xff3b3b, emissive: 0x5c0e0e, roughness: .3 });
const POWERUP_KINDS = [
  { type: 'shield', geo: shieldPickupGeo, mat: shieldPickupMat, weight: CONFIG.powerup.weights.shield },
  { type: 'rapid', geo: boostPickupGeo, mat: boostPickupMat, weight: CONFIG.powerup.weights.rapid },
  { type: 'missile', geo: missilePickupGeo, mat: missilePickupMat, weight: CONFIG.powerup.weights.missile },
];

// 測試階段：道具全部固定生成飛彈，方便測試全畫面鎖定飛彈效果；之後要恢復隨機三種就改回 null
const TESTING_ONLY_POWERUP = 'missile';

function spawnPowerup() {
  // 無限生存模式：飛彈是主動技能（見 launchMissileBarrage 的 Q 鍵觸發），不再隨機掉落
  const available = gameMode === 'survival'
    ? POWERUP_KINDS.filter(k => k.type !== 'missile')
    : POWERUP_KINDS;
  let kind;
  if (TESTING_ONLY_POWERUP && gameMode !== 'survival') {
    kind = POWERUP_KINDS.find(k => k.type === TESTING_ONLY_POWERUP);
  } else {
    const total = available.reduce((s, k) => s + k.weight, 0);
    let r = Math.random() * total;
    kind = available[0];
    for (const k of available) { if (r < k.weight) { kind = k; break; } r -= k.weight; }
  }
  let x, z, tries = 0;
  do {
    x = (Math.random() * 2 - 1) * (ARENA - 4);
    z = (Math.random() * 2 - 1) * (ARENA - 4);
    tries++;
  } while (
    walls.some(w => x > w.min.x - 2 && x < w.max.x + 2 && z > w.min.z - 2 && z < w.max.z + 2) && tries < CONFIG.powerup.placementTries
  );
  const mesh = new THREE.Mesh(kind.geo, kind.mat);
  mesh.position.set(x, 1.1, z);
  mesh.castShadow = true;
  scene.add(mesh);
  powerups.push({ mesh, type: kind.type, spin: Math.random() * Math.PI });
}
function collectPowerup(type) {
  if (type === 'shield') { playPickup(); player.shieldTimer = CONFIG.player.shieldDuration; }
  else if (type === 'rapid') { playPickup(); player.rapidFireTimer = CONFIG.player.rapidFireDuration; }
  else if (type === 'missile') { launchMissileBarrage(); }
}

// ---------- 全畫面自動鎖定飛彈 ----------
const missiles = [];
function makeMissileMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.9, 8),
    new THREE.MeshStandardMaterial({ color: 0xe8e6d8, emissive: 0x332200, roughness: .4 })
  );
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: 0xff5533, emissive: 0x661100, roughness: .4 })
  );
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -0.62;
  nose.castShadow = true;
  g.add(body, nose);
  return g;
}
const lockRingGeo = new THREE.RingGeometry(0.5, 0.65, 20);
const lockRingMat = new THREE.MeshBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 0.85, side: THREE.DoubleSide });

let missileCamTimer = 0;

function launchMissileBarrage() {
  if (enemies.length === 0) return;
  playMissileLaunch();
  missileCamTimer = CONFIG.missile.camDuration;
  const targets = [...enemies]; // 鎖定當下場上所有敵人，稍後逐一發射（若中途被打死就跳過）
  targets.forEach((e, i) => {
    setTimeout(() => {
      if (!enemies.includes(e)) return;
      const launchPos = player.mesh.position.clone().setY(CONFIG.missile.launchHeight); // 從玩家戰車發射
      const mesh = makeMissileMesh();
      mesh.position.copy(launchPos);
      mesh.castShadow = true;
      scene.add(mesh);
      const lockMark = new THREE.Mesh(lockRingGeo, lockRingMat);
      lockMark.rotation.x = -Math.PI / 2;
      lockMark.position.set(e.mesh.position.x, 0.08, e.mesh.position.z);
      scene.add(lockMark);
      const initDir = e.mesh.position.clone().setY(CONFIG.missile.launchHeight).sub(launchPos).normalize();
      initDir.y = Math.min(1, initDir.y + 0.6); // 先拉高一點再壓下來，比較有飛彈感
      initDir.normalize();
      const speed = gameMode === 'survival' ? CONFIG.missile.speed * missileSpeedMult() : CONFIG.missile.speed;
      missiles.push({ mesh, target: e, dir: initDir, speed, ttl: CONFIG.missile.ttl, lockMark });
    }, i * CONFIG.missile.launchStaggerMs);
  });
}

// ---------- 砲彈 ----------
const bullets = [];
const bulletGeo = new THREE.SphereGeometry(0.22, 8, 8);
const pBulletMat = new THREE.MeshBasicMaterial({ color: 0xf5f0c0 });
const pBulletBoostMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
const eBulletMat = new THREE.MeshBasicMaterial({ color: 0xff8866 });
function shoot(fromMesh, turret, isPlayer, enemyDmg) {
  playShoot(isPlayer);
  const boosted = isPlayer && player.rapidFireTimer > 0;
  const mat = isPlayer ? (boosted ? pBulletBoostMat : pBulletMat) : eBulletMat;
  let dmg;
  if (isPlayer) {
    dmg = gameMode === 'survival' ? weaponDamage() * (boosted ? 2 : 1) : (boosted ? CONFIG.player.dmgBoosted : CONFIG.player.dmg);
  } else {
    dmg = enemyDmg != null ? enemyDmg : CONFIG.enemy.dmg;
  }
  const m = new THREE.Mesh(bulletGeo, mat);
  const dir = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(turret.getWorldQuaternion(new THREE.Quaternion()));
  dir.y = 0; dir.normalize();
  const muzzle = fromMesh.position.clone().add(dir.clone().multiplyScalar(CONFIG.bullet.muzzleOffset)).setY(CONFIG.bullet.muzzleHeight);
  m.position.copy(muzzle);
  scene.add(m);
  bullets.push({ mesh: m, dir, speed: CONFIG.bullet.speed, ttl: CONFIG.bullet.ttl, isPlayer, dmg });
}

// ---------- 爆炸粒子 ----------
const particles = [];
function explode(pos, color = 0xffaa55, count = 18) {
  for (let i = 0; i < count; i++) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.25, 0.25),
      new THREE.MeshBasicMaterial({ color, transparent: true })
    );
    p.position.copy(pos);
    const v = new THREE.Vector3((Math.random() - .5) * 10, Math.random() * 8, (Math.random() - .5) * 10);
    particles.push({ mesh: p, vel: v, life: CONFIG.particle.life });
    scene.add(p);
  }
}

// ---------- 輸入 ----------
const keys = {};
addEventListener('keydown', e => {
  ensureAudio();
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyQ' && gameMode === 'survival' && gameStarted && player.alive && missileAbilityCooldown <= 0) {
    launchMissileBarrage();
    missileAbilityCooldown = missileCooldown();
  }
});
addEventListener('keyup', e => keys[e.code] = false);
let mouseNDC = new THREE.Vector2();
let mouseDown = false;
addEventListener('mousemove', e => {
  mouseNDC.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});
addEventListener('mousedown', () => { ensureAudio(); mouseDown = true; });
addEventListener('mouseup', () => mouseDown = false);

// ---------- 碰撞：圓 vs 牆(AABB) ----------
function collideWalls(pos, radius) {
  for (const w of walls) {
    const cx = Math.max(w.min.x, Math.min(pos.x, w.max.x));
    const cz = Math.max(w.min.z, Math.min(pos.z, w.max.z));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      const d = Math.sqrt(d2) || 0.001;
      pos.x += (dx / d) * (radius - d);
      pos.z += (dz / d) * (radius - d);
    }
  }
}
function bulletHitsWall(pos) {
  return walls.some(w =>
    pos.x > w.min.x && pos.x < w.max.x && pos.z > w.min.z && pos.z < w.max.z && pos.y < w.mesh.geometry.parameters.height);
}

// 無限生存模式：每殺一隻敵人呼叫，殺滿一波、且該波是 5 的倍數時暫停遊戲跳出配點畫面
function onEnemyKilled() {
  if (gameMode !== 'survival') return;
  const result = registerKill();
  if (result.grantPoints) {
    gameStarted = false;
    showSkillMenu(result.completedWave, () => { gameStarted = true; });
  }
}

// ---------- HUD / 狀態 ----------
let score = 0;
const scoreEl = document.getElementById('score');
const hpEl = document.getElementById('hpfill');
const buffsEl = document.getElementById('buffs');
const waveInfoEl = document.getElementById('waveInfo');
const overlay = document.getElementById('overlay');
function updateHUD() {
  scoreEl.textContent = 'SCORE ' + score;
  const pct = Math.max(0, player.hp / player.maxHp * 100);
  hpEl.style.width = pct + '%';
  hpEl.style.background = pct > 50 ? '#7fbf5f' : pct > 25 ? '#d9a441' : '#c75c4a';
  let buffHtml = '';
  if (player.shieldTimer > 0) buffHtml += `<div style="color:#5ec8f0">🛡 護盾 ${player.shieldTimer.toFixed(1)}s</div>`;
  if (player.rapidFireTimer > 0) buffHtml += `<div style="color:#ffcf4a">⚡ 火力強化 ${player.rapidFireTimer.toFixed(1)}s</div>`;
  if (gameMode === 'survival') {
    buffHtml += missileAbilityCooldown > 0
      ? `<div style="color:#ff8866">🚀 飛彈冷卻 ${missileAbilityCooldown.toFixed(1)}s</div>`
      : `<div style="color:#ff5533">🚀 飛彈就緒（按 Q）</div>`;
  }
  buffsEl.innerHTML = buffHtml;
  waveInfoEl.style.display = gameMode === 'survival' ? '' : 'none';
  if (gameMode === 'survival') waveInfoEl.textContent = `WAVE ${SURVIVAL.wave}（${SURVIVAL.killsThisWave}/${SURVIVAL.killsPerWave}）`;
}
document.getElementById('restart').onclick = () => location.reload();
let muted = false;
const muteBtn = document.getElementById('muteBtn');
muteBtn.onclick = () => {
  ensureAudio();
  muted = !muted;
  setMuted(muted);
  muteBtn.textContent = muted ? '🔇' : '🔊';
};
function gameOver() {
  player.alive = false;
  explode(player.mesh.position.clone().setY(1), 0x7fbf5f, 40);
  playExplosion();
  playGameOver();
  player.mesh.visible = false;
  const waveSuffix = gameMode === 'survival' ? ` — WAVE ${SURVIVAL.wave}` : '';
  document.getElementById('finalScore').textContent = 'FINAL SCORE ' + score + waveSuffix;
  overlay.style.display = 'flex';
}

// ---------- 主迴圈 ----------
const raycaster = new THREE.Raycaster();
// 瞄準平面設在砲管高度 (y=1.5)，這樣游標指到哪、砲管在畫面上就對到哪（沒有視差）
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.5);
const clock = new THREE.Clock();
const camLookAt = new THREE.Vector3();
let spawnTimer = 0;
let powerupTimer = TESTING_ONLY_POWERUP ? 1 : CONFIG.powerup.initialTimer;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (gameStarted) {
  if (missileAbilityCooldown > 0) missileAbilityCooldown = Math.max(0, missileAbilityCooldown - dt);
  if (player.shieldTimer > 0) player.shieldTimer = Math.max(0, player.shieldTimer - dt);
  if (player.rapidFireTimer > 0) player.rapidFireTimer = Math.max(0, player.rapidFireTimer - dt);
  shieldVisual.visible = player.shieldTimer > 0;
  if (shieldVisual.visible) shieldVisual.rotation.y += dt * 1.5;

  if (player.alive) {
    // 移動（坦克式：AD 轉向、WS 前後）
    if (keys['KeyA']) player.mesh.rotation.y += CONFIG.player.turnRate * dt;
    if (keys['KeyD']) player.mesh.rotation.y -= CONFIG.player.turnRate * dt;
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(player.mesh.rotation);
    if (keys['KeyW']) player.mesh.position.addScaledVector(forward, player.speed * dt);
    if (keys['KeyS']) player.mesh.position.addScaledVector(forward, -player.speed * CONFIG.player.reverseSpeedMult * dt);
    collideWalls(player.mesh.position, player.radius);

    // 砲塔瞄準滑鼠
    raycaster.setFromCamera(mouseNDC, camera);
    const aim = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(aimPlane, aim)) {
      const t = player.mesh.userData.turret;
      const local = player.mesh.worldToLocal(aim.clone());
      t.rotation.y = Math.atan2(-local.x, -local.z);
      reticle.position.set(aim.x, 0.06, aim.z);
    }

    // 開砲（火力強化時射速加快；無限生存模式套用主武器技能點加成）
    player.cooldown -= dt;
    if ((mouseDown || keys['Space']) && player.cooldown <= 0) {
      shoot(player.mesh, player.mesh.userData.turret, true);
      const boosted = player.rapidFireTimer > 0;
      if (gameMode === 'survival') {
        player.cooldown = boosted ? Math.min(weaponCooldown(), CONFIG.player.cooldownBoosted) : weaponCooldown();
      } else {
        player.cooldown = boosted ? CONFIG.player.cooldownBoosted : CONFIG.player.cooldown;
      }
    }

    // 道具拾取
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.spin += dt;
      p.mesh.rotation.y += 2 * dt;
      p.mesh.position.y = 1.1 + Math.sin(p.spin * 2) * 0.15;
      if (player.mesh.position.distanceTo(p.mesh.position.clone().setY(0)) < player.radius + CONFIG.powerup.pickupRadius) {
        collectPowerup(p.type);
        scene.remove(p.mesh);
        powerups.splice(i, 1);
      }
    }
    powerupTimer -= dt;
    if (powerupTimer <= 0 && powerups.length < 2) {
      spawnPowerup();
      powerupTimer = TESTING_ONLY_POWERUP ? (3 + Math.random() * 3) : (CONFIG.powerup.respawnMin + Math.random() * CONFIG.powerup.respawnRange);
    }
  }

  // 敵人 AI
  spawnTimer -= dt;
  if (spawnTimer <= 0 && enemies.length < CONFIG.enemy.maxCount && player.alive) {
    spawnEnemy();
    spawnTimer = CONFIG.enemy.spawnInterval;
  }
  const ENGAGE_DIST = CONFIG.enemy.engageDist, RETREAT_DIST = CONFIG.enemy.retreatDist;
  for (const e of enemies) {
    const toPlayer = player.mesh.position.clone().sub(e.mesh.position);
    const dist = toPlayer.length();

    // 砲塔獨立瞄準玩家，不受車身朝向牽制，反應快
    const turret = e.mesh.userData.turret;
    const localAim = e.mesh.worldToLocal(player.mesh.position.clone());
    const turretTarget = Math.atan2(-localAim.x, -localAim.z);
    let turretDa = turretTarget - turret.rotation.y;
    turretDa = Math.atan2(Math.sin(turretDa), Math.cos(turretDa));
    turret.rotation.y += THREE.MathUtils.clamp(turretDa, -CONFIG.enemy.turretTurnRate * dt, CONFIG.enemy.turretTurnRate * dt);

    // 車身朝向：依距離決定「衝過去 / 繞圈 / 掉頭拉開」，履帶車不會平移，只會轉向再前進
    let hullTarget;
    if (dist > ENGAGE_DIST) {
      hullTarget = Math.atan2(-toPlayer.x, -toPlayer.z); // 朝向玩家逼近
    } else if (dist < RETREAT_DIST) {
      hullTarget = Math.atan2(toPlayer.x, toPlayer.z); // 背向玩家，拉開距離
    } else {
      const tangent = new THREE.Vector3(toPlayer.z, 0, -toPlayer.x).multiplyScalar(e.strafeDir);
      hullTarget = Math.atan2(-tangent.x, -tangent.z); // 切線方向，繞著玩家轉圈
    }
    let hullDa = hullTarget - e.mesh.rotation.y;
    hullDa = Math.atan2(Math.sin(hullDa), Math.cos(hullDa));
    e.mesh.rotation.y += THREE.MathUtils.clamp(hullDa, -CONFIG.enemy.hullTurnRate * dt, CONFIG.enemy.hullTurnRate * dt);

    if (Math.abs(hullDa) < CONFIG.enemy.hullMoveThreshold) {
      const f = new THREE.Vector3(0, 0, -1).applyEuler(e.mesh.rotation);
      e.mesh.position.addScaledVector(f, e.speed * dt);
    }
    collideWalls(e.mesh.position, e.radius);

    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && Math.abs(turretDa) < CONFIG.enemy.shootAimThreshold && player.alive) {
      shoot(e.mesh, turret, false, e.dmg);
      e.shootTimer = CONFIG.enemy.shootTimerMin + Math.random() * CONFIG.enemy.shootTimerRange;
    }
  }

  // 自動鎖定飛彈
  for (let i = missiles.length - 1; i >= 0; i--) {
    const ms = missiles[i];
    ms.ttl -= dt;
    const targetAlive = enemies.includes(ms.target) && ms.target.hp > 0;
    const targetPos = targetAlive
      ? ms.target.mesh.position.clone().setY(CONFIG.bullet.muzzleHeight)
      : ms.mesh.position.clone().addScaledVector(ms.dir, 5);
    const toTarget = targetPos.clone().sub(ms.mesh.position).normalize();
    ms.dir.lerp(toTarget, Math.min(1, CONFIG.missile.homingLerpRate * dt)).normalize();
    ms.mesh.position.addScaledVector(ms.dir, ms.speed * dt);
    ms.mesh.lookAt(ms.mesh.position.clone().add(ms.dir));
    if (ms.lockMark && targetAlive) ms.lockMark.position.set(ms.target.mesh.position.x, 0.08, ms.target.mesh.position.z);
    if (ms.lockMark) ms.lockMark.rotation.z += dt * 4;
    if (Math.random() < 25 * dt) explode(ms.mesh.position, 0xccccc0, 1);

    const hit = targetAlive && targetPos.distanceTo(ms.mesh.position) < CONFIG.missile.hitRadius;
    if (hit) {
      explode(ms.mesh.position, 0xffaa55, 20);
      playExplosion();
      ms.target.hp = 0;
      explode(ms.target.mesh.position.clone().setY(1), 0xc75c4a, 30);
      scene.remove(ms.target.mesh);
      const idx = enemies.indexOf(ms.target);
      if (idx >= 0) { enemies.splice(idx, 1); score += 100; onEnemyKilled(); }
    }
    if (hit || ms.ttl <= 0 || ms.mesh.position.y < 0.3) {
      scene.remove(ms.mesh);
      if (ms.lockMark) scene.remove(ms.lockMark);
      missiles.splice(i, 1);
    }
  }

  // 砲彈
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.mesh.position.addScaledVector(b.dir, b.speed * dt);
    b.ttl -= dt;
    let dead = b.ttl <= 0 || bulletHitsWall(b.mesh.position);
    if (dead && b.ttl > 0) { explode(b.mesh.position, 0xccbb88, 6); playImpact(); }

    if (!dead && b.isPlayer) {
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (b.mesh.position.distanceTo(e.mesh.position.clone().setY(CONFIG.bullet.muzzleHeight)) < e.radius) {
          e.hp -= b.dmg; dead = true;
          explode(b.mesh.position, 0xffaa55, 8);
          playHit();
          if (e.hp <= 0) {
            explode(e.mesh.position.clone().setY(1), 0xc75c4a, 30);
            playExplosion();
            scene.remove(e.mesh);
            enemies.splice(j, 1);
            score += 100;
            onEnemyKilled();
          }
          break;
        }
      }
    } else if (!dead && !b.isPlayer && player.alive) {
      if (b.mesh.position.distanceTo(player.mesh.position.clone().setY(CONFIG.bullet.muzzleHeight)) < player.radius) {
        dead = true;
        explode(b.mesh.position, 0xff6644, 8);
        if (player.shieldTimer > 0) {
          playImpact();
        } else {
          let dmg = b.dmg;
          if (gameMode === 'survival') {
            const worldFrom = b.dir.clone().negate(); // 子彈是從哪個方向飛來的
            const localFrom = player.mesh.worldToLocal(player.mesh.position.clone().add(worldFrom));
            dmg *= 1 - armorReduction(hitQuadrant(localFrom));
          }
          player.hp -= dmg;
          playHit();
          if (player.hp <= 0) gameOver();
        }
      }
    }
    if (dead) { scene.remove(b.mesh); bullets.splice(i, 1); }
  }

  // 粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.vel.y -= CONFIG.particle.gravity * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.material.opacity = Math.max(0, p.life / CONFIG.particle.life);
    if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); }
  }
  } // if (gameStarted)

  // 攝影機跟隨：平常貼身跟拍，飛彈齊射期間平滑拉遠看全景，打完再平滑復原
  if (missileCamTimer > 0) missileCamTimer = Math.max(0, missileCamTimer - dt);
  const wideView = missileCamTimer > 0;
  scene.fog = wideView ? null : arenaFog; // 拉遠後距離會超過霧效 far=95，不關掉地圖會被霧蓋成全黑
  const camTarget = wideView
    ? new THREE.Vector3(CONFIG.camera.widePos.x, CONFIG.camera.widePos.y, CONFIG.camera.widePos.z)
    : player.mesh.position.clone().add(new THREE.Vector3(CONFIG.camera.followOffset.x, CONFIG.camera.followOffset.y, CONFIG.camera.followOffset.z));
  const lookTarget = wideView ? new THREE.Vector3(0, 0, 0) : player.mesh.position.clone().setY(0);
  const camLerp = wideView ? CONFIG.camera.wideLerp : CONFIG.camera.followLerp;
  camera.position.lerp(camTarget, camLerp);
  camLookAt.lerp(lookTarget, camLerp);
  camera.lookAt(camLookAt);

  updateHUD();
  renderer.render(scene, camera);
}

const helpEl = document.getElementById('help');
showModeMenu(mode => {
  ensureAudio();
  gameMode = mode;
  if (gameMode === 'survival') {
    resetSurvival();
    helpEl.textContent += ' · Q 發射飛彈';
  }
  gameStarted = true;
});
tick();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
