import * as THREE from "three";
import { createC4, createRocketViewmodel } from "./props.js";

export const WEAPONS = {
  rifle: {
    nameT: "AK-47",
    nameCT: "M4A4",
    damage: 24,
    headMul: 2.2,
    spread: 0.012,
    rpm: 600,
    mag: 30,
    reserve: 90,
    reload: 2.1,
    range: 90,
  },
  pistol: {
    nameT: "Glock",
    nameCT: "USP-S",
    damage: 15,
    headMul: 2.4,
    spread: 0.018,
    rpm: 400,
    mag: 12,
    reserve: 36,
    reload: 1.6,
    range: 60,
  },
  rocket: {
    nameT: "RPG",
    nameCT: "RPG",
    damage: 92,
    headMul: 1,
    spread: 0.004,
    rpm: 38,
    mag: 1,
    reserve: 2,
    reload: 2.3,
    range: 70,
    projectile: true,
    splash: 4.4,
    breakRadius: 2.6,
    speed: 34,
  },
};

export class Player {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.team = "T";
    this.pos = new THREE.Vector3(46.5, 2.01, 104.5);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;
    this.pitch = 0;
    this.radius = 0.32;
    this.height = 1.7;
    this.eye = 1.55;
    this.speed = 6.4;
    this.walkMul = 0.48;
    this.jump = 7.6;
    this.gravity = 22;
    this.onGround = false;
    this.health = 100;
    this.armor = 100;
    this.alive = true;
    this.keys = new Set();
    this.locked = false;
    this.weapon = "rifle";
    this.loadout = {
      rifle: { mag: 30, reserve: 90 },
      pistol: { mag: 12, reserve: 36 },
    };
    this.lastShot = 0;
    this.reloading = 0;
    this.hasBomb = false;
    this.hasRocket = false;
    this.recoil = 0;
    this.viewmodel = null;
    this.kick = 0;
    this.spectateI = 0;
    this._specTap = false;
    this.hurtCd = 0;
  }

  get weaponDef() {
    return WEAPONS[this.weapon];
  }

  get ammo() {
    return this.loadout[this.weapon];
  }

  gunName() {
    return this.team === "T" ? this.weaponDef.nameT : this.weaponDef.nameCT;
  }

  spawn(spot, yaw) {
    this.pos.set(spot.x, spot.y, spot.z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.health = 100;
    this.armor = 100;
    this.alive = true;
    this.loadout.rifle = { mag: 30, reserve: 90 };
    this.loadout.pistol = { mag: 12, reserve: 36 };
    this.hasRocket = false;
    delete this.loadout.rocket;
    this.weapon = "rifle";
    this.reloading = 0;
    this.recoil = 0;
    this.spectateI = 0;
    this._specTap = false;
    this.hurtCd = 0;
    if (this.viewmodel) this.viewmodel.visible = true;
  }

  bind(dom) {
    window.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code === "Digit1") this.switchWeapon("rifle");
      if (e.code === "Digit2") this.switchWeapon("pistol");
      if (e.code === "Digit3") this.switchWeapon("rocket");
      if (e.code === "KeyR") this.startReload();
      if (e.code === "KeyE" || e.code === "Space" || e.code === "KeyW" || e.code === "KeyA" || e.code === "KeyS" || e.code === "KeyD") {
        e.preventDefault();
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    dom.addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch -= e.movementY * 0.0022;
      this.pitch = Math.max(-1.54, Math.min(1.45, this.pitch));
    });
  }

  switchWeapon(id) {
    if (id === "rocket" && !this.hasRocket) return;
    if (this.weapon === id) return;
    this.weapon = id;
    this.reloading = 0;
  }

  giveRocket() {
    this.hasRocket = true;
    this.loadout.rocket = { mag: 1, reserve: 2 };
    this.weapon = "rocket";
    this.reloading = 0;
  }

  startReload() {
    if (this.reloading > 0 || !this.alive) return false;
    const a = this.ammo;
    if (a.mag >= this.weaponDef.mag || a.reserve <= 0) return false;
    this.reloading = this.weaponDef.reload;
    return true;
  }

  finishReload() {
    const def = this.weaponDef;
    const a = this.ammo;
    const need = def.mag - a.mag;
    const take = Math.min(need, a.reserve);
    a.mag += take;
    a.reserve -= take;
  }

  tryShoot(now) {
    if (!this.alive || this.reloading > 0) return null;
    if (this.weapon === "rocket" && (!this.ammo || this.ammo.mag + this.ammo.reserve <= 0)) {
      this.hasRocket = false;
      this.weapon = "rifle";
    }
    const def = this.weaponDef;
    if (!this.ammo) return null;
    const interval = 60 / def.rpm;
    if (now - this.lastShot < interval) return null;
    if (this.ammo.mag <= 0) {
      this.startReload();
      return { dry: true };
    }
    this.ammo.mag -= 1;
    this.lastShot = now;
    this.recoil = Math.min(0.08, this.recoil + 0.018);
    const dir = this.lookDir();
    dir.x += (Math.random() - 0.5) * def.spread;
    dir.y += (Math.random() - 0.5) * def.spread + (def.projectile ? 0 : this.recoil * 0.4);
    dir.z += (Math.random() - 0.5) * def.spread;
    dir.normalize();
    return { dir, def, origin: this.eyePos(), projectile: !!def.projectile };
  }

  lookDir() {
    const dir = new THREE.Vector3(0, 0, -1);
    const e = new THREE.Euler(this.pitch, this.yaw, 0, "YXZ");
    dir.applyEuler(e);
    return dir;
  }

  eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eye, this.pos.z);
  }

  update(dt) {
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        this.reloading = 0;
        this.finishReload();
      }
    }
    this.recoil *= Math.pow(0.08, dt);
    this.hurtCd = Math.max(0, (this.hurtCd || 0) - dt);

    if (!this.alive) {
      this.spectate(dt, []);
      return;
    }

    const walking = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const speed = this.speed * (walking ? this.walkMul : 1) * (this.onGround ? 1 : 0.85);
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const wish = new THREE.Vector3();
    if (this.keys.has("KeyW")) wish.add(forward);
    if (this.keys.has("KeyS")) wish.sub(forward);
    if (this.keys.has("KeyD")) wish.add(right);
    if (this.keys.has("KeyA")) wish.sub(right);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);

    this.vel.x = wish.x;
    this.vel.z = wish.z;
    this.vel.y -= this.gravity * dt;
    if (this.onGround && this.keys.has("Space")) {
      this.vel.y = this.jump;
      this.onGround = false;
    }

    this.pos.x += this.vel.x * dt;
    this.world.collide(this.pos, this.radius, this.height);
    this.pos.z += this.vel.z * dt;
    this.world.collide(this.pos, this.radius, this.height);
    this.pos.y += this.vel.y * dt;
    const grounded = this.world.collide(this.pos, this.radius, this.height);
    if (grounded && this.vel.y <= 0) {
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.onGround = grounded;
    }

    // Fall through dug-out floor into the void (Match.checkVoids handles the death).

    this.camera.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
    this.camera.updateMatrixWorld();
    if (this.viewmodel) this.viewmodel.visible = true;
    this.updateViewmodel(dt);
  }

  cycleSpectate() {
    this.spectateI += 1;
  }

  spectate(dt, friends) {
    if (this.viewmodel) this.viewmodel.visible = false;
    this.updateViewmodel(dt);
    const living = friends.filter((b) => b.alive);
    const tap = this.keys.has("Space") || this.keys.has("KeyE");
    if (tap && !this._specTap) {
      this.spectateI += 1;
      this._specTap = true;
    }
    if (!tap) this._specTap = false;

    if (living.length > 0) {
      const bot = living[Math.abs(this.spectateI) % living.length];
      const behind = new THREE.Vector3(Math.sin(bot.yaw), 0, Math.cos(bot.yaw));
      this.camera.position.set(bot.pos.x - behind.x * 2.4, bot.pos.y + 2.15, bot.pos.z - behind.z * 2.4);
      this.camera.lookAt(bot.headPos());
      this.spectateName = bot.name;
      return this.spectateName;
    }

    this.camera.position.set(this.pos.x, this.pos.y + 1.85, this.pos.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.camera.rotation.z = 0;
    this.spectateName = "";
    return "";
  }

  barrelWorld() {
    const tip = new THREE.Vector3(0.18, -0.14, -1.02);
    tip.applyMatrix4(this.camera.matrixWorld);
    return tip;
  }

  kickGun() {
    this.kick = 1;
    if (!this.viewmodel) return;
    this.viewmodel.rotation.x = -0.14;
    this.viewmodel.position.z = 0.06;
    this.viewmodel.position.y = 0.025;
    const flash = this.viewmodel.userData.flash;
    if (flash) {
      flash.visible = true;
      flash.rotation.z = Math.random() * Math.PI;
      flash.scale.setScalar(0.85 + Math.random() * 0.4);
    }
  }

  updateViewmodel(dt) {
    if (!this.viewmodel) return;
    this.kick = Math.max(0, this.kick - dt * 9);
    this.viewmodel.rotation.x *= Math.pow(0.0004, dt);
    this.viewmodel.position.z *= Math.pow(0.0004, dt);
    this.viewmodel.position.y *= Math.pow(0.0004, dt);
    const flash = this.viewmodel.userData.flash;
    if (flash) flash.visible = this.kick > 0.62;
    const c4 = this.viewmodel.userData.c4;
    if (c4) c4.visible = this.alive && this.hasBomb;
    const rpg = this.viewmodel.userData.rpg;
    const rifle = this.viewmodel.userData.rifle;
    const showRpg = this.alive && this.weapon === "rocket" && this.hasRocket;
    if (rpg) rpg.visible = showRpg;
    if (rifle) for (const p of rifle) p.visible = !showRpg;
  }

  damage(amount) {
    if (!this.alive) return false;
    if ((this.hurtCd || 0) > 0) return false;
    this.hurtCd = 0.4;
    let remaining = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, remaining * 0.5);
      this.armor = Math.max(0, this.armor - absorbed * 1.4);
      remaining -= absorbed;
    }
    this.health = Math.max(0, this.health - remaining);
    if (this.health <= 0) {
      this.alive = false;
      this.health = 0;
      return true;
    }
    return false;
  }
}

