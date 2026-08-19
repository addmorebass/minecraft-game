import * as THREE from "three";
import { WAYPOINTS } from "./map.js";

export const DIFFICULTIES = {
  easy: {
    id: "easy",
    label: "Easy",
    speed: 3.6,
    miss: 0.13,
    fireMin: 0.48,
    fireMax: 0.85,
    react: 0.6,
    damage: 10,
    headMul: 1.25,
    dodgeChance: 0.2,
    dodgeSpeed: 3.0,
    seeRange: 30,
    health: 130,
    plantSpeed: 0.65,
    defuseSpeed: 0.6,
  },
  normal: {
    id: "normal",
    label: "Normal",
    speed: 4.6,
    miss: 0.045,
    fireMin: 0.16,
    fireMax: 0.3,
    react: 0.18,
    damage: 18,
    headMul: 1.8,
    dodgeChance: 1,
    dodgeSpeed: 4.8,
    seeRange: 52,
    health: 165,
    plantSpeed: 1,
    defuseSpeed: 1,
  },
  hard: {
    id: "hard",
    label: "Hard",
    speed: 5.4,
    miss: 0.02,
    fireMin: 0.1,
    fireMax: 0.18,
    react: 0.07,
    damage: 24,
    headMul: 2.1,
    dodgeChance: 1.3,
    dodgeSpeed: 6.3,
    seeRange: 66,
    health: 190,
    plantSpeed: 1.35,
    defuseSpeed: 1.3,
  },
  expert: {
    id: "expert",
    label: "Expert",
    speed: 5.9,
    miss: 0.01,
    fireMin: 0.07,
    fireMax: 0.12,
    react: 0.03,
    damage: 30,
    headMul: 2.4,
    dodgeChance: 1.55,
    dodgeSpeed: 7.1,
    seeRange: 74,
    health: 215,
    plantSpeed: 1.55,
    defuseSpeed: 1.5,
  },
};

const wpById = Object.fromEntries(WAYPOINTS.map((w) => [w.id, w]));
const AIR = 0;

