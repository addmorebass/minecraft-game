import * as THREE from "three";

function canvas(size = 16) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  return { c, ctx };
}

function noiseFill(ctx, size, colors) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      ctx.fillStyle = colors[(x * 7 + y * 13 + x * y) % colors.length];
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function texFrom(draw, size = 16) {
  const { c, ctx } = canvas(size);
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function createTextures() {
  return {
    sand: texFrom((ctx, s) => {
      noiseFill(ctx, s, ["#e6d09a", "#d9c184", "#efd8a4", "#cbb667"]);
      ctx.fillStyle = "#c4a86a";
      for (let i = 0; i < 10; i++) ctx.fillRect((i * 5) % s, (i * 9) % s, 2, 1);
    }),
    sandstone: texFrom((ctx, s) => {
      noiseFill(ctx, s, ["#d7b57a", "#c9a56a", "#e0c08a", "#b8945c"]);
      ctx.fillStyle = "#a67c52";
      ctx.fillRect(0, 4, s, 1);
      ctx.fillRect(0, 11, s, 1);
      ctx.fillStyle = "#f0d6a0";
      ctx.fillRect(3, 0, 1, s);
      ctx.fillRect(10, 0, 1, s);
    }),
    dark: texFrom((ctx, s) => {
      noiseFill(ctx, s, ["#7a5a38", "#6a4c2e", "#8a6640", "#5c4028"]);
      ctx.fillStyle = "#3d2b1a";
      ctx.fillRect(0, 7, s, 1);
    }),
    crate: texFrom((ctx, s) => {
      ctx.fillStyle = "#8b5a2b";
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "#6b4220";
      ctx.fillRect(1, 1, s - 2, s - 2);
      ctx.fillStyle = "#c48a4a";
      ctx.fillRect(0, 0, s, 1);
      ctx.fillRect(0, 0, 1, s);
      ctx.fillStyle = "#3d2410";
      ctx.fillRect(s - 1, 0, 1, s);
      ctx.fillRect(0, s - 1, s, 1);
      ctx.strokeStyle = "#4a2c12";
      ctx.strokeRect(3, 3, 10, 10);
      ctx.fillStyle = "#2b1a0c";
      ctx.fillRect(7, 2, 2, 12);
      ctx.fillRect(2, 7, 12, 2);
    }),
    door: texFrom((ctx, s) => {
      ctx.fillStyle = "#3f5c32";
      ctx.fillRect(0, 0, s, s);
      ctx.fillStyle = "#2c4322";
      for (let y = 1; y < s; y += 4) ctx.fillRect(1, y, s - 2, 3);
      ctx.fillStyle = "#c9b25a";
      ctx.fillRect(11, 7, 3, 3);
    }),
    site: texFrom((ctx, s) => {
      const a = (x, y) => ((x + y) % 2 === 0 ? "#8a8468" : "#6e6950");
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          ctx.fillStyle = a(x, y);
          ctx.fillRect(x, y, 1, 1);
        }
      }
      ctx.strokeStyle = "#d2c48a";
      ctx.strokeRect(1, 1, 13, 13);
    }),
    pillar: texFrom((ctx, s) => {
      noiseFill(ctx, s, ["#c4a36a", "#b39158", "#d4b47a"]);
      ctx.fillStyle = "#8a6a3c";
      ctx.fillRect(0, 0, 2, s);
      ctx.fillRect(s - 2, 0, 2, s);
    }),
    wood: texFrom((ctx, s) => {
      noiseFill(ctx, s, ["#9a6a38", "#8a5a2c", "#b07a44"]);
      ctx.fillStyle = "#5a3818";
      ctx.fillRect(0, 5, s, 1);
      ctx.fillRect(0, 12, s, 1);
    }),
    brick: texFrom((ctx, s) => {
      ctx.fillStyle = "#6e4a32";
      ctx.fillRect(0, 0, s, s);
      const rows = [
        [0, 0, 7, 3],
        [8, 0, 8, 3],
        [0, 4, 4, 3],
        [5, 4, 7, 3],
        [13, 4, 3, 3],
        [0, 8, 7, 3],
        [8, 8, 8, 3],
        [0, 12, 4, 4],
        [5, 12, 7, 4],
        [13, 12, 3, 4],
      ];
      ctx.fillStyle = "#a06648";
      for (const [x, y, w, h] of rows) ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "#3d2818";
      ctx.fillRect(0, 3, s, 1);
      ctx.fillRect(0, 7, s, 1);
      ctx.fillRect(0, 11, s, 1);
    }),
  };
}

export function makeMaterial(map) {
  const mat = new THREE.MeshLambertMaterial({ map });
  mat.magFilter = THREE.NearestFilter;
  return mat;
}
