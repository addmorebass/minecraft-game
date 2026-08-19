import * as THREE from "three";

export const ZOMBIE_SPAWNS = [
  { x: 23.5, z: 62.5 },
  { x: 21.5, z: 48.5 },
  { x: 22.5, z: 38.5 },
  { x: 30.5, z: 80.5 },
  { x: 18.5, z: 55.5 },
];

const AIR = 0;

function walkable(world, x, z) {
  const pts = [
    [x, z],
    [x - 0.28, z],
    [x + 0.28, z],
    [x, z - 0.28],
    [x, z + 0.28],
  ];
  for (const [sx, sz] of pts) {
    if (world.get(Math.floor(sx), 2, Math.floor(sz)) !== AIR) return false;
  }
  return true;
}

function buildZombie() {
  const g = new THREE.Group();
  const skin = 0x3d6b32;
  const shirt = 0x3a4a28;
  const pants = 0x2a2a18;
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.44, 0.44),
    new THREE.MeshLambertMaterial({ color: skin })
  );
  head.position.y = 1.52;
  const eyeL = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.08, 0.04),
    new THREE.MeshBasicMaterial({ color: 0x88ff44, fog: false })
  );
  const eyeR = eyeL.clone();
  eyeL.position.set(-0.1, 1.54, 0.22);
  eyeR.position.set(0.1, 1.54, 0.22);
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.6, 0.24),
    new THREE.MeshLambertMaterial({ color: shirt })
  );
  body.position.y = 1.02;
  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.55, 0.16),
    new THREE.MeshLambertMaterial({ color: pants })
  );
  const legR = legL.clone();
  legL.position.set(-0.1, 0.4, 0);
  legR.position.set(0.1, 0.4, 0);
  const armL = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.55, 0.14),
    new THREE.MeshLambertMaterial({ color: skin })
  );
  const armR = armL.clone();
  armL.position.set(-0.3, 1.15, 0.22);
  armR.position.set(0.3, 1.15, 0.22);
  armL.rotation.x = -1.15;
  armR.rotation.x = -1.15;
  g.add(head, eyeL, eyeR, body, legL, legR, armL, armR);
  g.userData.parts = { head, body, legL, legR, armL, armR };
  return g;
}

export class Zombie {
  constructor(scene, spot) {
    this.team = "Z";
    this.name = "Zombie";
    this.mesh = buildZombie();
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(spot.x, 2.01, spot.z);
    this.yaw = Math.random() * Math.PI * 2;
    this.health = 18;
    this.alive = true;
    this.speed = 2.15 + Math.random() * 0.35;
    this.attackCd = 0.4;
    this.groanT = 2 + Math.random() * 6;
    this.velY = 0;
    this.onGround = true;
    this.mesh.position.copy(this.pos);
  }

  headPos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.52, this.pos.z);
  }

  chestPos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.05, this.pos.z);
  }

  hide() {
    this.alive = false;
    this.mesh.visible = false;
  }

  respawn(spot) {
    this.pos.set(spot.x, 2.01, spot.z);
    this.health = 18;
    this.alive = true;
    this.mesh.visible = true;
    this.attackCd = 0.5;
    this.velY = 0;
    this.onGround = true;
    this.mesh.rotation.z = 0;
    this.mesh.position.copy(this.pos);
  }

  hitbox(point) {
    const dx = point.x - this.pos.x;
    const dz = point.z - this.pos.z;
    if (dx * dx + dz * dz > 0.48 * 0.48) return null;
    const ly = point.y - this.pos.y;
    if (ly < 0.05 || ly > 1.95) return null;
    return ly > 1.32 ? "head" : "body";
  }

  hurt(dmg) {
    if (!this.alive) return false;
    this.health -= dmg;
    if (this.health <= 0) {
      this.health = 0;
      this.hide();
      return true;
    }
    return false;
  }

  nearestPrey(player, bots) {
    let best = null;
    let bestD = 70;
    const consider = (pos, ref, kind) => {
      const d = this.pos.distanceTo(pos);
      if (d < bestD) {
        bestD = d;
        best = { pos, ref, kind, dist: d };
      }
    };
    if (player.alive) consider(player.pos, player, "player");
    for (const b of bots) {
      if (b.alive) consider(b.pos, b, "bot");
    }
    return best;
  }

  update(dt, world, player, bots, audio, onMelee) {
    if (!this.alive) {
      this.mesh.visible = false;
      return;
    }
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.groanT -= dt;
    if (this.groanT <= 0) {
      audio.moan();
      this.groanT = 5 + Math.random() * 7;
    }

    const falling = !this.onGround && this.velY < -0.5;
    const prey = this.nearestPrey(player, bots);
    if (falling) {
      this.yaw += dt * 6;
    } else if (prey) {
      const dx = prey.pos.x - this.pos.x;
      const dz = prey.pos.z - this.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      const step = this.speed * dt;
      const tries = [0, 0.4, -0.4, 0.9, -0.9, 1.4, -1.4];
      let moved = false;
      for (const a of tries) {
        const c = Math.cos(a);
        const s = Math.sin(a);
        const fx = dx / len;
        const fz = dz / len;
        const mx = fx * c - fz * s;
        const mz = fx * s + fz * c;
        const nx = this.pos.x + mx * step;
        const nz = this.pos.z + mz * step;
        if (walkable(world, nx, nz)) {
          this.pos.x = nx;
          this.pos.z = nz;
          this.yaw = Math.atan2(mx, mz);
          moved = true;
          break;
        }
      }
      if (!moved) this.yaw = Math.atan2(dx, dz);
      if (prey.dist < 1.15 && this.attackCd <= 0) {
        this.attackCd = 1.25;
        onMelee(prey);
        audio.moan();
      }
    }

    this.velY -= 22 * dt;
    this.pos.y += this.velY * dt;
    const grounded = world.collide(this.pos, 0.28, 1.7);
    if (grounded && this.velY <= 0) {
      this.velY = 0;
      this.onGround = true;
    } else {
      this.onGround = !!grounded;
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    this.mesh.rotation.z = falling || this.pos.y < 1.4 ? Math.sin(performance.now() * 0.018) * 0.5 : 0;
    const swing = Math.sin(performance.now() * 0.008 + this.pos.x) * 0.35;
    this.mesh.userData.parts.legL.rotation.x = swing;
    this.mesh.userData.parts.legR.rotation.x = -swing;
  }
}

