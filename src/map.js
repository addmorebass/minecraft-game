import { BLOCK } from "./world.js";

const OX = 8;
const OZ = 22;

function floor(world, x0, z0, x1, z1, y, type = BLOCK.SAND) {
  world.fill(x0 + OX, y, z0 + OZ, x1 + OX, y, z1 + OZ, type);
}

function wallBox(world, x0, z0, x1, z1, y0, y1, type = BLOCK.SANDSTONE) {
  world.fill(x0 + OX, y0, z0 + OZ, x1 + OX, y1, z0 + OZ, type);
  world.fill(x0 + OX, y0, z1 + OZ, x1 + OX, y1, z1 + OZ, type);
  world.fill(x0 + OX, y0, z0 + OZ, x0 + OX, y1, z1 + OZ, type);
  world.fill(x1 + OX, y0, z0 + OZ, x1 + OX, y1, z1 + OZ, type);
}

function doorway(world, x, z, facing, width = 3, height = 3, y = 2) {
  x += OX;
  z += OZ;
  if (facing === "x") {
    world.carve(x, y, z, x, y + height - 1, z + width - 1);
  } else {
    world.carve(x, y, z, x + width - 1, y + height - 1, z);
  }
}

function doorFrame(world, x, z, facing, width = 3, height = 3, y = 2) {
  x += OX;
  z += OZ;
  if (facing === "x") {
    world.fill(x, y, z - 1, x, y + height, z + width, BLOCK.DOOR);
    world.carve(x, y, z, x, y + height - 1, z + width - 1);
  } else {
    world.fill(x - 1, y, z, x + width, y + height, z, BLOCK.DOOR);
    world.carve(x, y, z, x + width - 1, y + height - 1, z);
  }
}

function crate(world, x, z, y = 2, w = 2, d = 2, h = 2) {
  world.fill(x + OX, y, z + OZ, x + OX + w - 1, y + h - 1, z + OZ + d - 1, BLOCK.CRATE);
}

function column(world, x, z, y0, y1) {
  world.fill(x + OX, y0, z + OZ, x + OX, y1, z + OZ, BLOCK.PILLAR);
}

function ramp(world, x0, z0, x1, z1, y0, y1, axis = "z") {
  x0 += OX;
  x1 += OX;
  z0 += OZ;
  z1 += OZ;
  const steps = Math.abs(y1 - y0) + 1;
  for (let i = 0; i < steps; i++) {
    const y = y0 + i * Math.sign(y1 - y0 || 1);
    if (axis === "z") {
      const z = z0 + Math.round(((z1 - z0) * i) / Math.max(1, steps - 1));
      world.fill(x0, y, z, x1, y, z, BLOCK.SANDSTONE);
    } else {
      const x = x0 + Math.round(((x1 - x0) * i) / Math.max(1, steps - 1));
      world.fill(x, y, z0, x, y, z1, BLOCK.SANDSTONE);
    }
  }
}

function fill(world, x0, y0, z0, x1, y1, z1, t) {
  world.fill(x0 + OX, y0, z0 + OZ, x1 + OX, y1, z1 + OZ, t);
}

function carve(world, x0, y0, z0, x1, y1, z1) {
  world.carve(x0 + OX, y0, z0 + OZ, x1 + OX, y1, z1 + OZ);
}

export const SITES = {
  A: { x0: 56 + OX, z0: 6 + OZ, x1: 70 + OX, z1: 18 + OZ },
  B: { x0: 8 + OX, z0: 6 + OZ, x1: 22 + OX, z1: 18 + OZ },
};

export const SPAWNS = {
  T: [
    { x: 46.5, y: 2.01, z: 104.5 },
    { x: 49.5, y: 2.01, z: 106.5 },
    { x: 43.5, y: 2.01, z: 106.5 },
    { x: 47.5, y: 2.01, z: 102.5 },
    { x: 51.5, y: 2.01, z: 103.5 },
  ],
  CT: [
    { x: 47.5, y: 2.01, z: 5.5 },
    { x: 44.5, y: 2.01, z: 4.5 },
    { x: 50.5, y: 2.01, z: 4.5 },
    { x: 46.5, y: 2.01, z: 7.5 },
    { x: 49.5, y: 2.01, z: 6.5 },
  ],
};

