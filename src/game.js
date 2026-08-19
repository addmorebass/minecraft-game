import * as THREE from "three";
import { SITES } from "./map.js";
import { ShotFX } from "./fx.js";
import { createC4, pulseC4, createSiteMarker, createBeacon } from "./props.js";
import { PickupManager, RocketSpawner } from "./pickups.js";
import { createRocketProjectile } from "./props.js";
import { WEAPONS } from "./player.js";
import { Horde } from "./zombies.js";

const SITE_MARK = {
  A: { x: (SITES.A.x0 + SITES.A.x1) / 2, z: (SITES.A.z0 + SITES.A.z1) / 2 },
  B: { x: (SITES.B.x0 + SITES.B.x1) / 2, z: (SITES.B.z0 + SITES.B.z1) / 2 },
};

const ROUND_TIME = 115;
const PLANT_TIME = 3.2;
const DEFUSE_TIME = 5.2;
const BOMB_TIME = 40;
const WIN_SCORE = 7;
export const ROUNDS_PER_HALF = 6;
export const MAX_ROUNDS = 12;

function emptyStats() {
  return { kills: 0, deaths: 0, plants: 0, defuses: 0, zombies: 0 };
}

export class Match {
  constructor(world, player, bots, audio, ui) {
    this.world = world;
    this.player = player;
    this.bots = bots;
    this.audio = audio;
    this.ui = ui;
    this.round = 1;
    this.score = { T: 0, CT: 0 };
    this.time = ROUND_TIME;
    this.phase = "live"; // live | planted | over
    this.bomb = {
      planted: false,
      site: null,
      pos: null,
      timer: 0,
      planting: 0,
      defusing: 0,
      botDefuse: 0,
      mesh: null,
      loose: false,
      looseMesh: null,
    };
    this.half = 1;
    this.swapping = false;
    this.bannerT = 0;
    this.freeze = 0;
    this.tracers = [];
    this.muzzle = 0;
    this.fx = null;
    this.pickups = null;
    this.markers = [];
    this.rocketPad = null;
    this.rockets = [];
    this.horde = null;
    this.awakenT = 0;
    this.forceMatchEnd = false;
    this.lastResult = null;
    this.stats = emptyStats();
    this.pendingRespawn = 0;
    this.playerSpawn = { x: 46.5, y: 2.01, z: 104.5 };
    this.playerYaw = 0;
    this.spawns = null;
    this.needLock = false;
  }

  startRound(spawns, scene) {
    this.phase = "live";
    this.time = ROUND_TIME;
    this.freeze = 1.2;
    this.bomb.planted = false;
    this.bomb.site = null;
    this.bomb.timer = 0;
    this.bomb.planting = 0;
    this.bomb.defusing = 0;
    this.bomb.botDefuse = 0;
    this.bomb.loose = false;
    if (this.bomb.mesh) {
      scene.remove(this.bomb.mesh);
      this.bomb.mesh = null;
    }
    if (this.bomb.looseMesh) {
      scene.remove(this.bomb.looseMesh);
      this.bomb.looseMesh = null;
    }

    const team = this.player.team;
    const spots = team === "T" ? spawns.T : spawns.CT;
    const yaw = team === "T" ? 0 : Math.PI;
    this.spawns = spawns;
    this.playerSpawn = spots[0];
    this.playerYaw = yaw;
    this.pendingRespawn = 0;
    this.player.spawn(spots[0], yaw);
    this.player.hasBomb = team === "T";
    this.bots.respawn(spawns);
    this.bots.assignRoles(team);

    const obj = team === "T" ? "PLANT THE BOMB at A or B" : "STOP THE PLANT — hold sites, defuse if needed";
    this.ui.setBanner((this.half === 1 ? "1ST HALF" : "2ND HALF") + "\n" + obj);
    this.bannerT = 2.6;
    this.ui.setDeath(false);
    this.ensureWorldProps(scene);
    if (this.pickups) this.pickups.reset();
    if (this.rocketPad) this.rocketPad.reset();
    this.player.hasRocket = false;
    delete this.player.loadout.rocket;
    for (const b of this.bots.bots) {
      b.hasRocket = false;
      b.rocketAmmo = 0;
    }
    this.clearRockets(scene);
    this.lastResult = null;
    if (this.horde) this.horde.beginRound();
    this.ui.hideResults();
    if (this.player.viewmodel?.userData.c4) this.player.viewmodel.userData.c4.visible = this.player.hasBomb;
    this.bannerT = 5;
    this.ui.update(this);
  }

  ensureWorldProps(scene) {
    if (!this.pickups) this.pickups = new PickupManager(scene);
    if (!this.bomb.carryMesh) {
      this.bomb.carryMesh = createC4(1.15);
      this.bomb.beacon = createBeacon();
      this.bomb.carryMesh.add(this.bomb.beacon);
      scene.add(this.bomb.carryMesh);
    }
    if (this.markers.length === 0) {
      const a = createSiteMarker("A", SITE_MARK.A.x, SITE_MARK.A.z, "#f0d27a");
      const b = createSiteMarker("B", SITE_MARK.B.x, SITE_MARK.B.z, "#f0d27a");
      scene.add(a, b);
      this.markers.push(a, b);
    }
    if (!this.rocketPad) this.rocketPad = new RocketSpawner(scene);
    if (!this.horde) this.horde = new Horde(scene);
  }

  swapSides(spawns, scene) {
    this.half = 2;
    const tScore = this.score.T;
    this.score.T = this.score.CT;
    this.score.CT = tScore;
    this.player.team = this.player.team === "T" ? "CT" : "T";
    this.bots.spawnAll(this.player.team, spawns);
    this.startRound(spawns, scene);
    const you = this.player.team === "T" ? "TERRORIST" : "COUNTER-TERRORIST";
    this.ui.setBanner("SIDES SWAPPED\nYou are now " + you);
    this.bannerT = 3.4;
  }

  inSite(pos) {
    for (const [name, s] of Object.entries(SITES)) {
      if (pos.x >= s.x0 && pos.x <= s.x1 && pos.z >= s.z0 && pos.z <= s.z1) return name;
    }
    return null;
  }