export function createViewmodel(camera) {
  const group = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x6b4220 });
  const metal = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.55), metal);
  body.position.set(0.18, -0.18, -0.45);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.22), wood);
  stock.position.set(0.18, -0.2, -0.18);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.38), dark);
  barrel.position.set(0.18, -0.14, -0.82);
  const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), metal);
  mag.position.set(0.18, -0.3, -0.42);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshLambertMaterial({ color: 0xc4a07a }));
  hand.position.set(0.12, -0.28, -0.36);

  const flash = new THREE.Group();
  const flashCore = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xfff4b0, fog: false, transparent: true, opacity: 1, depthWrite: false })
  );
  const flashX = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.045, 0.045),
    new THREE.MeshBasicMaterial({ color: 0xffc24a, fog: false, transparent: true, opacity: 0.95, depthWrite: false })
  );
  const flashY = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.28, 0.045),
    new THREE.MeshBasicMaterial({ color: 0xffc24a, fog: false, transparent: true, opacity: 0.95, depthWrite: false })
  );
  const flashZ = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.045, 0.22),
    new THREE.MeshBasicMaterial({ color: 0xff7a1a, fog: false, transparent: true, opacity: 0.9, depthWrite: false })
  );
  flash.add(flashCore, flashX, flashY, flashZ);
  flash.position.set(0.18, -0.14, -1.02);
  flash.visible = false;

  const c4 = createC4(0.42);
  c4.position.set(-0.24, -0.22, -0.4);
  c4.rotation.set(0.25, 0.7, 0.15);
  c4.visible = false;

  const rpg = createRocketViewmodel();

  group.add(body, stock, barrel, mag, hand, flash, c4, rpg);
  group.userData.flash = flash;
  group.userData.c4 = c4;
  group.userData.rpg = rpg;
  group.userData.rifle = [body, stock, barrel, mag];
  camera.add(group);
  return group;
}
