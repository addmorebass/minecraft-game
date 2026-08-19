import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();

function glowMat(color, opacity, additive = true) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    fog: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}

function disposeObj(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) m.dispose();
    }
  });
}

export class ShotFX {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  tracer(from, to, color = 0xffc94a) {
    _dir.copy(to).sub(from);
    const len = Math.max(0.35, _dir.length());
    _dir.multiplyScalar(1 / len);
    _mid.copy(from).addScaledVector(_dir, len * 0.5);

    const group = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.018, len, 6, 1, true), glowMat(0xfff6c8, 0.95));
    const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, len, 6, 1, true), glowMat(color, 0.55));
    core.quaternion.setFromUnitVectors(UP, _dir);
    glow.quaternion.copy(core.quaternion);
    group.add(core, glow);
    group.position.copy(_mid);
    this.scene.add(group);
    this.items.push({ kind: "tracer", obj: group, t: 0.28, life: 0.28 });
  }

  impact(point, normal, style = "sand") {
    const group = new THREE.Group();
    const flashCol = style === "blood" ? 0xff4a4a : 0xffe29a;
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), glowMat(flashCol, 0.9));
    flash.position.copy(point).addScaledVector(normal, 0.04);
    flash.lookAt(point.clone().add(normal));
    group.add(flash);

    if (style !== "blood") {
      const hole = new THREE.Mesh(
        new THREE.PlaneGeometry(0.18, 0.18),
        new THREE.MeshBasicMaterial({ color: 0x2a1c10, transparent: true, opacity: 0.8, depthWrite: false, fog: false })
      );
      hole.position.copy(point).addScaledVector(normal, 0.03);
      hole.lookAt(point.clone().add(normal));
      group.add(hole);
    }

    const sparks = [];
    const n = style === "blood" ? 10 : 8;
    for (let i = 0; i < n; i++) {
      const c = style === "blood" ? (Math.random() < 0.4 ? 0x8a1010 : 0xff5555) : Math.random() < 0.5 ? 0xffee88 : 0xe8d4a0;
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), glowMat(c, 1, style === "blood"));
      cube.position.copy(point);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 3.2 + 0.8,
        (Math.random() - 0.5) * 5
      );
      vel.addScaledVector(normal, 2.4 + Math.random() * 2);
      group.add(cube);
      sparks.push({ mesh: cube, vel });
    }

    this.scene.add(group);
    this.items.push({ kind: "impact", obj: group, sparks, t: 0.45, life: 0.45 });
  }

  rubble(point, count = 10, color = 0xd4b483) {
    const group = new THREE.Group();
    const sparks = [];
    for (let i = 0; i < count; i++) {
      const shade = Math.random() < 0.35 ? 0x8a6a40 : color;
      const s = 0.12 + Math.random() * 0.2;
      const cube = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), glowMat(shade, 1, false));
      cube.position.copy(point);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 7, Math.random() * 6 + 1.5, (Math.random() - 0.5) * 7);
      group.add(cube);
      sparks.push({ mesh: cube, vel });
    }
    this.scene.add(group);
    this.items.push({ kind: "impact", obj: group, sparks, t: 0.7, life: 0.7 });
  }

  muzzle(point, color = 0xffb040) {
    const group = new THREE.Group();
    const burst = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), glowMat(0xfff2aa, 1));
    const flare = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.05), glowMat(color, 0.9));
    const flare2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 0.05), glowMat(color, 0.9));
    const flare3 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.28), glowMat(0xff8800, 0.85));
    group.add(burst, flare, flare2, flare3);
    group.position.copy(point);
    group.rotation.set(Math.random(), Math.random(), Math.random());
    this.scene.add(group);

    const light = new THREE.PointLight(color, 10, 7);
    light.position.copy(point);
    this.scene.add(light);

    this.items.push({ kind: "muzzle", obj: group, light, t: 0.07, life: 0.07 });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.t -= dt;
      const k = Math.max(0, item.t / item.life);

      if (item.kind === "tracer") {
        item.obj.traverse((child) => {
          if (child.material) child.material.opacity = k * (child === item.obj.children[0] ? 0.95 : 0.55);
        });
      } else if (item.kind === "impact") {
        for (const s of item.sparks) {
          s.vel.y -= 18 * dt;
          s.mesh.position.addScaledVector(s.vel, dt);
          s.mesh.rotation.x += dt * 8;
          s.mesh.rotation.y += dt * 6;
          if (s.mesh.material) s.mesh.material.opacity = k;
        }
        const flash = item.obj.children[0];
        if (flash?.material) flash.material.opacity = k * k * 0.9;
      } else if (item.kind === "muzzle") {
        item.obj.scale.setScalar(0.7 + k * 0.8);
        if (item.light) item.light.intensity = 12 * k;
      }

      if (item.t <= 0) {
        this.scene.remove(item.obj);
        disposeObj(item.obj);
        if (item.light) this.scene.remove(item.light);
        this.items.splice(i, 1);
      }
    }
  }
}