  update(dt, scene, shooting) {
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.ui.setBanner("");
    }
    if (this.freeze > 0) this.freeze -= dt;

    if (this.phase !== "over") {
      this.time -= dt;
      if (this.phase === "live" && this.time <= 0) this.endRound("CT", "Time expired — CTs win");
      if (this.phase === "planted") {
        this.bomb.timer -= dt;
        if (Math.floor(this.bomb.timer * 2) !== Math.floor((this.bomb.timer + dt) * 2)) this.audio.bombTick();
        if (this.bomb.timer <= 0) this.explode(scene);
      }
    }

    if (this.awakenT > 0) {
      this.awakenT -= dt;
      if (this.awakenT <= 0) this.triggerHorde(scene);
    }
    this.foreshadowTunnels(dt);
    this.tickRespawn(dt);

    this.handleBomb(dt, scene);
    this.resolveShots(shooting, scene);
    this.updateRockets(dt, scene);
    if (this.horde) {
      this.horde.update(dt, this.world, this.player, this.bots.bots, this.audio, (prey) => {
        this.zombieMelee(prey, scene);
      }, this.freeze);
    }
    this.checkVoids(scene);
    this.checkElims();
    this.updateTracers(dt, scene);
    this.syncBombVisual(scene, dt);
    if (this.pickups) {
      this.pickups.update(dt, this.player, this.bots.bots, this.audio, (kind) => {
        this.ui.killfeed(kind === "health" ? "+40 HP" : "+50 SHIELD", "picked up", this.player.team);
      });
    }
    if (this.rocketPad) {
      this.rocketPad.update(dt, this.player, this.bots.bots, (who, name) => {
        this.ui.killfeed(name, "got the RPG", who.team || this.player.team);
        this.audio.tone(180, 0.12, "sawtooth", 0.06, 80);
      });
    }
    this.ui.update(this);
  }

  offerRespawn() {
    if (this.phase === "over") return;
    this.pendingRespawn = 4;
  }

  tickRespawn(dt) {
    if (this.pendingRespawn <= 0) return;
    if (this.phase === "over") {
      this.pendingRespawn = 0;
      return;
    }
    this.pendingRespawn -= dt;
    this.ui.setRespawn(Math.max(0, this.pendingRespawn));
    if (this.pendingRespawn <= 0) this.respawnPlayer();
  }

  respawnPlayer() {
    if (this.phase === "over" || this.player.alive) return;
    const spots = this.spawns
      ? this.player.team === "T"
        ? this.spawns.T
        : this.spawns.CT
      : [this.playerSpawn];
    this.player.spawn(spots[0] || this.playerSpawn, this.playerYaw);
    this.player.hasBomb = false;
    this.player.hurtCd = 1.5;
    this.pendingRespawn = 0;
    this.needLock = true;
    this.ui.setDeath(false);
    if (this.player.viewmodel) this.player.viewmodel.visible = true;
  }

  ensureFx(scene) {
    if (!this.fx) this.fx = new ShotFX(scene);
    return this.fx;
  }

  handleBomb(dt, scene) {
    const p = this.player;
    const holding = p.keys.has("KeyE");
    const site = this.inSite(p.pos);

    if (this.bomb.loose && this.bomb.pos) {
      if (p.alive && p.team === "T" && this.nearBomb(p.pos) && (holding || p.pos.distanceTo(this.bomb.pos) < 1.15)) {
        this.pickupBomb(p, null, scene);
      }
      for (const b of this.bots.bots) {
        if (!b.alive || b.team !== "T") continue;
        if (this.bomb.pos && b.pos.distanceTo(this.bomb.pos) < 1.4) {
          this.pickupBomb(null, b, scene);
          break;
        }
      }
    }

    if (this.phase === "live" && p.alive && p.hasBomb && site && holding) {
      this.bomb.planting += dt;
      this.ui.bombBar(true, "Planting " + site, this.bomb.planting / PLANT_TIME);
      if (Math.floor(this.bomb.planting * 4) !== Math.floor((this.bomb.planting - dt) * 4)) this.audio.plantBeep();
      if (this.bomb.planting >= PLANT_TIME) this.plant(site, p.pos, scene);
    } else if (this.phase === "planted" && p.alive && p.team === "CT" && this.nearBomb(p.pos) && holding) {
      this.bomb.defusing += dt;
      this.ui.bombBar(true, "Defusing", this.bomb.defusing / DEFUSE_TIME);
      if (this.bomb.defusing >= DEFUSE_TIME) this.defuse();
    } else if (!(this.phase === "live" && p.alive && p.hasBomb && site && holding)) {
      this.bomb.planting = 0;
      if (!(this.phase === "planted" && p.alive && p.team === "CT" && this.nearBomb(p.pos) && holding)) {
        this.bomb.defusing = 0;
        if (this.phase !== "planted") this.ui.bombBar(false);
      }
    }

    if (this.phase === "live") {
      for (const b of this.bots.bots) {
        if (!b.alive || !b.hasBomb) continue;
        const s = this.inSite(b.pos);
        if (s) {
          b.plantProg += dt * (this.bots.profile?.plantSpeed || 1);
          if (b.plantProg >= PLANT_TIME) this.plant(s, b.pos, scene);
        } else b.plantProg = 0;
      }
    }

    if (this.phase === "planted") {
      let botOn = false;
      for (const b of this.bots.bots) {
        if (!b.alive || b.team !== "CT") continue;
        if (this.nearBomb(b.pos)) {
          botOn = true;
          this.bomb.botDefuse += dt * (this.bots.profile?.defuseSpeed || 1);
          if (this.bomb.botDefuse >= DEFUSE_TIME) this.defuse();
          break;
        }
      }
      if (!botOn) this.bomb.botDefuse = 0;
    }
  }

  makeBombMesh(pos) {
    const mesh = createC4(1.2);
    mesh.position.set(pos.x, pos.y + 0.28, pos.z);
    return mesh;
  }

  dropBomb(pos, scene) {
    this.player.hasBomb = false;
    for (const b of this.bots.bots) b.hasBomb = false;
    this.bomb.loose = true;
    this.bomb.pos = pos.clone();
    if (this.bomb.looseMesh) scene.remove(this.bomb.looseMesh);
    this.bomb.looseMesh = this.makeBombMesh(pos);
    scene.add(this.bomb.looseMesh);
    this.ui.killfeed("BOMB", "dropped — pick it up", "T");
  }

  syncBombVisual(scene, dt) {
    this.ensureWorldProps(scene);
    const vis = this.bomb.carryMesh;
    const beacon = this.bomb.beacon;
    if (!vis) return;
    const t = performance.now() * 0.001;
    pulseC4(vis, t);
    for (const m of this.markers) {
      if (m.userData.billboard) m.userData.billboard.lookAt(this.player.camera.position);
    }

    if (this.bomb.planted && this.bomb.pos) {
      vis.visible = true;
      vis.position.copy(this.bomb.pos);
      vis.position.y = this.bomb.pos.y + 0.3;
      vis.scale.setScalar(1.45);
      if (beacon) beacon.visible = true;
      if (this.bomb.mesh) this.bomb.mesh.visible = false;
      if (this.bomb.looseMesh) this.bomb.looseMesh.visible = false;
    } else if (this.bomb.loose && this.bomb.pos) {
      vis.visible = true;
      vis.position.set(this.bomb.pos.x, this.bomb.pos.y + 0.4 + Math.sin(t * 3) * 0.1, this.bomb.pos.z);
      vis.rotation.y += dt * 1.4;
      vis.scale.setScalar(1.35);
      if (beacon) beacon.visible = true;
      if (this.bomb.looseMesh) this.bomb.looseMesh.visible = false;
    } else if (this.player.hasBomb && this.player.alive) {
      vis.visible = false;
      if (beacon) beacon.visible = false;
    } else {
      const carrier = this.bots.bots.find((b) => b.alive && b.hasBomb);
      if (carrier) {
        vis.visible = true;
        vis.position.set(carrier.pos.x, carrier.pos.y + 1.58, carrier.pos.z);
        vis.rotation.y = carrier.yaw;
        vis.scale.setScalar(0.8);
        if (beacon) beacon.visible = false;
        this.bomb.pos = carrier.pos.clone();
      } else {
        vis.visible = false;
        if (beacon) beacon.visible = false;
      }
    }
  }

  pickupBomb(player, bot, scene) {
    this.bomb.loose = false;
    if (this.bomb.looseMesh) {
      scene.remove(this.bomb.looseMesh);
      this.bomb.looseMesh = null;
    }
    if (player) player.hasBomb = true;
    if (bot) {
      bot.hasBomb = true;
      bot.role = "bomber";
    }
    this.audio.plantBeep();
  }

  nearBomb(pos) {
    if (!this.bomb.pos) return false;
    return pos.distanceTo(this.bomb.pos) < 2.2;
  }

  plant(site, pos, scene) {
    const youPlanted = this.player.hasBomb;
    this.phase = "planted";
    this.bomb.planted = true;
    this.bomb.site = site;
    this.bomb.pos = pos.clone();
    this.bomb.timer = BOMB_TIME;
    this.player.hasBomb = false;
    for (const b of this.bots.bots) b.hasBomb = false;
    this.bomb.loose = false;
    if (this.bomb.looseMesh) {
      scene.remove(this.bomb.looseMesh);
      this.bomb.looseMesh = null;
    }
    this.time = BOMB_TIME;
    this.bomb.mesh = this.makeBombMesh(pos);
    scene.add(this.bomb.mesh);
    this.audio.plantBeep();
    this.ui.setBanner("BOMB PLANTED — " + site + "\nDefend it until it explodes");
    this.bannerT = 5;
    this.ui.killfeed("BOMB", "planted at " + site, "T");
    if (youPlanted) this.stats.plants += 1;
    this.scheduleHorde("plant");
  }

  defuse() {
    if (this.player.team === "CT" && this.bomb.defusing > 0) this.stats.defuses += 1;
    this.forceMatchEnd = true;
    this.endRound("CT", "Bomb defused");
  }

  explode(scene) {
    this.audio.explode();
    if (this.bomb.mesh) this.bomb.mesh.material.color.set(0xff4400);
    this.forceMatchEnd = true;
    this.endRound("T", "Bomb exploded");
  }

  resolveShots(shots, scene) {
    const fx = this.ensureFx(scene);
    for (const shot of shots) {
      if (shot.dry) continue;
      const { origin, dir, def, from } = shot;
      const team = from === "player" ? this.player.team : shot.bot.team;
      if (def.projectile || shot.projectile) {
        const start = from === "player" ? this.player.barrelWorld() : origin.clone();
        this.spawnRocket(scene, start, dir, team, from === "player" ? this.player : shot.bot);
        if (from === "player") {
          this.player.kickGun();
          this.ui.shotFlash();
        }
        this.audio.rocket();
        continue;
      }
      const wall = this.world.raycast(origin, dir, def.range);
      const wallDist = wall ? wall.dist : def.range;
      const tracerColor = team === "T" ? 0xff8a1a : 0xffe566;

      if (from === "player") {
        const hit = this.bots.hitTest(origin, dir, wallDist, team);
        const dist = hit ? hit.dist : wallDist;
        const end = origin.clone().addScaledVector(dir, Math.max(0.45, dist));
        const start = this.player.barrelWorld();
        this.addTracer(scene, origin, dir, dist);
        fx.tracer(start, end, tracerColor);
        fx.muzzle(start, tracerColor);
        this.player.kickGun();
        this.ui.shotFlash();
        this.scareBots(origin, dir, wallDist, team);
        const zHit = this.horde?.hitTest(origin, dir, wallDist);
        if (hit && (!zHit || hit.dist <= zHit.dist)) {
          const dmg = def.damage * (hit.part === "head" ? def.headMul : 1);
          const dead = this.hurtBot(hit.bot, dmg, scene);
          fx.impact(hit.point, dir.clone().negate().normalize(), "blood");
          this.ui.hitmarker(dead);
          this.audio.hit();
          if (dead) {
            this.stats.kills += 1;
            this.ui.killfeed(this.playerName(), hit.bot.name, team);
          }
        } else if (zHit) {
          const dmg = def.damage * (zHit.part === "head" ? def.headMul : 1);
          const dead = zHit.zombie.hurt(dmg);
          fx.impact(zHit.point, dir.clone().negate().normalize(), "blood");
          this.ui.hitmarker(dead);
          this.audio.hit();
          if (dead) {
            this.stats.zombies += 1;
            this.ui.killfeed(this.playerName(), "Zombie", team);
          }
        } else if (wall) {
          fx.impact(end, wall.face.clone(), "sand");
          this.carveHit(wall, fx);
        }
      } else {
        const p = this.player;
        const botHit = this.bots.hitTest(origin, dir, wallDist, team);
        let dist = wallDist;
        let hitPlayer = false;
        let hitBot = false;
        let closest = origin.clone().addScaledVector(dir, wallDist);
        if (p.alive && p.team !== team) {
          const to = p.eyePos().sub(origin);
          const t = to.dot(dir);
          if (t > 0 && t < wallDist) {
            const at = origin.clone().addScaledVector(dir, t);
            if (at.distanceTo(p.eyePos()) < 0.35 || at.distanceTo(p.pos.clone().setY(p.pos.y + 1)) < 0.4) {
              hitPlayer = true;
              dist = t;
              closest = at;
            }
          }
        }
        const zHit = this.horde?.hitTest(origin, dir, wallDist);
        let hitZombie = false;
        const playerDist = hitPlayer ? dist : Infinity;
        const botDist = botHit ? botHit.dist : Infinity;
        const zedDist = zHit ? zHit.dist : Infinity;
        if (zHit && zedDist <= botDist && zedDist <= playerDist) {
          hitPlayer = false;
          hitZombie = true;
          dist = zHit.dist;
          closest = zHit.point;
          const dmg = def.damage * (zHit.part === "head" ? def.headMul : 1);
          const dead = zHit.zombie.hurt(dmg);
          if (dead) this.ui.killfeed(shot.bot.name, "Zombie", team);
        } else if (botHit && botDist <= playerDist) {
          hitPlayer = false;
          hitBot = true;
          dist = botHit.dist;
          closest = botHit.point;
          const dmg = def.damage * (botHit.part === "head" ? def.headMul : 1);
          const dead = this.hurtBot(botHit.bot, dmg, scene);
          if (dead) this.ui.killfeed(shot.bot.name, botHit.bot.name, team);
        } else if (hitPlayer) {
          const head = closest.y > p.pos.y + 1.4;
          const dead = p.damage(def.damage * (head ? 1.6 : 1) * 0.38);
          this.ui.hurt();
          this.audio.hurt();
          if (dead) {
            if (p.hasBomb) this.dropBomb(p.pos, scene);
            if (p.hasRocket) this.dropRocket(p.pos);
            this.stats.deaths += 1;
            this.ui.setDeath(true, shot.bot.name);
            this.offerRespawn();
            this.ui.killfeed(shot.bot.name, this.playerName(), team);
          }
        }
        const end = origin.clone().addScaledVector(dir, Math.max(0.45, dist));
        this.addTracer(scene, origin, dir, dist);
        fx.tracer(origin, end, tracerColor);
        fx.muzzle(origin.clone().addScaledVector(dir, 0.4), tracerColor);
        if (hitPlayer || hitBot || hitZombie) fx.impact(closest, dir.clone().negate().normalize(), "blood");
        else if (wall) {
          fx.impact(end, wall.face.clone(), "sand");
          this.carveHit(wall, fx);
        }
      }
    }
  }

  carveHit(wall, fx) {
    const t = this.world.breakBlock(wall.x, wall.y, wall.z);
    let extra = 0;
    const floorShot = wall.face && wall.face.y > 0.55;
    if (floorShot) {
      // Same layer only — leave the block under this one so it takes two layers to void someone.
      extra += this.world.breakBlock(wall.x + 1, wall.y, wall.z) ? 1 : 0;
      extra += this.world.breakBlock(wall.x, wall.y, wall.z + 1) ? 1 : 0;
      extra += this.world.breakBlock(wall.x + 1, wall.y, wall.z + 1) ? 1 : 0;
    } else if (wall.y >= 3) {
      // Standing-height shots open a 2-block door so you can walk the new route.
      extra = this.world.breakBlock(wall.x, wall.y - 1, wall.z);
    } else if (wall.y === 2) extra = this.world.breakBlock(wall.x, wall.y + 1, wall.z);
    if (!t && !extra) return;
    fx.rubble(new THREE.Vector3(wall.x + 0.5, wall.y + 0.5, wall.z + 0.5), 8, 0xd4b483);
    this.audio.crack();
    if (this.world.brokenCount >= 40) this.scheduleHorde("dig");
  }

  scheduleHorde(why) {
    if (this.horde?.awakened || this.awakenT > 0) return;
    this.awakenT = why === "dig" ? 2.2 : why === "plant" ? 4.2 : 1.6;
    this.awakenWhy = why;
  }

  triggerHorde(scene) {
    if (!this.horde) this.horde = new Horde(scene);
    if (!this.horde.awaken(scene)) return;
    this.audio.moan();
    this.audio.moan();
    const line =
      this.awakenWhy === "dig"
        ? "YOU DUG TOO DEEP"
        : "THE BOMB WOKE THE TUNNELS";
    if (this.phase !== "over") {
      this.ui.setBanner(line + "\nMinecraft dead hunt everyone");
      this.bannerT = 3.6;
    }
    this.ui.killfeed("HORDE", "the tunnels are waking", "T");
  }

  foreshadowTunnels(dt) {
    if (this.horde?.awakened || this.phase === "over") return;
    const z = this.world.zoneAt(this.player.pos.x, this.player.pos.z);
    if (!z || !z.includes("TUNNEL")) return;
    this._moanT = (this._moanT || 8) - dt;
    if (this._moanT <= 0) {
      this.audio.moan();
      this._moanT = 10 + Math.random() * 8;
    }
  }

  zombieMelee(prey, scene) {
    if (prey.kind === "player") {
      const p = this.player;
      if (!p.alive) return;
      const dead = p.damage(8);
      this.ui.hurt();
      this.audio.hurt();
      if (dead) {
        if (p.hasBomb) this.dropBomb(p.pos, scene);
        if (p.hasRocket) this.dropRocket(p.pos);
        this.stats.deaths += 1;
        this.ui.setDeath(true, "a zombie");
        this.offerRespawn();
        this.ui.killfeed("Zombie", this.playerName(), "T");
      }
    } else if (prey.ref) {
      const dead = this.hurtBot(prey.ref, 22, scene);
      if (dead) this.ui.killfeed("Zombie", prey.ref.name, "T");
    }
  }

  resetHorde(scene) {
    this.awakenT = 0;
    this.awakenWhy = null;
    this.world.brokenCount = 0;
    if (this.horde) this.horde.resetAll(scene);
  }

  scareBots(origin, dir, maxDist, shooterTeam) {
    for (const b of this.bots.bots) {
      if (!b.alive || b.team === shooterTeam) continue;
      const to = b.chestPos().sub(origin);
      const t = to.dot(dir);
      if (t < 0 || t > maxDist) continue;
      const closest = origin.clone().addScaledVector(dir, t);
      if (closest.distanceTo(b.chestPos()) < 1.6) {
        b.panic = Math.max(b.panic, 1.15);
        b.strafe *= -1;
        b.dodgeT = 0.08;
        b.backT = 0.2;
      }
    }
  }

  checkVoids(scene) {
    const VOID_Y = -8;
    const p = this.player;
    if (p.alive && p.pos.y < VOID_Y) {
      p.alive = false;
      p.health = 0;
      if (p.hasBomb) this.dropBomb(p.pos, scene);
      if (p.hasRocket) this.dropRocket(p.pos);
      this.stats.deaths += 1;
      this.ui.setDeath(true, "the void");
      this.offerRespawn();
      this.ui.killfeed("the void", this.playerName(), "T");
    }
    for (const b of this.bots.bots) {
      if (!b.alive || b.pos.y >= VOID_Y) continue;
      const dead = this.hurtBot(b, 9999, scene);
      if (!dead) continue;
      this.ui.killfeed("the void", b.name, this.player.team);
      if (b.team !== this.player.team) this.stats.kills += 1;
    }
    if (!this.horde) return;
    for (const z of this.horde.zombies) {
      if (!z.alive || z.pos.y >= VOID_Y) continue;
      if (!z.hurt(9999)) continue;
      this.stats.zombies += 1;
      this.ui.killfeed("the void", "Zombie", this.player.team);
    }
  }

  hurtBot(bot, dmg, scene) {
    bot.health -= dmg;
    bot.panic = 1.5;
    bot.strafe *= -1;
    bot.dodgeT = 0.05;
    bot.backT = 0.25;
    if (bot.health <= 0) {
      bot.health = 0;
      bot.alive = false;
      bot.hide();
      if (bot.hasBomb && scene) this.dropBomb(bot.pos, scene);
      if (bot.hasRocket) this.dropRocket(bot.pos);
      return true;
    }
    return false;
  }

  playerName() {
    return this.player.team === "T" ? "You" : "You";
  }

  checkElims() {
    if (this.phase === "over") return;
    const youIn = this.player.alive || this.pendingRespawn > 0;
    const tAlive = this.bots.living("T").length + (youIn && this.player.team === "T" ? 1 : 0);
    const ctAlive = this.bots.living("CT").length + (youIn && this.player.team === "CT" ? 1 : 0);
    if (tAlive === 0 && ctAlive === 0) {
      this.phase = "over";
      this.forceMatchEnd = true;
      this.lastResult = { winner: null, reason: "Nobody left alive", title: "THE DEAD TAKE DUST" };
      this.ui.setBanner("THE DEAD TAKE DUST\nNobody left alive");
      this.bannerT = 3.4;
      this.audio.lose();
      this.ui.update(this);
      return;
    }
    if (tAlive === 0 && this.phase === "live") this.endRound("CT", "Terrorists eliminated");
    if (ctAlive === 0) this.endRound("T", this.phase === "planted" ? "CTs eliminated — bomb down" : "Counter-Terrorists eliminated");
  }

  endRound(winner, reason) {
    if (this.phase === "over") return;
    this.phase = "over";
    this.score[winner] += 1;
    this.lastResult = {
      winner,
      reason,
      title: winner === "T" ? "TERRORISTS WIN" : "COUNTER-TERRORISTS WIN",
    };
    this.ui.setBanner((winner === "T" ? "TERRORISTS WIN" : "COUNTER-TERRORISTS WIN") + "\n" + reason);
    this.bannerT = 3.4;
    if (winner === this.player.team) this.audio.win();
    else this.audio.lose();
    this.ui.update(this);
  }

  addTracer(scene, origin, dir, dist) {
    const end = origin.clone().addScaledVector(dir, Math.max(0.4, dist));
    const geo = new THREE.BufferGeometry().setFromPoints([origin.clone(), end]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 1, fog: false })
    );
    scene.add(line);
    this.tracers.push({ line, t: 0.18 });
  }

  updateTracers(dt, scene) {
    if (this.fx) this.fx.update(dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      this.tracers[i].t -= dt;
      const k = Math.max(0, this.tracers[i].t / 0.18);
      if (this.tracers[i].line.material) this.tracers[i].line.material.opacity = k;
      if (this.tracers[i].t <= 0) {
        scene.remove(this.tracers[i].line);
        this.tracers[i].line.geometry.dispose();
        this.tracers[i].line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }

  wonMatch() {
    return (
      this.forceMatchEnd ||
      this.score.T >= WIN_SCORE ||
      this.score.CT >= WIN_SCORE ||
      this.round >= MAX_ROUNDS
    );
  }

  resetMatch() {
    this.score = { T: 0, CT: 0 };
    this.round = 1;
    this.half = 1;
    this.forceMatchEnd = false;
    this.lastResult = null;
    this.stats = emptyStats();
    this.awakenT = 0;
    this.world.brokenCount = 0;
    this.pendingRespawn = 0;
    this.needLock = false;
  }

  shouldSwapSides() {
    return this.round === ROUNDS_PER_HALF && this.half === 1;
  }

  intel() {
    const pad = this.rocketPad;
    return {
      planted: this.bomb.planted,
      plantSite: this.bomb.site,
      bombPos: this.bomb.pos,
      loose: this.bomb.loose,
      rocket: pad
        ? {
            available: pad.available(),
            pos: pad.worldPos(),
          }
        : null,
      zombies: this.horde ? this.horde.living() : [],
      hordeOn: !!this.horde?.awakened,
    };
  }

  spawnRocket(scene, origin, dir, team, owner) {
    const mesh = createRocketProjectile();
    mesh.position.copy(origin);
    mesh.lookAt(origin.clone().add(dir));
    scene.add(mesh);
    this.rockets.push({
      mesh,
      pos: origin.clone(),
      dir: dir.clone().normalize(),
      team,
      owner,
      life: 2.4,
    });
  }

  updateRockets(dt, scene) {
    const speed = WEAPONS.rocket.speed;
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i];
      r.life -= dt;
      const next = r.pos.clone().addScaledVector(r.dir, speed * dt);
      const wall = this.world.raycast(r.pos, r.dir, speed * dt + 0.15);
      let boom = r.life <= 0 || wall;
      let at = wall ? r.pos.clone().addScaledVector(r.dir, wall.dist) : next;
      if (!boom) {
        if (this.player.alive && this.player.team !== r.team && at.distanceTo(this.player.pos.clone().setY(this.player.pos.y + 1)) < 0.7) {
          boom = true;
          at = this.player.chest ? this.player.eyePos() : this.player.eyePos();
        }
        for (const b of this.bots.bots) {
          if (!b.alive || b.team === r.team) continue;
          if (at.distanceTo(b.chestPos()) < 0.7) {
            boom = true;
            at = b.chestPos();
            break;
          }
        }
        if (!boom && this.horde) {
          for (const z of this.horde.living()) {
            if (at.distanceTo(z.chestPos()) < 0.7) {
              boom = true;
              at = z.chestPos();
              break;
            }
          }
        }
      }
      if (boom) {
        this.rocketBurst(at, r, scene);
        scene.remove(r.mesh);
        this.rockets.splice(i, 1);
      } else {
        r.pos.copy(next);
        r.mesh.position.copy(next);
      }
    }
  }

  rocketBurst(at, rocket, scene) {
    const fx = this.ensureFx(scene);
    fx.impact(at, new THREE.Vector3(0, 1, 0), "sand");
    fx.muzzle(at, 0xff4400);
    this.audio.explode();
    const radius = WEAPONS.rocket.splash;
    const max = WEAPONS.rocket.damage;
    const hole = this.world.breakSphere(at.x, at.y, at.z, WEAPONS.rocket.breakRadius || 2.6);
    if (hole.length) {
      fx.rubble(at, Math.min(18, 8 + hole.length), 0xc4a574);
      this.audio.crack();
      if (this.world.brokenCount >= 40) this.scheduleHorde("dig");
    }
    if (this.horde) {
      for (const z of this.horde.living()) {
        const d = z.chestPos().distanceTo(at);
        if (d > radius) continue;
        const dead = z.hurt(max * (1 - d / radius));
        if (rocket.owner === this.player) this.ui.hitmarker(dead);
        if (dead) {
          if (rocket.owner === this.player) this.stats.zombies += 1;
          this.ui.killfeed("RPG", "Zombie", rocket.team);
        }
      }
    }
    const splash = (who, pos, isOwner, sameTeam) => {
      const d = pos.distanceTo(at);
      if (d > radius) return 0;
      let mul = 1 - d / radius;
      if (isOwner) mul *= 0.4;
      else if (sameTeam) mul *= 0.22;
      return max * mul;
    };
    const p = this.player;
    if (p.alive) {
      const owner = rocket.owner === p;
      const dmg = splash(p, p.eyePos(), owner, p.team === rocket.team);
      if (dmg > 4) {
        const dead = p.damage(dmg);
        if (!owner) {
          this.ui.hurt();
          this.audio.hurt();
        }
        if (dead) {
          if (p.hasBomb) this.dropBomb(p.pos, scene);
          if (p.hasRocket) this.dropRocket(p.pos);
          this.stats.deaths += 1;
          this.ui.setDeath(true, "RPG");
          this.offerRespawn();
          this.ui.killfeed("RPG", this.playerName(), rocket.team);
        } else if (rocket.owner === p || rocket.team !== p.team) this.ui.hitmarker(false);
      }
    }
    for (const b of this.bots.bots) {
      if (!b.alive) continue;
      const owner = rocket.owner === b;
      const dmg = splash(b, b.chestPos(), owner, b.team === rocket.team);
      if (dmg <= 4) continue;
      const dead = this.hurtBot(b, dmg, scene);
      if (rocket.owner === this.player && b.team !== this.player.team) this.ui.hitmarker(dead);
      if (dead) {
        if (rocket.owner === this.player && b.team !== this.player.team) this.stats.kills += 1;
        this.ui.killfeed("RPG", b.name, rocket.team);
      }
    }
  }

  dropRocket(pos) {
    if (this.player.hasRocket) {
      this.player.hasRocket = false;
      if (this.player.weapon === "rocket") this.player.weapon = "rifle";
    }
    for (const b of this.bots.bots) {
      b.hasRocket = false;
      b.rocketAmmo = 0;
    }
    if (this.rocketPad) this.rocketPad.dropAt(pos);
    this.ui.killfeed("RPG", "dropped", "T");
  }

  clearRockets(scene) {
    for (const r of this.rockets) scene.remove(r.mesh);
    this.rockets = [];
  }
}

