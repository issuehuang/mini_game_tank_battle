// ---------- 玩法可調參數集中管理 ----------
// 只收「玩法性」數值：速度/傷害/冷卻/計時器/鏡頭距離/生成間隔等。
// 不收：坦克/飛彈等模型的幾何造型尺寸（見 tank.js、game.js 裡的 makeMissileMesh）、
// 顏色、音效合成器參數與背景音樂（見 audio.js）——這些是外觀/音色，不是玩法旋鈕。見 spec.md §7。
export const CONFIG = {
  arena: {
    size: 36, // 半徑（正方形半邊長）
  },

  player: {
    maxHp: 100,
    speed: 9,
    reverseSpeedMult: 0.6,
    radius: 1.7,
    turnRate: 2.6,
    cooldown: 0.35,
    cooldownBoosted: 0.12,
    dmg: 10,
    dmgBoosted: 20,
    shieldDuration: 8,
    rapidFireDuration: 8,
  },

  enemy: {
    hp: 30,
    dmg: 12,
    speed: 4.5,
    radius: 1.7,
    maxCount: 3,
    spawnInterval: 4,
    shootTimerInitMin: 1.5,
    shootTimerInitRange: 1.5,
    shootTimerMin: 1.1,
    shootTimerRange: 0.9,
    engageDist: 16,
    retreatDist: 8,
    turretTurnRate: 4,
    hullTurnRate: 1.8,
    hullMoveThreshold: 0.5,
    shootAimThreshold: 0.12,
  },

  bullet: {
    speed: 30,
    ttl: 2.5,
    muzzleOffset: 3,
    muzzleHeight: 1.5,
  },

  missile: {
    speed: 22,
    ttl: 5,
    hitRadius: 1.4,
    homingLerpRate: 5,
    launchStaggerMs: 120,
    launchHeight: 1.9,
    camDuration: 5.5,
  },

  powerup: {
    pickupRadius: 0.6,
    placementTries: 20,
    weights: { shield: 4, rapid: 4, missile: 2 },
    respawnMin: 10,
    respawnRange: 8,
    initialTimer: 8,
  },

  particle: {
    life: 0.8,
    gravity: 20,
  },

  camera: {
    followOffset: { x: 0, y: 22, z: 16 },
    followLerp: 0.08,
    widePos: { x: 0, y: 95, z: 42 },
    wideLerp: 0.05,
  },

  // 無限生存模式（見 survival.js、spec.md §6.2）
  survival: {
    killsPerWave: 8,
    pointsPerGrant: 10,
    waveInterval: 5,
    enemyHpBase: 30,
    enemyHpGrowth: 0.12,
    enemyDmgBase: 12,
    enemyDmgGrowth: 0.08,
    armorPerPoint: 0.05,
    armorCap: 0.8,
    weaponCooldownBase: 0.35,
    weaponCooldownDecay: 0.97,
    weaponCooldownFloor: 0.1,
    weaponDamageBase: 10,
    weaponDamageGrowth: 1.08,
    missileCooldownBase: 30,
    missileCooldownDecay: 0.95,
    missileCooldownFloor: 10,
    missileSpeedGrowth: 1.08,
  },
};