function nearestWp(x, z) {
  let best = WAYPOINTS[0];
  let bestD = Infinity;
  for (const w of WAYPOINTS) {
    const d = (w.x - x) ** 2 + (w.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}

function walkable(world, x, z, radius = 0.34) {
  const pts = [
    [x, z],
    [x - radius, z],
    [x + radius, z],
    [x, z - radius],
    [x, z + radius],
  ];
  for (const [sx, sz] of pts) {
    if (world.get(Math.floor(sx), 2, Math.floor(sz)) !== AIR) return false;
  }
  return true;
}

function clearLine(world, x0, z0, x1, z1) {
  const origin = new THREE.Vector3(x0, 2.7, z0);
  const dest = new THREE.Vector3(x1, 2.7, z1);
  const dir = dest.sub(origin);
  const dist = dir.length();
  if (dist < 0.05) return true;
  dir.multiplyScalar(1 / dist);
  const hit = world.raycast(origin, dir, dist - 0.2);
  return !hit;
}

const hopCache = new Map();
function graphDist(fromId, goalId) {
  const key = fromId + ">" + goalId;
  if (hopCache.has(key)) return hopCache.get(key);
  if (fromId === goalId) {
    hopCache.set(key, 0);
    return 0;
  }
  const visited = new Set([fromId]);
  const q = [[fromId, 0]];
  for (let i = 0; i < q.length; i++) {
    const [id, d] = q[i];
    const node = wpById[id];
    if (!node) continue;
    for (const n of node.links) {
      if (visited.has(n)) continue;
      if (n === goalId) {
        hopCache.set(key, d + 1);
        return d + 1;
      }
      visited.add(n);
      q.push([n, d + 1]);
    }
  }
  hopCache.set(key, 99);
  return 99;
}

function steerToward(world, pos, tx, tz, speed, dt) {
  const dx = tx - pos.x;
  const dz = tz - pos.z;
  const len = Math.hypot(dx, dz) || 1;
  const fx = dx / len;
  const fz = dz / len;
  const step = speed * dt;
  const tries = [0, 0.35, -0.35, 0.75, -0.75, 1.15, -1.15, 1.57, -1.57];
  for (const a of tries) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const mx = fx * c - fz * s;
    const mz = fx * s + fz * c;
    const nx = pos.x + mx * step;
    const nz = pos.z + mz * step;
    if (walkable(world, nx, nz)) {
      pos.x = nx;
      pos.z = nz;
      return Math.atan2(mx, mz);
    }
  }
  const nx = pos.x + fx * step;
  if (walkable(world, nx, pos.z)) pos.x = nx;
  const nz = pos.z + fz * step;
  if (walkable(world, pos.x, nz)) pos.z = nz;
  return Math.atan2(fx, fz);
}

function pickVisibleHop(world, pos, goalId) {
  let best = null;
  let bestScore = Infinity;
  for (const w of WAYPOINTS) {
    const tx = w.x + 0.5;
    const tz = w.z + 0.5;
    if (!clearLine(world, pos.x, pos.z, tx, tz)) continue;
    const hops = graphDist(w.id, goalId);
    const d = Math.hypot(tx - pos.x, tz - pos.z);
    const score = hops * 10 + d;
    if (score < bestScore) {
      bestScore = score;
      best = w;
    }
  }
  return best || nearestWp(pos.x, pos.z);
}

function makeSkin(team) {
  const shirt = team === "T" ? 0xb56a2a : 0x3a5aa8;
  const pants = team === "T" ? 0x5a3a1c : 0x2a2a40;
  const skin = 0xc4a07a;
  const hair = team === "T" ? 0x3d2b1a : 0x1c1c1c;
  return { shirt, pants, skin, hair };
}

function buildRig(team) {
  const g = new THREE.Group();
  const s = makeSkin(team);
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.MeshLambertMaterial({ color: s.skin })
  );
  head.position.y = 1.52;
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.12, 0.44),
    new THREE.MeshLambertMaterial({ color: s.hair })
  );
  hair.position.y = 1.74;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.58, 0.24),
    new THREE.MeshLambertMaterial({ color: s.shirt })
  );
  body.position.y = 1.02;
  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.55, 0.16),
    new THREE.MeshLambertMaterial({ color: s.pants })
  );
  const legR = legL.clone();
  legL.position.set(-0.1, 0.4, 0);
  legR.position.set(0.1, 0.4, 0);
  const armL = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.5, 0.14),
    new THREE.MeshLambertMaterial({ color: s.shirt })
  );
  const armR = armL.clone();
  armL.position.set(-0.3, 1.05, 0);
  armR.position.set(0.3, 1.05, 0);
  g.add(head, hair, body, legL, legR, armL, armR);
  g.userData.parts = { head, body, legL, legR, armL, armR };
  return g;
}

export class Bot {
  constructor(scene, team, name, spawn) {
    this.team = team;
    this.name = name;
    this.mesh = buildRig(team);
    scene.add(this.mesh);
    this.pos = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.yaw = team === "T" ? Math.PI : 0;
    this.diff = DIFFICULTIES.normal;
    this.health = this.diff.health;
    this.armor = 0;
    this.alive = true;
    this.speed = this.diff.speed + Math.random() * 0.4;
    this.reactT = 0;
    this.targetWp = nearestWp(spawn.x, spawn.z);
    this.goal = team === "T" ? (Math.random() < 0.5 ? "asite" : "bsite") : Math.random() < 0.5 ? "asite" : "bsite";
    this.shootCd = 0;
    this.seeTimer = 0;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.hasBomb = false;
    this.hasRocket = false;
    this.rocketAmmo = 0;
    this.rocketCd = 0;
    this.plantProg = 0;
    this.panic = 0;
    this.dodgeT = 0.2;
    this.crouchT = 0;
    this.backT = 0;
    this.role = "lurk";
    this.stuckT = 0;
    this.lastX = spawn.x;
    this.lastZ = spawn.z;
    this.repathT = 0;
    this.velY = 0;
    this.onGround = true;
  }

  applyProfile(diff) {
    this.diff = diff || DIFFICULTIES.normal;
    this.speed = this.diff.speed + Math.random() * 0.35;
  }