export class UI {
  constructor() {
    this.lastCallout = "";
    this.resultsOpen = false;
    this.deathOpen = false;
  }

  showResults(match) {
    const el = document.getElementById("results");
    if (!el) return;
    const r = match.lastResult || { title: "ROUND OVER", reason: "", winner: null };
    const over = match.wonMatch();
    document.getElementById("results-kicker").textContent = over ? "MATCH OVER" : "ROUND OVER";
    document.getElementById("results-title").textContent = r.title || "ROUND OVER";
    document.getElementById("results-reason").textContent = r.reason || "";
    document.getElementById("results-score").textContent = "T  " + match.score.T + "  —  " + match.score.CT + "  CT";
    const s = match.stats;
    document.getElementById("stat-kills").textContent = s.kills;
    document.getElementById("stat-deaths").textContent = s.deaths;
    document.getElementById("stat-plants").textContent = s.plants;
    document.getElementById("stat-zombies").textContent = s.zombies;
    const next = document.getElementById("results-next");
    const restart = document.getElementById("results-restart");
    if (next) next.classList.toggle("hidden", over);
    if (restart) restart.textContent = over ? "Play Again" : "Restart";
    el.classList.remove("hidden");
    this.resultsOpen = true;
    this.setDeath(false);
  }

  hideResults() {
    const el = document.getElementById("results");
    if (el) el.classList.add("hidden");
    this.resultsOpen = false;
  }