export function buildDustMap(world) {
  // Bedrock + sand field
  world.fill(0, 0, 0, world.sx - 1, 0, world.sz - 1, BLOCK.DARK);
  world.fill(1, 1, 1, world.sx - 2, 1, world.sz - 2, BLOCK.SAND);

  // Outer cliffs so you cannot fall off the map (world coords, not map offset)
  wallBoxWorld(world, 0, 0, world.sx - 1, world.sz - 1, 1, 7, BLOCK.SANDSTONE);
  world.fill(0, 1, 0, world.sx - 1, 1, 0, BLOCK.SANDSTONE);
  world.fill(0, 1, world.sz - 1, world.sx - 1, 1, world.sz - 1, BLOCK.SANDSTONE);

  buildTSpawn(world);
  buildLong(world);
  buildMid(world);
  buildCatAndA(world);
  buildTunnelsAndB(world);
  buildCT(world);
  scatterCrates(world);
  openRoutes(world);
  buildCityEnds(world);
  buildCityBlocks(world);

  world.addZone("T SPAWN", 36, 96, 60, 110);
  world.addZone("T TOWN", 34, 88, 62, 96);
  world.addZone("OUTSIDE TUNNELS", 10 + OX, 52 + OZ, 28 + OX, 64 + OZ);
  world.addZone("LONG", 50 + OX, 36 + OZ, 76 + OX, 66 + OZ);
  world.addZone("LONG DOORS", 62 + OX, 32 + OZ, 74 + OX, 40 + OZ);
  world.addZone("PIT", 52 + OX, 14 + OZ, 62 + OX, 22 + OZ);
  world.addZone("A SITE", 54 + OX, 4 + OZ, 74 + OX, 20 + OZ);
  world.addZone("SHORT A", 48 + OX, 12 + OZ, 58 + OX, 24 + OZ);
  world.addZone("CATWALK", 42 + OX, 18 + OZ, 56 + OX, 26 + OZ);
  world.addZone("MID", 32 + OX, 20 + OZ, 46 + OX, 40 + OZ);
  world.addZone("XBOX", 34 + OX, 22 + OZ, 44 + OX, 30 + OZ);
  world.addZone("MID DOORS", 33 + OX, 38 + OZ, 45 + OX, 44 + OZ);
  world.addZone("UPPER TUNNELS", 6 + OX, 16 + OZ, 20 + OX, 36 + OZ);
  world.addZone("LOWER TUNNELS", 8 + OX, 36 + OZ, 22 + OX, 54 + OZ);
  world.addZone("B SITE", 6 + OX, 4 + OZ, 24 + OX, 20 + OZ);
  world.addZone("CT SPAWN", 36, 2, 60, 12);
  world.addZone("CT TOWN", 34, 12, 62, 22);
  world.addZone("CT MID", 32 + OX, 8 + OZ, 46 + OX, 20 + OZ);
}

function buildTSpawn(world) {
  // Courtyard walls, open north to mid / west to tunnels / east to long
  wallBox(world, 30, 54, 50, 67, 2, 5, BLOCK.SANDSTONE);
  carve(world, 31, 2, 55, 49, 5, 66);

  // Openings
  doorway(world, 39, 54, "z", 6, 4); // to mid
  doorway(world, 30, 58, "x", 5, 4); // to tunnels
  doorway(world, 50, 58, "x", 5, 4); // to long

  // Spawn cover
  crate(world, 33, 62, 2, 2, 2, 2);
  crate(world, 46, 61, 2, 2, 2, 1);
  column(world, 36, 57, 2, 5);
  column(world, 44, 57, 2, 5);
}

function buildLong(world) {
  // East run from T then north toward A
  wallBox(world, 50, 54, 76, 66, 2, 5, BLOCK.SANDSTONE);
  carve(world, 51, 2, 55, 75, 5, 65);
  doorway(world, 50, 58, "x", 5, 4);

  // Long corridor north
  wallBox(world, 64, 18, 76, 56, 2, 5, BLOCK.SANDSTONE);
  carve(world, 65, 2, 19, 75, 5, 55);
  carve(world, 65, 2, 54, 75, 5, 56);

  // Long doors
  doorFrame(world, 66, 36, "z", 8, 3);
  fill(world, 65, 2, 36, 75, 5, 36, BLOCK.DOOR);
  carve(world, 67, 2, 36, 73, 4, 36);

  // Corner / blue
  wallBox(world, 56, 20, 66, 30, 2, 5, BLOCK.BRICK);
  carve(world, 57, 2, 21, 65, 5, 29);
  doorway(world, 64, 24, "x", 4, 3);
  doorway(world, 60, 20, "z", 4, 3);

  // Pit — sunken pocket beside A
  fill(world, 52, 1, 14, 62, 1, 22, BLOCK.DARK);
  carve(world, 53, 1, 15, 61, 1, 21);
  fill(world, 53, 1, 15, 61, 1, 21, BLOCK.SAND);
  ramp(world, 60, 15, 62, 21, 1, 2, "x");
  crate(world, 54, 16, 2, 2, 2, 1);
}