export class Horde {
  constructor(scene) {
    this.scene = scene;
    this.zombies = [];
    this.awakened = false;
    this.spawnT = 0;
    this.night = false;
    this.savedSky = null;
  }

  living() {
    return this.zombies.filter((z) => z.alive);
  }

  resetAll(scene) {
    for (const z of this.zombies) {
      z.hide();
      scene.remove(z.mesh);
    }
    this.zombies = [];
    this.awakened = false;
    this.spawnT = 0;
    this.restoreSky(scene);
  }

  beginRound() {
    for (const z of this.zombies) z.hide();
    this.spawnT = this.awakened ? 1.4 : 0;
  }

  rememberSky(scene) {
    if (this.savedSky) return;
    this.savedSky = {
      bg: scene.background ? scene.background.getHex() : 0x7ec8e3,
      fog: scene.fog ? scene.fog.color.getHex() : 0xc4b896,
      near: scene.fog?.near ?? 28,
      far: scene.fog?.far ?? 95,
    };
  }

  nightSky(scene) {
    this.rememberSky(scene);
    scene.background = new THREE.Color(0x121820);
    if (scene.fog) {
      scene.fog.color.set(0x1a2430);
      scene.fog.near = 14;
      scene.fog.far = 58;
    }
    this.night = true;
  }

  restoreSky(scene) {
    if (!this.savedSky || !scene) return;
    scene.background = new THREE.Color(this.savedSky.bg);
    if (scene.fog) {
      scene.fog.color.set(this.savedSky.fog);
      scene.fog.near = this.savedSky.near;
      scene.fog.far = this.savedSky.far;
    }
    this.night = false;
  }

  awaken(scene) {
    if (this.awakened) return false;
    this.awakened = true;
    this.nightSky(scene);
    this.spawnT = 0.2;
    return true;
  }

  pickSpot(player, bots) {
    const shuffled = ZOMBIE_SPAWNS.slice().sort(() => Math.random() - 0.5);
    for (const s of shuffled) {
      const p = new THREE.Vector3(s.x, 2, s.z);
      if (player.alive && player.pos.distanceTo(p) < 14) continue;
      const crowded = bots.some((b) => b.alive && b.pos.distanceTo(p) < 4);
      if (crowded) continue;
      return s;
    }
    return shuffled[0];
  }

  spawnOne(player, bots) {
    if (this.living().length >= 6) return;
    const spot = this.pickSpot(player, bots);
    if (!spot) return;
    const dead = this.zombies.find((z) => !z.alive);
    if (dead) dead.respawn(spot);
    else this.zombies.push(new Zombie(this.scene, spot));
  }

  update(dt, world, player, bots, audio, onMelee, freeze) {
    if (!this.awakened || freeze > 0) {
      for (const z of this.zombies) {
        if (z.alive) z.update(0, world, player, bots, audio, () => {});
      }
      return;
    }
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnOne(player, bots);
      this.spawnT = 16 + Math.random() * 10;
    }
    for (const z of this.zombies) z.update(dt, world, player, bots, audio, onMelee);
  }

  hitTest(origin, dir, maxDist) {
    let best = null;
    let bestT = maxDist;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const to = z.chestPos().sub(origin);
      const t = to.dot(dir);
      if (t < 0 || t > bestT) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      const part = z.hitbox(closest);
      if (!part) continue;
      bestT = t;
      best = { zombie: z, dist: t, point: closest, part };
    }
    return best;
  }
}