  headPos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.52, this.pos.z);
  }

  chestPos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.05, this.pos.z);
  }

  hide() {
    this.mesh.visible = false;
  }

  respawn(spot) {
    this.pos.set(spot.x, spot.y, spot.z);
    this.health = (this.diff || DIFFICULTIES.normal).health;
    this.armor = 0;
    this.alive = true;
    this.mesh.visible = true;
    this.reactT = 0;
    this.targetWp = nearestWp(spot.x, spot.z);
    this.goal = this.team === "T" ? (Math.random() < 0.5 ? "asite" : "bsite") : this.goal;
    this.seeTimer = 0;
    this.hasBomb = false;
    this.hasRocket = false;
    this.rocketAmmo = 0;
    this.rocketCd = 0;
    this.plantProg = 0;
    this.panic = 0;
    this.dodgeT = 0.15;
    this.crouchT = 0;
    this.backT = 0;
    this.mesh.scale.y = 1;
    this.stuckT = 0;
    this.lastX = spot.x;
    this.lastZ = spot.z;
    this.repathT = 0;
    this.velY = 0;
    this.onGround = true;
    this.mesh.rotation.z = 0;
    this.mesh.rotation.x = 0;
  }

  hitbox(point) {
    const dx = point.x - this.pos.x;
    const dz = point.z - this.pos.z;
    const rad = this.crouchT > 0 ? 0.24 : 0.28;
    if (dx * dx + dz * dz > rad * rad) return null;
    const ly = point.y - this.pos.y;
    const top = this.crouchT > 0 ? 1.25 : 1.8;
    if (ly < 0.1 || ly > top) return null;
    const headY = this.crouchT > 0 ? 1.0 : 1.38;
    return ly > headY ? "head" : "body";
  }

  visibleEnemy(world, player, bots) {
    const from = this.headPos();
    let best = null;
    let bestD = this.diff?.seeRange || 52;
    const consider = (eye, pos, ref, kind) => {
      const dir = eye.clone().sub(from);
      const dist = dir.length();
      if (dist < 0.4 || dist > bestD) return;
      dir.normalize();
      const wall = world.raycast(from, dir, dist - 0.15);
      if (wall) return;
      best = { eye, pos, ref, kind, dist };
      bestD = dist;
    };
    if (player.alive && player.team !== this.team) consider(player.eyePos(), player.pos, player, "player");
    for (const b of bots) {
      if (b === this || !b.alive || b.team === this.team) continue;
      consider(b.headPos(), b.pos, b, "bot");
    }
    return best;
  }

  visibleZombie(world, zombies) {
    if (!zombies || !zombies.length) return null;
    const from = this.headPos();
    let best = null;
    let bestD = 16;
    for (const z of zombies) {
      if (!z.alive) continue;
      const eye = z.headPos();
      const dir = eye.clone().sub(from);
      const dist = dir.length();
      if (dist < 0.4 || dist > bestD) continue;
      dir.normalize();
      if (world.raycast(from, dir, dist - 0.15)) continue;
      best = { eye, pos: z.pos, ref: z, kind: "zombie", dist };
      bestD = dist;
    }
    return best;
  }

  aimedAtBy(player) {
    if (!player.alive || player.team === this.team) return false;
    const look = player.lookDir();
    const to = this.chestPos().sub(player.eyePos());
    const dist = to.length();
    if (dist > 40) return false;
    to.multiplyScalar(1 / dist);
    return look.dot(to) > 0.92;
  }

  dodgeMove(dt, world, enemyPos) {
    this.dodgeT -= dt;
    this.crouchT = Math.max(0, this.crouchT - dt);
    this.backT = Math.max(0, this.backT - dt);
    if (this.dodgeT <= 0) {
      this.strafe = Math.random() < 0.5 ? -1 : 1;
      this.dodgeT = 0.16 + Math.random() * 0.28;
      const dodge = this.diff?.dodgeChance ?? 1;
      if (this.panic > 0 || Math.random() < 0.22 * dodge) this.crouchT = 0.28 + Math.random() * 0.25;
      if (this.panic > 0 && Math.random() < 0.45 * dodge) this.backT = 0.22;
    }
    const to = enemyPos.clone().sub(this.pos);
    this.yaw = Math.atan2(to.x, to.z);
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const burst = (this.diff?.dodgeSpeed || 4.8) * (this.panic > 0 ? 1.2 : 1);
    let mx = right.x * this.strafe * burst;
    let mz = right.z * this.strafe * burst;
    if (this.backT > 0) {
      mx -= forward.x * 3.4;
      mz -= forward.z * 3.4;
    }
    const nx = this.pos.x + mx * dt;
    const nz = this.pos.z + mz * dt;
    if (walkable(world, nx, nz)) {
      this.pos.x = nx;
      this.pos.z = nz;
    } else {
      this.strafe *= -1;
      const fx = this.pos.x + right.x * this.strafe * burst * dt;
      const fz = this.pos.z + right.z * this.strafe * burst * dt;
      if (walkable(world, fx, fz)) {
        this.pos.x = fx;
        this.pos.z = fz;
      } else {
        this.navigate(dt, world);
      }
    }
  }

  update(dt, world, player, allies, audio, onShoot, intel) {
    if (!this.alive) {
      this.mesh.visible = false;
      return;
    }

    this.shootCd = Math.max(0, this.shootCd - dt);
    this.panic = Math.max(0, this.panic - dt);
    if (intel?.planted && intel.plantSite) {
      this.goal = intel.plantSite === "A" ? "asite" : "bsite";
    } else if (this.hasBomb) {
      this.goal = this.goal === "asite" || this.goal === "bsite" ? this.goal : Math.random() < 0.5 ? "asite" : "bsite";
    } else if (player.alive && player.team === this.team && player.hasBomb) {
      const near = nearestWp(player.pos.x, player.pos.z);
      this.goal = near.id === "asite" || near.id === "bsite" ? near.id : this.goal;
    }

    const enemy = this.visibleEnemy(world, player, allies);
    const zed = this.visibleZombie(world, intel?.zombies);
    const target =
      zed && (!enemy || zed.dist < 8 || (zed.dist < enemy.dist && zed.dist < 14)) ? zed : enemy;
    if (target) {
      if (this.seeTimer <= 0) this.reactT = this.diff?.react || 0.18;
      this.seeTimer = 1.5;
    }
    if (this.seeTimer > 0) this.seeTimer -= dt;
    this.reactT = Math.max(0, this.reactT - dt);
    if (this.aimedAtBy(player)) this.panic = Math.max(this.panic, 0.9);

    this.repathT -= dt;
    const falling = !this.onGround && this.velY < -0.5;
    const moved = Math.hypot(this.pos.x - this.lastX, this.pos.z - this.lastZ);
    if (moved < 0.04) this.stuckT += dt;
    else this.stuckT = 0;
    this.lastX = this.pos.x;
    this.lastZ = this.pos.z;
    if (this.stuckT > 0.4) {
      this.targetWp = pickVisibleHop(world, this.pos, this.goal);
      this.stuckT = 0;
      this.strafe *= -1;
    }

    if (falling) {
      this.yaw += dt * 7;
    } else if (target) {
      this.dodgeMove(dt, world, target.pos);
      if (this.shootCd <= 0 && this.reactT <= 0 && this.crouchT < 0.12) {
        const d = this.diff || DIFFICULTIES.normal;
        this.shootCd = d.fireMin + Math.random() * (d.fireMax - d.fireMin);
        const origin = this.chestPos();
        const dir = target.eye.clone().sub(origin);
        const useRocket = this.hasRocket && (this.rocketAmmo || 0) > 0 && target.dist > 4.5;
        const miss = (useRocket ? d.miss * 0.4 : d.miss) * (this.panic > 0 ? 1.4 : 1);
        dir.x += (Math.random() - 0.5) * miss;
        dir.y += (Math.random() - 0.5) * miss;
        dir.z += (Math.random() - 0.5) * miss;
        dir.normalize();
        if (useRocket) {
          this.shootCd = 1.55 + Math.random() * 0.45;
          this.rocketAmmo -= 1;
          if (this.rocketAmmo <= 0) this.hasRocket = false;
          onShoot(this, origin, dir, true);
        } else {
          onShoot(this, origin, dir);
          audio.shoot(false);
        }
      }
    } else if (intel?.loose && intel.bombPos && this.team === "T") {
      if (clearLine(world, this.pos.x, this.pos.z, intel.bombPos.x, intel.bombPos.z)) {
        const yaw = steerToward(world, this.pos, intel.bombPos.x, intel.bombPos.z, this.speed * 1.1, dt);
        if (yaw != null) this.yaw = yaw;
      } else {
        this.goal = nearestWp(intel.bombPos.x, intel.bombPos.z).id;
        this.navigate(dt, world);
      }
    } else if (player.alive && player.team === this.team && player.hasBomb && this.pos.distanceTo(player.pos) > 3.5) {
      if (clearLine(world, this.pos.x, this.pos.z, player.pos.x, player.pos.z)) {
        const yaw = steerToward(world, this.pos, player.pos.x, player.pos.z, this.speed, dt);
        if (yaw != null) this.yaw = yaw;
      } else {
        this.targetWp = pickVisibleHop(world, this.pos, nearestWp(player.pos.x, player.pos.z).id);
        this.navigate(dt, world);
      }
    } else if (
      intel?.rocket?.available &&
      intel.rocket.pos &&
      !this.hasRocket &&
      !this.hasBomb &&
      !intel.planted
    ) {
      const rp = intel.rocket.pos;
      const d = Math.hypot(rp.x - this.pos.x, rp.z - this.pos.z);
      if (this.role === "hunter" || d < 16) {
        if (clearLine(world, this.pos.x, this.pos.z, rp.x, rp.z)) {
          const yaw = steerToward(world, this.pos, rp.x, rp.z, this.speed * 1.15, dt);
          if (yaw != null) this.yaw = yaw;
        } else {
          this.goal = "mid_rpg";
          this.navigate(dt, world);
        }
      } else {
        this.navigate(dt, world);
      }
    } else if (this.panic > 0) {
      this.dodgeMove(dt, world, this.pos.clone().add(new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))));
    } else {
      this.navigate(dt, world);
    }

    this.velY -= 22 * dt;
    this.pos.y += this.velY * dt;
    const grounded = world.collide(this.pos, 0.3, this.crouchT > 0 ? 1.2 : 1.7);
    if (grounded && this.velY <= 0) {
      this.velY = 0;
      this.onGround = true;
    } else {
      this.onGround = !!grounded;
    }
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    this.mesh.rotation.z = falling || this.pos.y < 1.4 ? Math.sin(performance.now() * 0.02) * 0.45 : 0;
    this.mesh.scale.y = this.crouchT > 0 ? 0.72 : 1;
    const swing = Math.sin(performance.now() * 0.012 + this.pos.x) * (this.crouchT > 0 ? 0.08 : 0.28);
    this.mesh.userData.parts.legL.rotation.x = swing;
    this.mesh.userData.parts.legR.rotation.x = -swing;
  }

  navigate(dt, world) {
    if (!this.targetWp) this.targetWp = nearestWp(this.pos.x, this.pos.z);
    if (this.repathT <= 0) {
      const next = pickVisibleHop(world, this.pos, this.goal);
      if (next) this.targetWp = next;
      this.repathT = 0.45;
    }
    const wp = this.targetWp;
    const tx = wp.x + 0.5;
    const tz = wp.z + 0.5;
    const dist = Math.hypot(tx - this.pos.x, tz - this.pos.z);
    if (dist < 1.15) {
      let hopId = nextHop(wp.id, this.goal);
      if (hopId === wp.id && wp.id === this.goal) {
        const hold = wp.links[Math.floor(Math.random() * wp.links.length)];
        hopId = hold;
      }
      this.targetWp = wpById[hopId] || wp;
      this.repathT = 0;
      return;
    }
    if (!clearLine(world, this.pos.x, this.pos.z, tx, tz)) {
      this.targetWp = pickVisibleHop(world, this.pos, this.goal);
    }
    const yaw = steerToward(world, this.pos, this.targetWp.x + 0.5, this.targetWp.z + 0.5, this.speed, dt);
    if (yaw != null) this.yaw = yaw;
  }

  nextTowardGoal(wp) {
    if (wp.id === this.goal) {
      const hold = wp.links[Math.floor(Math.random() * wp.links.length)];
      return wpById[hold] || wp;
    }
    const visited = new Set();
    const q = [[wp.id, null]];
    visited.add(wp.id);
    while (q.length) {
      const [id] = q.shift();
      const node = wpById[id];
      for (const n of node.links) {
        if (visited.has(n)) continue;
        visited.add(n);
        q.push([n, id === wp.id ? n : q[0]?.[1]]);
        if (n === this.goal) return wpById[id === wp.id ? n : n];
      }
    }
    const nid = wp.links[Math.floor(Math.random() * wp.links.length)];
    return wpById[nid] || wp;
  }
}