function buildMid(world) {
  // Mid alley from T doors to CT
  wallBox(world, 33, 20, 45, 54, 2, 5, BLOCK.SANDSTONE);
  carve(world, 34, 2, 21, 44, 5, 53);
  doorway(world, 36, 54, "z", 6, 4);

  // Mid doors (double green)
  fill(world, 33, 2, 40, 45, 5, 41, BLOCK.DOOR);
  carve(world, 34, 2, 40, 38, 4, 41);
  carve(world, 40, 2, 40, 44, 4, 41);

  // Xbox
  crate(world, 37, 26, 2, 3, 3, 2);
  crate(world, 38, 27, 4, 1, 1, 1);

  // Mid to cat opening
  doorway(world, 45, 22, "x", 4, 3);

  // Top mid toward CT
  carve(world, 34, 2, 10, 44, 5, 21);
  wallBox(world, 33, 8, 45, 20, 2, 5, BLOCK.SANDSTONE);
  carve(world, 34, 2, 9, 44, 5, 19);
  doorway(world, 36, 8, "z", 6, 3);
  carve(world, 34, 2, 20, 44, 5, 21);
}

function buildCatAndA(world) {
  // Elevated catwalk from mid toward A
  fill(world, 44, 3, 20, 58, 3, 25, BLOCK.SANDSTONE);
  wallBox(world, 44, 20, 58, 25, 4, 6, BLOCK.SANDSTONE);
  carve(world, 45, 4, 21, 57, 6, 24);
  ramp(world, 42, 21, 44, 24, 2, 3, "x");

  // Short A drop
  wallBox(world, 52, 10, 62, 22, 2, 5, BLOCK.SANDSTONE);
  carve(world, 53, 2, 11, 61, 5, 21);
  doorway(world, 56, 10, "z", 4, 3);
  carve(world, 57, 2, 20, 58, 5, 21);

  // Stairs from cat to short
  ramp(world, 54, 22, 57, 25, 3, 2, "z");

  // A site plaza
  floor(world, 56, 6, 74, 20, 1, BLOCK.SITE);
  wallBox(world, 54, 4, 76, 22, 2, 5, BLOCK.SANDSTONE);
  carve(world, 55, 2, 5, 75, 5, 21);

  // Openings: long, short, CT
  doorway(world, 66, 22, "z", 6, 4);
  carve(world, 65, 2, 18, 75, 5, 22);
  doorway(world, 54, 12, "x", 5, 3);
  doorway(world, 60, 4, "z", 6, 3);

  // A default / goose boxes
  crate(world, 62, 10, 2, 3, 2, 2);
  crate(world, 63, 11, 4, 1, 1, 1);
  crate(world, 70, 8, 2, 2, 3, 2);
  crate(world, 58, 16, 2, 2, 2, 1);
  column(world, 68, 14, 2, 5);
  column(world, 60, 8, 2, 5);

  // Goose nook
  fill(world, 72, 2, 6, 75, 5, 10, BLOCK.SANDSTONE);
  carve(world, 72, 2, 7, 74, 4, 9);
}