  update(match) {
    const p = match.player;
    document.getElementById("health").textContent = Math.ceil(p.health);
    document.getElementById("armor").textContent = Math.ceil(p.armor);
    const ammo = p.ammo || { mag: 0, reserve: 0 };
    document.getElementById("mag").textContent = ammo.mag;
    document.getElementById("reserve").textContent = ammo.reserve;
    document.getElementById("gun-name").textContent =
      p.weapon === "rocket" ? (p.team === "T" ? "AK-47" : "M4A4") : p.gunName();
    const pistolSlot = document.querySelector('.slot[data-slot="2"] .slot-name');
    if (pistolSlot) pistolSlot.textContent = p.team === "T" ? "Glock" : "USP-S";
    document.getElementById("score-t").textContent = match.score.T;
    document.getElementById("score-ct").textContent = match.score.CT;
    const half = match.half === 1 ? "1st half" : "2nd half";
    document.getElementById("round-label").textContent = "Round " + match.round + " · " + half;
    const you = document.getElementById("side-you");
    if (you) {
      const ai = match.bots.profile?.label || "Normal";
      you.textContent = "You: " + p.team + " · AI " + ai;
    }
    const t = Math.max(0, match.time);
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60).toString().padStart(2, "0");
    document.getElementById("timer").textContent = `${m}:${s}`;
    document.getElementById("bomb-icon").classList.toggle("hidden", !p.hasBomb && !match.bomb.planted && !match.bomb.loose);
    document.getElementById("bomb-icon").textContent = match.bomb.planted ? "☢ PLANTED" : p.hasBomb ? "💣 YOU HAVE THE BOMB" : "💣 ON THE GROUND";