// BFS next hop from current waypoint toward goal
export function nextHop(fromId, goalId) {
  if (fromId === goalId) return fromId;
  const visited = new Set([fromId]);
  const q = [[fromId, null]];
  const parent = { [fromId]: null };
  let i = 0;
  while (i < q.length) {
    const [id] = q[i++];
    const node = wpById[id];
    if (!node) continue;
    for (const n of node.links) {
      if (visited.has(n)) continue;
      visited.add(n);
      parent[n] = id;
      q.push([n]);
      if (n === goalId) {
        let cur = n;
        while (parent[cur] && parent[cur] !== fromId) cur = parent[cur];
        return cur;
      }
    }
  }
  return fromId;
}

const NAMES = {
  T: ["Phoenix", "Rebel", "Dune", "Sands", "Nomad"],
  CT: ["Seal", "Guardian", "Watch", "Blue", "Defender"],
};

export class BotManager {
  constructor(scene) {
    this.scene = scene;
    this.bots = [];
    this.profile = DIFFICULTIES.normal;
  }

  setDifficulty(id) {
    this.profile = DIFFICULTIES[id] || DIFFICULTIES.normal;
    for (const b of this.bots) b.applyProfile(this.profile);
  }

  spawnAll(playerTeam, spawns) {
    for (const b of this.bots) this.scene.remove(b.mesh);
    this.bots = [];
    const tSpots = [...spawns.T];
    const ctSpots = [...spawns.CT];
    if (playerTeam === "T") tSpots.shift();
    else ctSpots.shift();

    for (let i = 0; i < 4; i++) {
      const spot = tSpots[i % tSpots.length];
      this.bots.push(new Bot(this.scene, "T", NAMES.T[i], spot));
    }
    for (let i = 0; i < 4; i++) {
      const spot = ctSpots[i % ctSpots.length];
      this.bots.push(new Bot(this.scene, "CT", NAMES.CT[i], spot));
    }
    for (const b of this.bots) {
      b.applyProfile(this.profile);
      b.health = this.profile.health;
    }
  }

