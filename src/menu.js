// ---------- 主選單：模式選擇 ----------
const menuEl = document.getElementById('menu');
const btnEndless = document.getElementById('modeEndless');
const btnSurvival = document.getElementById('modeSurvival');

// 顯示主選單，玩家選好模式後呼叫 onSelect('endless' | 'survival')，選單自動隱藏
export function showModeMenu(onSelect) {
  menuEl.style.display = 'flex';
  const pick = mode => {
    menuEl.style.display = 'none';
    onSelect(mode);
  };
  btnEndless.onclick = () => pick('endless');
  btnSurvival.onclick = () => pick('survival');
}