    const slot3 = document.querySelector('.slot[data-slot="3"]');
    if (slot3) slot3.classList.toggle("hidden", !p.hasRocket);

    const sel = p.weapon === "pistol" ? "2" : p.weapon === "rocket" ? "3" : "1";
    document.querySelectorAll(".slot").forEach((el) => {
      el.classList.toggle("selected", el.dataset.slot === sel);
    });

    const call = match.world.zoneAt(p.pos.x, p.pos.z);
    const el = document.getElementById("callout");
    if (call) {
      el.textContent = call;
      el.classList.add("show");
      this.lastCallout = call;
    }

    this.writeObjective(match);
  }

  writeObjective(match) {
    const p = match.player;
    const site = match.inSite(p.pos);
    const a = SITE_MARK.A;
    const b = SITE_MARK.B;
    const dist = (t) => Math.round(Math.hypot(t.x - p.pos.x, t.z - p.pos.z));
    const arrow = (t) => {
      const dx = t.x - p.pos.x;
      const dz = t.z - p.pos.z;
      const fx = -Math.sin(p.yaw);
      const fz = -Math.cos(p.yaw);
      let ang = Math.atan2(dx, dz) - Math.atan2(fx, fz);
      while (ang > Math.PI) ang -= Math.PI * 2;
      while (ang < -Math.PI) ang += Math.PI * 2;
      if (Math.abs(ang) < 0.55) return "↑";
      if (Math.abs(ang) > 2.5) return "↓";
      return ang > 0 ? "→" : "←";
    };
    const nav = `A ${arrow(a)} ${dist(a)}m    B ${arrow(b)} ${dist(b)}m`;

    const title = document.getElementById("obj-title");
    const body = document.getElementById("obj-body");
    const navEl = document.getElementById("obj-nav");
    const prompt = document.getElementById("prompt");
    if (!title || !body) return;

    let headline = p.team === "T" ? "TERRORIST" : "COUNTER-TERRORIST";
    let line = "";
    let promptText = "";

    if (match.phase === "planted") {
      const loc = match.bomb.site || "?";
      headline = "BOMB PLANTED AT " + loc;
      if (p.team === "CT") {
        line = "Get to " + loc + " and HOLD E on the blinking C4 to defuse.";
        if (site === loc) promptText = "HOLD E — DEFUSE";
      } else {
        line = "Defend the C4 at " + loc + " until it explodes.";
      }
    } else if (p.team === "T") {
      if (p.hasBomb) {
        headline = "YOU HAVE THE BOMB";
        line = "The C4 is on your left hip. Run to A or B (gold signs) and HOLD E.";
        if (site) promptText = "HOLD E — PLANT AT " + site;
      } else if (match.bomb.loose) {
        headline = "BOMB ON THE GROUND";
        line = "Find the blinking red C4 and walk over it to pick it up.";
        promptText = "WALK OVER THE BOMB";
      } else {
        headline = "HELP THE BOMBER";
        line = "A teammate has the C4 (on their back). Cover them to A or B.";
      }
    } else {
      headline = "STOP THE PLANT";
      line = "Hold A and B (gold signs). Kill the T with the C4 on their back. If they plant, HOLD E to defuse.";
    }

    if (match.rocketPad?.available() && !p.hasRocket) {
      line += (line ? " " : "") + "RPG is up at MID (Xbox) — fight for it.";
    } else if (p.hasRocket) {
      line += (line ? " " : "") + "You have the RPG (key 3).";
    }
    if (match.horde?.awakened) {
      line += (line ? " " : "") + "The dead hunt both teams. They crawl out of the tunnels.";
    }

    title.textContent = headline;
    body.textContent = line;
    if (navEl) navEl.textContent = nav;
    if (prompt) {
      prompt.classList.toggle("hidden", !promptText);
      prompt.textContent = promptText;
    }
  }

  bombBar(show, label, amt) {
    const bar = document.getElementById("bomb-bar");
    bar.classList.toggle("hidden", !show);
    if (show) {
      document.getElementById("bomb-action").textContent = label;
      document.getElementById("bomb-fill").style.width = `${Math.min(100, amt * 100)}%`;
    }
  }

  setBanner(text) {
    const el = document.getElementById("round-banner");
    if (!text) {
      el.classList.add("hidden");
      el.textContent = "";
      return;
    }
    el.classList.remove("hidden");
    el.innerHTML = text.replace("\n", "<br>");
  }

  setDeath(on, killer) {
    const el = document.getElementById("death-overlay");
    el.classList.toggle("hidden", !on);
    this.deathOpen = !!on;
    if (!on) return;
    document.getElementById("death-text").textContent = killer ? `Killed by ${killer}` : "You died";
    document.getElementById("death-sub").textContent = "Respawning at your spawn";
    const hint = document.getElementById("death-hint");
    if (hint) hint.textContent = "Space spectates a teammate until you come back";
    this.setRespawn(4);
  }

  setRespawn(secs) {
    const el = document.getElementById("death-respawn");
    if (!el) return;
    el.textContent = secs > 0 ? "Back in " + Math.ceil(secs) + "…" : "";
  }

  setSpectate(name) {
    const hint = document.getElementById("death-hint");
    if (!hint) return;
    hint.textContent = name
      ? "Spectating " + name + " · Space for next"
      : "Respawning at your spawn";
  }

  hitmarker(kill) {
    const el = document.getElementById("hitmarker");
    el.classList.add("on");
    el.classList.toggle("kill", !!kill);
    setTimeout(() => el.classList.remove("on", "kill"), kill ? 180 : 120);
  }

  shotFlash() {
    const flash = document.getElementById("shot-flash");
    const hud = document.getElementById("hud");
    if (flash) {
      flash.classList.add("on");
      setTimeout(() => flash.classList.remove("on"), 55);
    }
    if (hud) {
      hud.classList.add("firing");
      setTimeout(() => hud.classList.remove("firing"), 70);
    }
  }

  hurt() {
    const v = document.getElementById("damage-vignette");
    v.style.boxShadow = "inset 0 0 90px 28px rgba(160,0,0,0.55)";
    setTimeout(() => {
      v.style.boxShadow = "inset 0 0 80px 24px rgba(160,0,0,0)";
    }, 180);
  }

  killfeed(a, b, team) {
    const feed = document.getElementById("killfeed");
    const row = document.createElement("div");
    row.className = "row";
    const cls = team === "T" ? "t" : "ct";
    row.innerHTML = `<span class="${cls}">${a}</span> ▸ <span>${b}</span>`;
    feed.appendChild(row);
    setTimeout(() => row.remove(), 4200);
  }
}