function buildTunnelsAndB(world) {
  // Dark lower tunnel from T west then north
  wallBox(world, 8, 52, 30, 64, 2, 5, BLOCK.DARK);
  carve(world, 9, 2, 53, 29, 4, 63);
  fill(world, 9, 5, 53, 29, 5, 63, BLOCK.DARK);
  doorway(world, 30, 58, "x", 5, 3);

  // Lower tunnels north
  wallBox(world, 6, 34, 20, 54, 2, 5, BLOCK.DARK);
  carve(world, 7, 2, 35, 19, 4, 53);
  fill(world, 7, 5, 35, 19, 5, 53, BLOCK.DARK);
  carve(world, 9, 2, 52, 16, 4, 54);

  // Upper tunnels (slightly wider, still dark)
  wallBox(world, 6, 16, 22, 36, 2, 5, BLOCK.DARK);
  carve(world, 7, 2, 17, 21, 4, 35);
  fill(world, 7, 5, 17, 21, 5, 35, BLOCK.DARK);
  carve(world, 8, 2, 34, 16, 4, 36);

  // B doors
  doorFrame(world, 10, 16, "z", 8, 3);
  fill(world, 7, 2, 16, 21, 5, 16, BLOCK.DOOR);
  carve(world, 11, 2, 16, 17, 4, 16);

  // B site
  floor(world, 8, 6, 24, 18, 1, BLOCK.SITE);
  wallBox(world, 6, 4, 26, 20, 2, 5, BLOCK.SANDSTONE);
  carve(world, 7, 2, 5, 25, 5, 19);
  doorway(world, 10, 4, "z", 6, 3); // CT
  doorway(world, 26, 10, "x", 5, 3); // window / B doors to mid-ish

  // Window to mid from B
  carve(world, 24, 3, 10, 26, 4, 13);

  // B platform + car + boxes
  fill(world, 10, 2, 8, 13, 2, 10, BLOCK.WOOD);
  crate(world, 18, 8, 2, 3, 2, 2);
  crate(world, 19, 9, 4, 1, 1, 1);
  crate(world, 9, 14, 2, 2, 2, 2);

  // Blocky "car"
  fill(world, 20, 2, 14, 24, 3, 17, BLOCK.DARK);
  fill(world, 21, 4, 15, 23, 4, 16, BLOCK.DARK);

  column(world, 12, 16, 2, 5);
}

function buildCT(world) {
  wallBox(world, 30, 1, 50, 10, 2, 5, BLOCK.BRICK);
  carve(world, 31, 2, 2, 49, 5, 9);
  doorway(world, 36, 10, "z", 6, 3);
  doorway(world, 30, 4, "x", 4, 3); // to B
  doorway(world, 50, 4, "x", 4, 3); // to A

  // CT corridors to sites
  wallBox(world, 22, 2, 32, 10, 2, 5, BLOCK.SANDSTONE);
  carve(world, 23, 2, 3, 31, 5, 9);
  carve(world, 26, 2, 4, 30, 4, 8);

  wallBox(world, 48, 2, 62, 10, 2, 5, BLOCK.SANDSTONE);
  carve(world, 49, 2, 3, 61, 5, 9);
  carve(world, 50, 2, 4, 55, 4, 8);
  doorway(world, 58, 10, "z", 4, 3);

  crate(world, 33, 3, 2, 2, 2, 1);
  crate(world, 45, 3, 2, 2, 2, 1);
}

function scatterCrates(world) {
  crate(world, 36, 44, 2, 2, 2, 2);
  crate(world, 42, 48, 2, 1, 2, 1);
  crate(world, 68, 48, 2, 2, 2, 2);
  crate(world, 70, 28, 2, 2, 3, 2);
  crate(world, 12, 44, 2, 2, 2, 1);
  crate(world, 16, 28, 2, 2, 2, 2);
}

function openRoutes(world) {
  // T spawn → tunnels, mid, long
  carve(world, 29, 2, 57, 31, 4, 62);
  carve(world, 36, 2, 53, 44, 4, 55);
  carve(world, 49, 2, 57, 51, 4, 62);

  // Mid doors stay walkable
  carve(world, 34, 2, 40, 38, 4, 41);
  carve(world, 40, 2, 40, 44, 4, 41);

  // Lower ↔ upper tunnels
  carve(world, 8, 2, 33, 16, 4, 37);

  // Upper tunnels ↔ B
  carve(world, 10, 2, 15, 18, 4, 21);

  // CT spawn ↔ B hall ↔ B site
  carve(world, 30, 2, 3, 34, 4, 8);
  carve(world, 23, 2, 3, 31, 4, 9);
  carve(world, 22, 2, 4, 26, 4, 10);

  // CT spawn ↔ A hall
  carve(world, 48, 2, 3, 52, 4, 8);
  carve(world, 58, 2, 8, 62, 4, 12);

  // Mid ↔ cat / short
  carve(world, 44, 2, 21, 46, 4, 24);
}

