// ---------- 測試模式：選敵人種類、選關卡、直接套用技能點數值（不用實際打波次累積） ----------
import { LEVELS } from './levels.js';

const testMenuEl = document.getElementById('testMenu');
const levelSelectEl = document.getElementById('testLevelSelect');
const startBtn = document.getElementById('testStart');

// 關卡下拉選單只需要建立一次
levelSelectEl.innerHTML = LEVELS.map((lv, i) => `<option value="${i}">${lv.name}（${lv.terrain}）</option>`).join('');

function getStat(id) {
  return Math.max(0, parseInt(document.getElementById(id).value, 10) || 0);
}

// 顯示測試模式設定面板，按下「開始測試」後呼叫 onStart({ enemyTypes, levelIndex, upgrades })
export function showTestMenu(onStart) {
  testMenuEl.style.display = 'flex';
  const handler = () => {
    const enemyTypes = [...document.querySelectorAll('#testEnemyTypes input:checked')].map(i => i.value);
    if (enemyTypes.length === 0) enemyTypes.push('standard'); // 沒勾選任何種類就預設標準兵
    const levelIndex = parseInt(levelSelectEl.value, 10) || 0;
    const upgrades = {
      front: getStat('testArmorFront'),
      back: getStat('testArmorBack'),
      left: getStat('testArmorLeft'),
      right: getStat('testArmorRight'),
      weapon: getStat('testWeapon'),
      missile: getStat('testMissile'),
    };
    testMenuEl.style.display = 'none';
    startBtn.removeEventListener('click', handler);
    onStart({ enemyTypes, levelIndex, upgrades });
  };
  startBtn.addEventListener('click', handler);
}