export function drawMinimap(world, player, bots, bomb, rocketPad, horde) {
  const c = document.getElementById("minimap");
  const ctx = c.getContext("2d");
  const sx = c.width / world.sx;
  const sz = c.height / world.sz;
  ctx.fillStyle = "#1a140e";
  ctx.fillRect(0, 0, c.width, c.height);

  for (let z = 0; z < world.sz; z += 1) {
    for (let x = 0; x < world.sx; x += 1) {
      const t = world.get(x, 2, z);
      if (t === 0) {
        const floor = world.get(x, 1, z);
        ctx.fillStyle = floor === 6 ? "#8a8468" : "#c4a86a";
      } else {
        ctx.fillStyle = t === 5 ? "#3f5c32" : t === 4 ? "#8b5a2b" : "#7a5a38";
      }
      ctx.fillRect(x * sx, z * sz, sx + 0.4, sz + 0.4);
    }
  }

  const dot = (x, z, color, r = 2.4) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x * sx, z * sz, r, 0, Math.PI * 2);
    ctx.fill();
  };

  const mark = (x, z, label, color) => {
    ctx.fillStyle = color;
    ctx.font = "bold 11px sans-serif";
    ctx.fillText(label, x * sx - 4, z * sz + 4);
  };
  mark(SITE_MARK.A.x, SITE_MARK.A.z, "A", "#f4d06a");
  mark(SITE_MARK.B.x, SITE_MARK.B.z, "B", "#f4d06a");

  for (const b of bots.bots) {
    if (!b.alive) continue;
    dot(b.pos.x, b.pos.z, b.team === "T" ? "#c7a35a" : "#5b8def", 2);
    if (b.hasBomb) dot(b.pos.x, b.pos.z, "#ff3333", 3.4);
    if (b.hasRocket) dot(b.pos.x, b.pos.z, "#ff6622", 3.2);
  }
  dot(player.pos.x, player.pos.z, "#7CFF6B", 3);
  if (player.hasBomb) dot(player.pos.x, player.pos.z, "#ff9900", 4);
  if (player.hasRocket) dot(player.pos.x, player.pos.z, "#ff6622", 3.2);
  if ((bomb.planted || bomb.loose) && bomb.pos) dot(bomb.pos.x, bomb.pos.z, "#ff3333", 3.6);
  if (horde) {
    for (const z of horde.living()) dot(z.pos.x, z.pos.z, "#5dff3a", 2.4);
  }
  if (rocketPad?.available()) {
    const rp = rocketPad.worldPos();
    mark(rp.x, rp.z, "R", "#ff7722");
    dot(rp.x, rp.z, "#ff6622", 2.8);
  }
}
