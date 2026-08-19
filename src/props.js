import * as THREE from "three";

export function createC4(scale = 1) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.24, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x6b7a3a })
  );
  const face = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.08, 0.32),
    new THREE.MeshLambertMaterial({ color: 0x2a2a22 })
  );
  face.position.y = 0.1;
  const led = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff2200, fog: false })
  );
  led.position.set(0.16, 0.16, 0.08);
  const key = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.04, 0.18),
    new THREE.MeshLambertMaterial({ color: 0x111111 })
  );
  key.position.set(-0.1, 0.14, 0);
  const light = new THREE.PointLight(0xff3300, 1.6, 5);
  light.position.set(0, 0.2, 0);
  g.add(body, face, led, key, light);
  g.scale.setScalar(scale);
  g.userData.led = led;
  g.userData.light = light;
  return g;
}

export function pulseC4(mesh, time) {
  if (!mesh) return;
  const on = Math.sin(time * 8) > 0;
  if (mesh.userData.led) mesh.userData.led.visible = on;
  if (mesh.userData.light) mesh.userData.light.intensity = on ? 3.2 : 0.35;
}

function letterTexture(letter, color) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(8, 8, 112, 112);
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.strokeRect(8, 8, 112, 112);
  ctx.fillStyle = color;
  ctx.font = "bold 86px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, 64, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createSiteMarker(letter, x, z, color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    map: letterTexture(letter, color),
    transparent: true,
    fog: false,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), mat);
  plane.position.y = 4.2;
  const pole = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 3.6, 0.16),
    new THREE.MeshLambertMaterial({ color: 0x3d2b1a })
  );
  pole.position.y = 2.2;
  const pad = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.08, 1.6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, fog: false })
  );
  pad.position.y = 0.08;
  g.add(plane, pole, pad);
  g.position.set(x, 2, z);
  g.userData.billboard = plane;
  return g;
}

export function createRocketPickup() {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 0.85, 8),
    new THREE.MeshLambertMaterial({ color: 0x4a5a32 })
  );
  tube.rotation.z = Math.PI / 2;
  const warhead = new THREE.Mesh(
    new THREE.ConeGeometry(0.14, 0.28, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a2a12 })
  );
  warhead.rotation.z = -Math.PI / 2;
  warhead.position.x = 0.52;
  const fin = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.22, 0.04),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
  );
  fin.position.x = -0.32;
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.55, 0.55),
    new THREE.MeshBasicMaterial({ color: 0xff6622, transparent: true, opacity: 0.2, fog: false, depthWrite: false })
  );
  const light = new THREE.PointLight(0xff6622, 1.8, 7);
  g.add(tube, warhead, fin, glow, light);
  return g;
}

export function createRocketProjectile() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.08, 0.42, 6),
    new THREE.MeshBasicMaterial({ color: 0xffaa44, fog: false })
  );
  body.rotation.z = Math.PI / 2;
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.16, 6),
    new THREE.MeshBasicMaterial({ color: 0xff3300, fog: false })
  );
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = 0.26;
  const light = new THREE.PointLight(0xff6600, 4, 8);
  g.add(body, tip, light);
  return g;
}

export function createRocketViewmodel() {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 0.7, 8),
    new THREE.MeshLambertMaterial({ color: 0x3d4a28 })
  );
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0.2, -0.16, -0.55);
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.16, 8),
    new THREE.MeshLambertMaterial({ color: 0x8a2a12 })
  );
  tip.rotation.x = -Math.PI / 2;
  tip.position.set(0.2, -0.16, -0.96);
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.14, 0.06),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
  );
  grip.position.set(0.2, -0.28, -0.4);
  g.add(tube, tip, grip);
  g.visible = false;
  return g;
}

export function createBeacon() {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.22, 8, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.45,
      fog: false,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  mesh.position.y = 4;
  return mesh;
}
