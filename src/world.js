import * as THREE from "three";
import { createTextures, makeMaterial } from "./textures.js";

export const BLOCK = {
  AIR: 0,
  SAND: 1,
  SANDSTONE: 2,
  DARK: 3,
  CRATE: 4,
  DOOR: 5,
  SITE: 6,
  PILLAR: 7,
  WOOD: 8,
  BRICK: 9,
};

export const SIZE = { x: 96, y: 14, z: 112 };

export class VoxelWorld {
  constructor() {
    this.sx = SIZE.x;
    this.sy = SIZE.y;
    this.sz = SIZE.z;
    this.data = new Uint8Array(this.sx * this.sy * this.sz);
    this.instIndex = new Int32Array(this.sx * this.sy * this.sz);
    this.instIndex.fill(-1);
    this.visual = null;
    this.dummy = new THREE.Object3D();
    this.zones = [];
    this.brokenCount = 0;
  }

  index(x, y, z) {
    return y * this.sx * this.sz + z * this.sx + x;
  }

  inBounds(x, y, z) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  get(x, y, z) {
    x = x | 0;
    y = y | 0;
    z = z | 0;
    // Nothing under the two floor layers — dig both and you drop through the map.
    if (y < 0) return BLOCK.AIR;
    if (!this.inBounds(x, y, z)) return BLOCK.SANDSTONE;
    return this.data[this.index(x, y, z)];
  }

  set(x, y, z, t) {
    if (!this.inBounds(x, y, z)) return;
    this.data[this.index(x, y, z)] = t;
  }

  solid(x, y, z) {
    return this.get(x, y, z) !== BLOCK.AIR;
  }

  fill(x0, y0, z0, x1, y1, z1, t) {
    const xa = Math.min(x0, x1);
    const xb = Math.max(x0, x1);
    const ya = Math.min(y0, y1);
    const yb = Math.max(y0, y1);
    const za = Math.min(z0, z1);
    const zb = Math.max(z0, z1);
    for (let y = ya; y <= yb; y++) {
      for (let z = za; z <= zb; z++) {
        for (let x = xa; x <= xb; x++) {
          this.set(x, y, z, t);
        }
      }
    }
  }

  carve(x0, y0, z0, x1, y1, z1) {
    this.fill(x0, y0, z0, x1, y1, z1, BLOCK.AIR);
  }

  addZone(name, x0, z0, x1, z1) {
    this.zones.push({
      name,
      x0: Math.min(x0, x1),
      z0: Math.min(z0, z1),
      x1: Math.max(x0, x1),
      z1: Math.max(z0, z1),
    });
  }

