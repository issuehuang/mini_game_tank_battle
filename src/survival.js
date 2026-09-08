// ---------- 無限生存模式：波次 / 技能點 / 方位裝甲 / 武器與飛彈升級（見 spec.md §6.2） ----------
import { CONFIG } from './config.js';

// 測試階段：加快過波跟配點節奏，方便測試配點面板；之後要恢復正式數值（見 CONFIG.survival）就改回 false
const TESTING_FAST_WAVES = true;

export const SURVIVAL = {
  wave: 1,
  killsThisWave: 0,
  killsPerWave: TESTING_FAST_WAVES ? 2 : CONFIG.survival.killsPerWave,
  points: 0,
  upgrades: { front: 0, back: 0, left: 0, right: 0, weapon: 0, missile: 0 },
};

export function resetSurvival() {
  SURVIVAL.wave = 1;
  SURVIVAL.killsThisWave = 0;
  SURVIVAL.points = 0;
  SURVIVAL.upgrades = { front: 0, back: 0, left: 0, right: 0, weapon: 0, missile: 0 };
}

// 敵人強度隨波次遞增（數量固定每波 CONFIG.survival.killsPerWave 隻，不隨波次增加）
export function enemyStatsForWave(wave) {
  return {
    hp: CONFIG.survival.enemyHpBase * (1 + CONFIG.survival.enemyHpGrowth * (wave - 1)),
    dmg: CONFIG.survival.enemyDmgBase * (1 + CONFIG.survival.enemyDmgGrowth * (wave - 1)),
  };
}

// 每殺一隻呼叫一次；回傳這波是否剛好殺滿、以及是否該波觸發配點（每 CONFIG.survival.waveInterval 波一次）
export function registerKill() {
  SURVIVAL.killsThisWave++;
  if (SURVIVAL.killsThisWave >= SURVIVAL.killsPerWave) {
    const completedWave = SURVIVAL.wave;
    SURVIVAL.wave++;
    SURVIVAL.killsThisWave = 0;
    const grantPoints = TESTING_FAST_WAVES ? true : completedWave % CONFIG.survival.waveInterval === 0;
    if (grantPoints) SURVIVAL.points += CONFIG.survival.pointsPerGrant;
    return { waveCleared: true, grantPoints, completedWave };
  }
  return { waveCleared: false, grantPoints: false };
}

// 方位裝甲：每點 CONFIG.survival.armorPerPoint 減傷，上限 CONFIG.survival.armorCap
export function armorReduction(quadrant) {
  const pts = SURVIVAL.upgrades[quadrant] || 0;
  return Math.min(CONFIG.survival.armorCap, pts * CONFIG.survival.armorPerPoint);
}

// 依子彈來源方向（已轉換到玩家局部座標系）判定命中的是前/後/左/右哪個象限
export function hitQuadrant(localFrom) {
  if (Math.abs(localFrom.x) > Math.abs(localFrom.z)) {
    return localFrom.x > 0 ? 'right' : 'left';
  }
  return localFrom.z > 0 ? 'back' : 'front'; // 車頭朝 -z，所以 z>0 是後方
}

// 主武器火力：每點冷卻 -3%（下限見 CONFIG）、傷害 +8%
export function weaponCooldown() {
  const c = CONFIG.survival;
  return Math.max(c.weaponCooldownFloor, c.weaponCooldownBase * Math.pow(c.weaponCooldownDecay, SURVIVAL.upgrades.weapon));
}
export function weaponDamage() {
  const c = CONFIG.survival;
  return c.weaponDamageBase * Math.pow(c.weaponDamageGrowth, SURVIVAL.upgrades.weapon);
}

// 特殊武器（飛彈）：每點冷卻 -5%（下限見 CONFIG）、飛行速度 +8%
export function missileCooldown() {
  const c = CONFIG.survival;
  return Math.max(c.missileCooldownFloor, c.missileCooldownBase * Math.pow(c.missileCooldownDecay, SURVIVAL.upgrades.missile));
}
export function missileSpeedMult() { return Math.pow(CONFIG.survival.missileSpeedGrowth, SURVIVAL.upgrades.missile); }

// ---------- 配點畫面 ----------
const CATEGORIES = [
  { key: 'front', label: '🛡 前方裝甲' },
  { key: 'back', label: '🛡 後方裝甲' },
  { key: 'left', label: '🛡 左方裝甲' },
  { key: 'right', label: '🛡 右方裝甲' },
  { key: 'weapon', label: '⚔ 主武器火力' },
  { key: 'missile', label: '🚀 特殊武器火力' },
];

const skillMenuEl = document.getElementById('skillMenu');
const skillMenuWaveEl = document.getElementById('skillMenuWave');
const skillRowsEl = document.getElementById('skillRows');
const pointsLeftEl = document.getElementById('pointsLeft');
const skillConfirmBtn = document.getElementById('skillConfirm');

function renderSkillRows() {
  skillRowsEl.innerHTML = CATEGORIES.map(cat => `
    <div class="skillRow">
      <span>${cat.label}</span>
      <span class="ctrl">
        <button type="button" data-cat="${cat.key}" data-delta="-1">-</button>
        <span class="val">${SURVIVAL.upgrades[cat.key]}</span>
        <button type="button" data-cat="${cat.key}" data-delta="1">+</button>
      </span>
    </div>
  `).join('');
  pointsLeftEl.textContent = SURVIVAL.points;
}

skillRowsEl.addEventListener('click', e => {
  const btn = e.target.closest('button[data-cat]');
  if (!btn) return;
  const cat = btn.dataset.cat;
  const delta = parseInt(btn.dataset.delta, 10);
  if (delta > 0) {
    if (SURVIVAL.points <= 0) return;
    SURVIVAL.upgrades[cat]++;
    SURVIVAL.points--;
  } else {
    if (SURVIVAL.upgrades[cat] <= 0) return;
    SURVIVAL.upgrades[cat]--;
    SURVIVAL.points++;
  }
  renderSkillRows();
});

// 顯示配點畫面（完全暫停遊戲，呼叫端負責在 onConfirm 裡恢復）
export function showSkillMenu(completedWave, onConfirm) {
  skillMenuWaveEl.textContent = `WAVE ${completedWave} CLEAR`;
  renderSkillRows();
  skillMenuEl.style.display = 'flex';
  const handler = () => {
    skillMenuEl.style.display = 'none';
    skillConfirmBtn.removeEventListener('click', handler);
    onConfirm();
  };
  skillConfirmBtn.addEventListener('click', handler);
}