function lamp(world, x, z) {
  world.fill(x, 2, z, x, 5, z, BLOCK.PILLAR);
  world.fill(x, 6, z, x, 6, z, BLOCK.WOOD);
}

function shop(world, x, z, w, d, stories, type, doorFacing) {
  const h = 3 + stories * 2;
  world.fill(x, 2, z, x + w - 1, h, z, type);
  world.fill(x, 2, z + d - 1, x + w - 1, h, z + d - 1, type);
  world.fill(x, 2, z, x, h, z + d - 1, type);
  world.fill(x + w - 1, 2, z, x + w - 1, h, z + d - 1, type);
  world.fill(x, h, z, x + w - 1, h, z + d - 1, type);
  if (w > 3 && d > 3) world.carve(x + 1, 2, z + 1, x + w - 2, h - 1, z + d - 2);
  if (doorFacing === "z-") world.carve(x + Math.floor(w / 2) - 1, 2, z, x + Math.floor(w / 2) + 1, 4, z);
  if (doorFacing === "z+") world.carve(x + Math.floor(w / 2) - 1, 2, z + d - 1, x + Math.floor(w / 2) + 1, 4, z + d - 1);
  if (doorFacing === "x-") world.carve(x, 2, z + Math.floor(d / 2) - 1, x, 4, z + Math.floor(d / 2) + 1);
  if (doorFacing === "x+") world.carve(x + w - 1, 2, z + Math.floor(d / 2) - 1, x + w - 1, 4, z + Math.floor(d / 2) + 1);
  world.carve(x + 1, 4, z, x + 2, 5, z);
  world.carve(x + w - 3, 4, z + d - 1, x + w - 2, 5, z + d - 1);
}

function buildCityEnds(world) {
  // T town — south end, far from CT
  world.fill(36, 1, 90, 60, 1, 109, BLOCK.DARK);
  wallBoxWorld(world, 36, 90, 60, 109, 2, 6, BLOCK.BRICK);
  world.carve(37, 2, 91, 59, 5, 108);
  world.carve(42, 2, 90, 54, 5, 90);
  shop(world, 37, 92, 7, 6, 2, BLOCK.BRICK, "x+");
  shop(world, 53, 92, 7, 6, 2, BLOCK.SANDSTONE, "x-");
  shop(world, 37, 101, 6, 7, 2, BLOCK.BRICK, "z-");
  shop(world, 54, 101, 6, 7, 2, BLOCK.WOOD, "z-");
  lamp(world, 41, 98);
  lamp(world, 55, 98);
  crate(world, 39 - OX, 96 - OZ, 2, 2, 2, 1);
  crate(world, 52 - OX, 105 - OZ, 2, 2, 2, 2);
  column(world, 46 - OX, 100 - OZ, 2, 6);

  // Street from T town into old T courtyard (z 76-89 world)
  world.fill(42, 1, 86, 54, 1, 90, BLOCK.DARK);
  world.carve(42, 2, 86, 54, 5, 91);

  // CT town — north end
  world.fill(36, 1, 2, 60, 1, 20, BLOCK.DARK);
  wallBoxWorld(world, 36, 2, 60, 14, 2, 6, BLOCK.BRICK);
  world.carve(37, 2, 3, 59, 5, 13);
  world.carve(42, 2, 14, 54, 5, 14);
  shop(world, 37, 3, 7, 5, 2, BLOCK.BRICK, "x+");
  shop(world, 53, 3, 7, 5, 2, BLOCK.SANDSTONE, "x-");
  lamp(world, 41, 8);
  lamp(world, 55, 8);
  crate(world, 40 - OX, 6 - OZ, 2, 2, 2, 1);
  crate(world, 50 - OX, 9 - OZ, 2, 2, 1, 2);

  world.fill(42, 1, 14, 54, 1, 24, BLOCK.DARK);
  world.carve(42, 2, 14, 54, 5, 24);
}

function wallBoxWorld(world, x0, z0, x1, z1, y0, y1, type) {
  world.fill(x0, y0, z0, x1, y1, z0, type);
  world.fill(x0, y0, z1, x1, y1, z1, type);
  world.fill(x0, y0, z0, x0, y1, z1, type);
  world.fill(x1, y0, z0, x1, y1, z1, type);
}