  zoneAt(x, z) {
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zn = this.zones[i];
      if (x >= zn.x0 && x <= zn.x1 && z >= zn.z0 && z <= zn.z1) return zn.name;
    }
    return "";
  }

  buildMesh(scene) {
    const textures = createTextures();
    const materials = {
      [BLOCK.SAND]: makeMaterial(textures.sand),
      [BLOCK.SANDSTONE]: makeMaterial(textures.sandstone),
      [BLOCK.DARK]: makeMaterial(textures.dark),
      [BLOCK.CRATE]: makeMaterial(textures.crate),
      [BLOCK.DOOR]: makeMaterial(textures.door),
      [BLOCK.SITE]: makeMaterial(textures.site),
      [BLOCK.PILLAR]: makeMaterial(textures.pillar),
      [BLOCK.WOOD]: makeMaterial(textures.wood),
      [BLOCK.BRICK]: makeMaterial(textures.brick),
    };

    const counts = {};
    for (let y = 0; y < this.sy; y++) {
      for (let z = 0; z < this.sz; z++) {
        for (let x = 0; x < this.sx; x++) {
          const t = this.get(x, y, z);
          if (t === BLOCK.AIR) continue;
          counts[t] = (counts[t] || 0) + 1;
        }
      }
    }

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const dummy = new THREE.Object3D();
    const meshes = {};

    for (const [type, count] of Object.entries(counts)) {
      const mesh = new THREE.InstancedMesh(geo, materials[type], count);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      meshes[type] = { mesh, i: 0 };
      scene.add(mesh);
    }

    for (let y = 0; y < this.sy; y++) {
      for (let z = 0; z < this.sz; z++) {
        for (let x = 0; x < this.sx; x++) {
          const t = this.get(x, y, z);
          if (t === BLOCK.AIR) continue;
          dummy.position.set(x + 0.5, y + 0.5, z + 0.5);
          dummy.scale.set(1, 1, 1);
          dummy.updateMatrix();
          const bucket = meshes[t];
          this.instIndex[this.index(x, y, z)] = bucket.i;
          bucket.mesh.setMatrixAt(bucket.i++, dummy.matrix);
        }
      }
    }

    for (const bucket of Object.values(meshes)) {
      bucket.mesh.instanceMatrix.needsUpdate = true;
    }

    this.visual = { meshes, materials };
    return this.visual;
  }

  canBreak(x, y, z) {
    if (y < 0) return false;
    if (!this.inBounds(x, y, z)) return false;
    if (x <= 1 || z <= 1 || x >= this.sx - 2 || z >= this.sz - 2) return false;
    return this.get(x, y, z) !== BLOCK.AIR;
  }

  breakBlock(x, y, z, flush = true) {
    if (!this.canBreak(x, y, z)) return 0;
    const t = this.get(x, y, z);
    const idx = this.index(x, y, z);
    const inst = this.instIndex[idx];
    this.set(x, y, z, BLOCK.AIR);
    this.instIndex[idx] = -1;
    this.brokenCount += 1;
    const bucket = this.visual?.meshes[t];
    if (bucket && inst >= 0) {
      this.dummy.position.set(0, -80, 0);
      this.dummy.scale.set(0, 0, 0);
      this.dummy.updateMatrix();
      bucket.mesh.setMatrixAt(inst, this.dummy.matrix);
      if (flush) bucket.mesh.instanceMatrix.needsUpdate = true;
    }
    return t;
  }

  breakSphere(px, py, pz, r) {
    const broken = [];
    const x0 = Math.floor(px - r);
    const x1 = Math.floor(px + r);
    const y0 = Math.floor(py - r);
    const y1 = Math.floor(py + r);
    const z0 = Math.floor(pz - r);
    const z1 = Math.floor(pz + r);
    const r2 = r * r;
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x + 0.5 - px;
          const dy = y + 0.5 - py;
          const dz = z + 0.5 - pz;
          if (dx * dx + dy * dy + dz * dz > r2) continue;
          const t = this.breakBlock(x, y, z, false);
          if (t) broken.push({ x, y, z, t });
        }
      }
    }
    this.flushInstances();
    return broken;
  }

  flushInstances() {
    if (!this.visual) return;
    for (const bucket of Object.values(this.visual.meshes)) {
      bucket.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  collide(pos, radius, height) {
    const minX = pos.x - radius;
    const maxX = pos.x + radius;
    const minY = pos.y;
    const maxY = pos.y + height;
    const minZ = pos.z - radius;
    const maxZ = pos.z + radius;

    const x0 = Math.floor(minX);
    const x1 = Math.floor(maxX);
    const y0 = Math.floor(minY);
    const y1 = Math.floor(maxY - 0.001);
    const z0 = Math.floor(minZ);
    const z1 = Math.floor(maxZ);

    let grounded = false;
    const hits = [];

    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (!this.solid(x, y, z)) continue;
          hits.push({ x, y, z });
          if (y === y0 && pos.y > y + 0.99) grounded = true;
        }
      }
    }

    for (const b of hits) {
      const cx0 = b.x;
      const cx1 = b.x + 1;
      const cy0 = b.y;
      const cy1 = b.y + 1;
      const cz0 = b.z;
      const cz1 = b.z + 1;

      const overlapX = Math.min(maxX, cx1) - Math.max(minX, cx0);
      const overlapY = Math.min(maxY, cy1) - Math.max(minY, cy0);
      const overlapZ = Math.min(maxZ, cz1) - Math.max(minZ, cz0);
      if (overlapX <= 0 || overlapY <= 0 || overlapZ <= 0) continue;

      if (overlapY <= overlapX && overlapY <= overlapZ) {
        if (pos.y + height / 2 < b.y + 0.5) {
          pos.y -= overlapY;
        } else {
          pos.y += overlapY;
          grounded = true;
        }
      } else if (overlapX < overlapZ) {
        pos.x += pos.x < b.x + 0.5 ? -overlapX : overlapX;
      } else {
        pos.z += pos.z < b.z + 0.5 ? -overlapZ : overlapZ;
      }
    }

    return grounded;
  }

  raycast(origin, dir, maxDist = 80) {
    const x = origin.x;
    const y = origin.y;
    const z = origin.z;
    let ix = Math.floor(x);
    let iy = Math.floor(y);
    let iz = Math.floor(z);
    const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
    const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
    const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;

    const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dir.x);
    const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dir.y);
    const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / dir.z);

    let tMaxX = stepX === 0 ? Infinity : ((stepX > 0 ? ix + 1 - x : x - ix) * tDeltaX);
    let tMaxY = stepY === 0 ? Infinity : ((stepY > 0 ? iy + 1 - y : y - iy) * tDeltaY);
    let tMaxZ = stepZ === 0 ? Infinity : ((stepZ > 0 ? iz + 1 - z : z - iz) * tDeltaZ);

    let dist = 0;
    let face = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < 160; i++) {
      if (dist > maxDist) return null;
      // Skip the cell the camera is inside so look-down can hit the floor.
      if (dist > 0.02 && this.solid(ix, iy, iz) && this.get(ix, iy, iz) !== BLOCK.AIR) {
        return { x: ix, y: iy, z: iz, dist, face, type: this.get(ix, iy, iz) };
      }
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        dist = tMaxX;
        tMaxX += tDeltaX;
        ix += stepX;
        face.set(-stepX, 0, 0);
      } else if (tMaxY < tMaxZ) {
        dist = tMaxY;
        tMaxY += tDeltaY;
        iy += stepY;
        face.set(0, -stepY, 0);
      } else {
        dist = tMaxZ;
        tMaxZ += tDeltaZ;
        iz += stepZ;
        face.set(0, 0, -stepZ);
      }
    }
    return null;
  }
}