  respawn(spawns) {
    let ti = 0;
    let ci = 0;
    for (const b of this.bots) {
      const spots = b.team === "T" ? spawns.T : spawns.CT;
      const i = b.team === "T" ? ti++ : ci++;
      b.respawn(spots[(i + 1) % spots.length]);
    }
  }

  living(team) {
    return this.bots.filter((b) => b.alive && b.team === team);
  }

  update(dt, world, player, audio, onShoot, intel) {
    for (const b of this.bots) b.update(dt, world, player, this.bots, audio, onShoot, intel);
  }

  assignRoles(playerTeam) {
    const ts = this.bots.filter((b) => b.team === "T");
    const cts = this.bots.filter((b) => b.team === "CT");
    ts.forEach((b, i) => {
      b.goal = i % 2 === 0 ? "asite" : "bsite";
      b.hasBomb = false;
      b.hasRocket = false;
      b.rocketAmmo = 0;
      b.role = "entry";
    });
    cts.forEach((b, i) => {
      b.goal = i % 2 === 0 ? "asite" : "bsite";
      b.hasRocket = false;
      b.rocketAmmo = 0;
      b.role = "anchor";
    });
    if (playerTeam !== "T" && ts[0]) {
      ts[0].hasBomb = true;
      ts[0].role = "bomber";
    }
    const tHunter = ts.find((b) => !b.hasBomb);
    if (tHunter) tHunter.role = "hunter";
    if (cts[1]) cts[1].role = "hunter";
  }

  hitTest(origin, dir, maxDist, shooterTeam) {
    let best = null;
    let bestT = maxDist;
    for (const b of this.bots) {
      if (!b.alive || b.team === shooterTeam) continue;
      const to = b.chestPos().sub(origin);
      const t = to.dot(dir);
      if (t < 0 || t > bestT) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      const part = b.hitbox(closest);
      if (!part) {
        const head = b.headPos();
        const th = head.clone().sub(origin).dot(dir);
        const hc = origin.clone().addScaledVector(dir, th);
        if (hc.distanceTo(head) < 0.24 && th > 0 && th < bestT) {
          best = { bot: b, part: "head", point: hc, dist: th };
          bestT = th;
        }
        continue;
      }
      best = { bot: b, part, point: closest, dist: t };
      bestT = t;
    }
    return best;
  }
}