function buildCityBlocks(world) {
  // West alley shops beside the tunnels (keep the tunnel route clear)
  shop(world, 3, 52, 7, 6, 2, BLOCK.BRICK, "x+");
  shop(world, 3, 62, 7, 6, 1, BLOCK.SANDSTONE, "x+");
  shop(world, 3, 74, 7, 6, 2, BLOCK.BRICK, "z+");
  lamp(world, 12, 58);
  lamp(world, 12, 70);

  // East market beside cat / long
  shop(world, 58, 54, 8, 7, 2, BLOCK.BRICK, "x-");
  shop(world, 60, 64, 7, 6, 2, BLOCK.WOOD, "z+");
  shop(world, 58, 74, 8, 6, 1, BLOCK.SANDSTONE, "x-");
  lamp(world, 56, 60);
  lamp(world, 56, 72);
  crate(world, 55 - OX, 58 - OZ, 2, 2, 2, 2);
  crate(world, 24 - OX, 56 - OZ, 2, 2, 2, 1);

  // Paved mid approach
  world.fill(42, 1, 70, 52, 1, 78, BLOCK.DARK);
}

export const WAYPOINTS = [
  { id: "t_town", x: 47, z: 104, links: ["t_street"] },
  { id: "t_street", x: 47, z: 92, links: ["t_town", "tspawn"] },
  { id: "tspawn", x: 47, z: 82, links: ["t_street", "t_mid", "t_tun", "t_long"] },
  { id: "t_mid", x: 47, z: 72, links: ["tspawn", "mid_south", "mid_doors"] },
  { id: "mid_south", x: 47, z: 68, links: ["t_mid", "mid_doors"] },
  { id: "mid_doors", x: 44, z: 63, links: ["t_mid", "mid_south", "xbox", "mid_rpg"] },
  { id: "xbox", x: 43, z: 46, links: ["mid_doors", "cat", "ct_mid2", "mid_rpg"] },
  { id: "mid_rpg", x: 49, z: 49, links: ["xbox", "cat", "mid_doors"] },
  { id: "cat", x: 58, z: 44, links: ["xbox", "short", "mid_rpg"] },
  { id: "short", x: 64, z: 38, links: ["cat", "a_short2", "asite"] },
  { id: "a_short2", x: 68, z: 34, links: ["short", "asite"] },
  { id: "t_long", x: 66, z: 82, links: ["tspawn", "long_south"] },
  { id: "long_south", x: 78, z: 78, links: ["t_long", "long_mid"] },
  { id: "long_mid", x: 78, z: 70, links: ["long_south", "long_corner"] },
  { id: "long_corner", x: 78, z: 64, links: ["long_mid", "long_doors"] },
  { id: "long_doors", x: 78, z: 58, links: ["long_corner", "pit", "asite"] },
  { id: "pit", x: 65, z: 40, links: ["long_doors", "asite"] },
  { id: "asite", x: 72, z: 34, links: ["short", "a_short2", "pit", "long_doors", "ct_a"] },
  { id: "ct_a", x: 64, z: 28, links: ["asite", "ctspawn"] },
  { id: "t_tun", x: 30, z: 80, links: ["tspawn", "lower"] },
  { id: "lower", x: 23, z: 62, links: ["t_tun", "tun_mid"] },
  { id: "tun_mid", x: 21, z: 55, links: ["lower", "upper"] },
  { id: "upper", x: 21, z: 48, links: ["tun_mid", "b_doors"] },
  { id: "b_doors", x: 22, z: 38, links: ["upper", "bsite"] },
  { id: "bsite", x: 26, z: 35, links: ["b_doors", "ct_b"] },
  { id: "ct_b", x: 32, z: 29, links: ["bsite", "ctspawn"] },
  { id: "ctspawn", x: 47, z: 27, links: ["ct_street", "ct_mid", "ct_a", "ct_b"] },
  { id: "ct_street", x: 47, z: 16, links: ["ctspawn", "ct_town"] },
  { id: "ct_town", x: 47, z: 6, links: ["ct_street"] },
  { id: "ct_mid", x: 47, z: 36, links: ["ctspawn", "ct_mid2"] },
  { id: "ct_mid2", x: 47, z: 40, links: ["ct_mid", "xbox"] },
];
