import * as THREE from 'three';

// ---------- 坦克工廠（T-34 風格：傾斜首上裝甲、圓潤砲塔前移，一眼分辨車頭車尾） ----------
export function makeTank(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: .7 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x22251d, roughness: .9 });

  // 履帶（車頭 -z、車尾 +z）
  const trackL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 3.7), dark);
  trackL.position.set(-1.25, 0.45, 0.15); trackL.castShadow = true;
  const trackR = trackL.clone(); trackR.position.x = 1.25;

  // 車身主體（略偏車尾方向，讓車頭留給傾斜裝甲板）
  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 2.3), mat);
  hull.position.set(0, 0.75, 0.35); hull.castShadow = true;

  // 車頭傾斜首上裝甲（T-34 招牌斜面）
  const glacis = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.05, 1.2), mat);
  glacis.position.set(0, 0.72, -1.55);
  glacis.rotation.x = -0.5;
  glacis.castShadow = true;

  // 車尾引擎艙（較低較窄）+ 排氣管，清楚標示車尾
  const engineDeck = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.9), mat);
  engineDeck.position.set(0, 0.6, 1.7); engineDeck.castShadow = true;
  const exhaustGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.6, 8);
  const exhaustL = new THREE.Mesh(exhaustGeo, dark);
  exhaustL.rotation.z = Math.PI / 2;
  exhaustL.position.set(-0.65, 0.5, 2.05);
  const exhaustR = exhaustL.clone(); exhaustR.position.x = 0.65;

  // 砲塔（六角柱、較圓潤，往車頭方向前移，一眼看出正面）
  const turret = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.62, 6), mat);
  dome.rotation.y = Math.PI / 6;
  dome.castShadow = true;
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 12), dark);
  hatch.position.set(0.2, 0.37, 0.2);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 2.6, 8), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0, -2.0);
  turret.add(dome, hatch, barrel);
  turret.position.set(0, 1.4, -0.5); // 相對車身前移

  g.add(trackL, trackR, hull, glacis, engineDeck, exhaustL, exhaustR, turret);
  g.userData.turret = turret;
  return g;
}
