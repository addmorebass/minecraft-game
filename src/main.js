import * as THREE from "three";
import { VoxelWorld } from "./world.js";
import { buildDustMap, SPAWNS } from "./map.js";
import { Player, createViewmodel, WEAPONS } from "./player.js";
import { BotManager } from "./bots.js";
import { Match, UI, drawMinimap } from "./game.js";
import { AudioBus } from "./audio.js";

const world = new VoxelWorld();
buildDustMap(world);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec8e3);
scene.fog = new THREE.Fog(0xc4b896, 32, 120);

const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.08, 240);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById("game").appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0x9fd4ff, 0xc4a574, 0.85));
const sun = new THREE.DirectionalLight(0xffe0b0, 1.15);
sun.position.set(40, 80, -10);
scene.add(sun);
scene.add(new THREE.AmbientLight(0xfff2d0, 0.22));

world.buildMesh(scene);

const dust = new THREE.Points(
  new THREE.BufferGeometry().setFromPoints(
    Array.from({ length: 180 }, () => new THREE.Vector3(Math.random() * 80, 3 + Math.random() * 6, Math.random() * 72))
  ),
  new THREE.PointsMaterial({ color: 0xe8d4a0, size: 0.08, transparent: true, opacity: 0.35 })
);
scene.add(dust);

const player = new Player(camera, world);
player.bind(window);
scene.add(camera);
player.viewmodel = createViewmodel(camera);

const bots = new BotManager(scene);
const audio = new AudioBus();
const ui = new UI();
const match = new Match(world, player, bots, audio, ui);

let team = "T";
let difficulty = "normal";
let playing = false;
let pendingRound = 0;
let mapTimer = 0;

document.getElementById("pick-t").onclick = () => {
  team = "T";
  document.getElementById("pick-t").classList.add("active");
  document.getElementById("pick-ct").classList.remove("active");
};
document.getElementById("pick-ct").onclick = () => {
  team = "CT";
  document.getElementById("pick-ct").classList.add("active");
  document.getElementById("pick-t").classList.remove("active");
};

document.querySelectorAll(".diff-btn").forEach((btn) => {
  btn.onclick = () => {
    difficulty = btn.dataset.diff;
    document.querySelectorAll(".diff-btn").forEach((b) => b.classList.toggle("active", b === btn));
    bots.setDifficulty(difficulty);
  };
});

document.getElementById("play").onclick = () => {
  audio.ensure();
  player.team = team;
  document.getElementById("gun-name").textContent = player.gunName();
  bots.setDifficulty(difficulty);
  if (!playing) {
    bots.spawnAll(team, SPAWNS);
    match.round = 1;
    match.score = { T: 0, CT: 0 };
    match.startRound(SPAWNS, scene);
    playing = true;
  }
  document.getElementById("menu").style.display = "none";
  document.getElementById("hud").classList.remove("hidden");
  renderer.domElement.requestPointerLock();
};

renderer.domElement.addEventListener("click", () => {
  if (!playing) return;
  if (document.pointerLockElement !== renderer.domElement) {
    renderer.domElement.requestPointerLock();
    return;
  }
  if (!player.alive) {
    player.cycleSpectate();
    return;
  }
  const shot = player.tryShoot(performance.now() / 1000);
  if (shot) {
    if (shot.dry) audio.tone(140, 0.04, "square", 0.03);
    else {
      if (player.weapon !== "rocket") audio.shoot(player.weapon === "rifle");
      shot.from = "player";
      pendingShots.push(shot);
    }
  }
});

document.addEventListener("pointerlockchange", () => {
  player.locked = document.pointerLockElement === renderer.domElement;
  if (playing && !player.locked && !ui.resultsOpen && !ui.deathOpen) {
    document.getElementById("menu").style.display = "flex";
    document.querySelector(".tagline").textContent = "Click join to lock the mouse again";
    document.getElementById("play").textContent = "Resume";
  }
});

function restartMatch() {
  ui.hideResults();
  match.resetMatch();
  match.resetHorde(scene);
  player.team = team;
  bots.setDifficulty(difficulty);
  bots.spawnAll(team, SPAWNS);
  match.startRound(SPAWNS, scene);
  document.getElementById("menu").style.display = "none";
  document.getElementById("hud").classList.remove("hidden");
  renderer.domElement.requestPointerLock();
}

function continueMatch() {
  ui.hideResults();
  if (match.shouldSwapSides()) {
    match.round += 1;
    match.swapSides(SPAWNS, scene);
  } else {
    match.round += 1;
    match.startRound(SPAWNS, scene);
  }
  document.getElementById("menu").style.display = "none";
  renderer.domElement.requestPointerLock();
}

document.getElementById("results-restart").onclick = () => restartMatch();
document.getElementById("results-next").onclick = () => continueMatch();
document.getElementById("death-restart").onclick = () => restartMatch();

const pendingShots = [];

window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

let last = performance.now();

function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (playing) {
    if (!player.alive && match.phase !== "over") {
      const name = player.spectate(dt, bots.living(player.team));
      ui.setSpectate(name);
    } else if (match.freeze <= 0 && match.phase !== "over") {
      if (match.needLock) {
        match.needLock = false;
        renderer.domElement.requestPointerLock();
      }
      player.update(dt);
    }
    else {
      player.camera.position.set(player.pos.x, player.pos.y + player.eye, player.pos.z);
      player.camera.rotation.set(player.pitch, player.yaw, 0, "YXZ");
    }

    const botShots = [];
    if (match.phase !== "over" && match.freeze <= 0) {
      bots.update(dt, world, player, audio, (bot, origin, dir, rocket) => {
        botShots.push({
          from: "bot",
          bot,
          origin,
          dir,
          projectile: !!rocket,
          def: rocket
            ? { ...WEAPONS.rocket }
            : {
                ...WEAPONS.rifle,
                damage: bots.profile?.damage ?? 18,
                range: 70,
                headMul: bots.profile?.headMul ?? 1.8,
              },
        });
      }, match.intel());
    }

    match.update(dt, scene, pendingShots.splice(0).concat(botShots));

    if (match.phase === "over") {
      pendingRound += dt;
      if (pendingRound > 1.2 && !ui.resultsOpen && match.lastResult) {
        ui.showResults(match);
        document.exitPointerLock();
      }
    } else {
      pendingRound = 0;
    }

    mapTimer += dt;
    if (mapTimer > 0.12) {
      mapTimer = 0;
      drawMinimap(world, player, bots, match.bomb, match.rocketPad, match.horde);
    }

    dust.rotation.y += dt * 0.02;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
