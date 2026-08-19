import * as THREE from "three";
import { createRocketPickup } from "./props.js";

export const ROCKET_HOME = { x: 49.2, z: 49.4 };

export const PICKUP_SPOTS = [
  { x: 43.5, z: 46.5, kind: "health" },
  { x: 78.5, z: 70.5, kind: "shield" },
  { x: 23.5, z: 62.5, kind: "health" },
  { x: 72.5, z: 34.5, kind: "shield" },
  { x: 26.5, z: 35.5, kind: "health" },
  { x: 58.5, z: 44.5, kind: "shield" },
  { x: 50.5, z: 80.5, kind: "health" },
  { x: 44.5, z: 29.5, kind: "shield" },
  { x: 65.5, z: 40.5, kind: "health" },
  { x: 47.5, z: 36.5, kind: "shield" },
  { x: 78.5, z: 50.5, kind: "health" },
  { x: 21.5, z: 48.5, kind: "shield" },
  { x: 47.5, z: 104.5, kind: "health" },
  { x: 47.5, z: 6.5, kind: "shield" },
];

function packMesh(kind) {
  const g = new THREE.Group();
  const isHealth = kind === "health";
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    new THREE.MeshLambertMaterial({ color: isHealth ? 0xd63a3a : 0x3a6adf })
  );
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshBasicMaterial({
      color: isHealth ? 0xff6666 : 0x77aaff,
      transparent: true,
      opacity: 0.28,
      fog: false,
      depthWrite: false,
    })
  );
  const mark = new THREE.Mesh(
    new THREE.BoxGeometry(isHealth ? 0.28 : 0.22, 0.08, 0.08),
    new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })
  );
  mark.position.y = 0.26;
  g.add(box, glow, mark);
  if (isHealth) {
    const plus = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.08, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })
    );
    plus.position.y = 0.26;
    g.add(plus);
  }
  const light = new THREE.PointLight(isHealth ? 0xff4444 : 0x4488ff, 1.1, 4.5);
  g.add(light);
  return g;
}

export class PickupManager {
  constructor(scene) {
    this.scene = scene;
    this.items = PICKUP_SPOTS.map((spot) => {
      const mesh = packMesh(spot.kind);
      mesh.position.set(spot.x, 2.45, spot.z);
      scene.add(mesh);
      return { ...spot, mesh, taken: false, respawn: 0 };
    });
  }

  reset() {
    for (const it of this.items) {
      it.taken = false;
      it.respawn = 0;
      it.mesh.visible = true;
    }
  }

  update(dt, player, bots, audio, onPickup) {
    const t = performance.now() * 0.001;
    for (const it of this.items) {
      if (it.taken) {
        it.respawn -= dt;
        if (it.respawn <= 0) {
          it.taken = false;
          it.mesh.visible = true;
        }
        continue;
      }
      it.mesh.position.y = 2.45 + Math.sin(t * 2.4 + it.x) * 0.12;
      it.mesh.rotation.y += dt * 1.6;

      const grab = (who) => {
        if (it.kind === "health") {
          if (who.health >= 100) return false;
          who.health = Math.min(100, who.health + 40);
        } else {
          if (who.armor >= 100) return false;
          who.armor = Math.min(100, who.armor + 50);
        }
        return true;
      };

      if (player.alive && player.pos.distanceTo(it.mesh.position) < 1.15 && grab(player)) {
        it.taken = true;
        it.respawn = 28;
        it.mesh.visible = false;
        audio.tone(it.kind === "health" ? 520 : 360, 0.1, "square", 0.05);
        if (onPickup) onPickup(it.kind);
        continue;
      }
      for (const b of bots) {
        if (!b.alive || b.pos.distanceTo(it.mesh.position) > 1.1) continue;
        if (!grab(b)) continue;
        it.taken = true;
        it.respawn = 28;
        it.mesh.visible = false;
        break;
      }
    }
  }
}

export class RocketSpawner {
  constructor(scene) {
    this.scene = scene;
    this.home = new THREE.Vector3(ROCKET_HOME.x, 2.58, ROCKET_HOME.z);
    this.mesh = createRocketPickup();
    this.mesh.position.copy(this.home);
    scene.add(this.mesh);
    this.state = "mid";
    this.dropT = 0;
    this.emptyT = 0;
  }

  reset() {
    this.state = "mid";
    this.dropT = 0;
    this.emptyT = 0;
    this.mesh.visible = true;
    this.mesh.position.copy(this.home);
  }

  worldPos() {
    return this.mesh.position.clone();
  }

  available() {
    return this.state === "mid" || this.state === "dropped";
  }

  update(dt, player, bots, onGrab) {
    const t = performance.now() * 0.001;
    if (this.state === "mid" || this.state === "dropped") {
      this.mesh.visible = true;
      const baseY = this.state === "mid" ? this.home.y : 2.45;
      if (this.state === "mid") {
        this.mesh.position.x = this.home.x;
        this.mesh.position.z = this.home.z;
      }
      this.mesh.position.y = baseY + Math.sin(t * 3) * 0.08;
      this.mesh.rotation.y += dt * 1.8;

      if (this.state === "dropped") {
        this.dropT -= dt;
        if (this.dropT <= 0) {
          this.reset();
          return;
        }
      }

      if (player.alive && !player.hasRocket && player.pos.distanceTo(this.mesh.position) < 1.35) {
        this.giveToPlayer(player);
        if (onGrab) onGrab(player, "You");
        return;
      }
      for (const b of bots) {
        if (!b.alive || b.hasRocket) continue;
        if (b.pos.distanceTo(this.mesh.position) > 1.3) continue;
        this.giveToBot(b);
        if (onGrab) onGrab(b, b.name);
        return;
      }
    } else {
      this.mesh.visible = false;
      const holder = player.hasRocket && player.alive ? player : bots.find((b) => b.alive && b.hasRocket);
      if (!holder) {
        this.emptyT += dt;
        if (this.emptyT > 3) this.reset();
        return;
      }
      const dry =
        holder === player
          ? !player.loadout.rocket || player.loadout.rocket.mag + player.loadout.rocket.reserve <= 0
          : (holder.rocketAmmo || 0) <= 0;
      if (dry) {
        this.emptyT += dt;
        if (this.emptyT > 2.5) {
          if (holder === player) {
            player.hasRocket = false;
            if (player.weapon === "rocket") player.weapon = "rifle";
          } else {
            holder.hasRocket = false;
            holder.rocketAmmo = 0;
          }
          this.reset();
        }
      } else {
        this.emptyT = 0;
      }
    }
  }

  giveToPlayer(player) {
    player.giveRocket();
    this.state = "carried";
    this.mesh.visible = false;
  }

  giveToBot(bot) {
    bot.hasRocket = true;
    bot.rocketAmmo = 3;
    bot.rocketCd = 0;
    this.state = "carried";
    this.mesh.visible = false;
  }

  dropAt(pos) {
    this.state = "dropped";
    this.dropT = 22;
    this.mesh.visible = true;
    this.mesh.position.set(pos.x, 2.45, pos.z);
  }
}
