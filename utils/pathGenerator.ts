import * as THREE from "three";

// Smooth value noise
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}
function smoothstep(t: number) { return t * t * (3 - 2 * t); }
function vnoise(x: number): number {
  const i = Math.floor(x), f = x - i;
  return THREE.MathUtils.lerp(hash(i), hash(i + 1), smoothstep(f)) * 2 - 1;
}
function fbm(x: number, octaves = 5): number {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < octaves; i++) {
    v += vnoise(x * f + i * 31.7) * a;
    m += a; a *= 0.52; f *= 1.97;
  }
  return v / m;
}

// ── Theme Types ──────────────────────────────────────────
export type ThemeId = "hills" | "desert" | "snow" | "forest" | "sea" | "sanddunes";

// We export a mutable theme reference so the procedural formulas can branch
export const config = {
  theme: "forest" as ThemeId,
  autoBiome: false,   // When true, biome transitions happen by Z distance
};

// ── Auto-Biome Sequence ─────────────────────────────────
// Each biome lasts BIOME_LENGTH units of Z distance, with BIOME_BLEND
// units of smooth blending between adjacent biomes.
const BIOME_SEQUENCE: ThemeId[] = ["hills", "forest", "sea", "snow", "desert", "sanddunes"];
const BIOME_LENGTH = 6000;   // meters per biome
const BIOME_BLEND  = 1200;   // meters of smooth transition

/**
 * Returns { primary, secondary, blend } for a given Z position.
 * blend = 0 means fully in primary biome, blend = 1 means fully in secondary.
 */
function getBiomeBlend(z: number): { primary: ThemeId; secondary: ThemeId; blend: number } {
  if (!config.autoBiome) {
    return { primary: config.theme, secondary: config.theme, blend: 0 };
  }

  const absZ = Math.abs(z);
  const totalCycle = BIOME_SEQUENCE.length * BIOME_LENGTH;
  const posInCycle = absZ % totalCycle;
  const biomeIdx = Math.floor(posInCycle / BIOME_LENGTH);
  const posInBiome = posInCycle - biomeIdx * BIOME_LENGTH;

  const primary = BIOME_SEQUENCE[biomeIdx % BIOME_SEQUENCE.length];
  const nextIdx = (biomeIdx + 1) % BIOME_SEQUENCE.length;
  const secondary = BIOME_SEQUENCE[nextIdx];

  // Calculate blend factor: transition starts at (BIOME_LENGTH - BIOME_BLEND)
  const transitionStart = BIOME_LENGTH - BIOME_BLEND;
  let blend = 0;
  if (posInBiome > transitionStart) {
    blend = smoothstep((posInBiome - transitionStart) / BIOME_BLEND);
  }

  return { primary, secondary, blend };
}

// ── Per-biome road X functions ──────────────────────────
function roadXForTheme(z: number, theme: ThemeId): number {
  if (theme === "sanddunes") {
    return fbm(z * 0.0004, 3) * 60;
  } else if (theme === "sea") {
    return fbm(z * 0.0008, 4) * 40;
  } else if (theme === "snow") {
    return fbm(z * 0.0008, 5) * 150 + fbm(z * 0.0002, 3) * 80;
  } else if (theme === "forest") {
    return fbm(z * 0.001, 5) * 120 + fbm(z * 0.0002, 3) * 60;
  }
  return fbm(z * 0.0006, 4) * 100 + fbm(z * 0.00018, 3) * 55;
}

// ── Per-biome road Y functions ──────────────────────────
function roadYForTheme(z: number, theme: ThemeId): number {
  if (theme === "sanddunes") {
    return fbm(z * 0.001, 3) * 15;
  } else if (theme === "sea") {
    return fbm(z * 0.0005, 3) * 20 + z * 0.005;
  } else if (theme === "snow") {
    return fbm(z * 0.001, 5) * 70 + fbm(z * 0.0002, 3) * 45 + 15;
  } else if (theme === "forest") {
    return fbm(z * 0.0015, 5) * 40 + fbm(z * 0.0003, 3) * 25;
  }
  return fbm(z * 0.0015, 4) * 7 + fbm(z * 0.0004, 3) * 12;
}

// ── Per-biome terrain height ────────────────────────────
function terrainHForTheme(wx: number, wz: number, theme: ThemeId): number {
  const s = (n: number) => Math.sin(n) * 0.5 + 0.5;

  if (theme === "sanddunes") {
    return (
      s(wx * 0.01 + wz * 0.01) * 15 +
      s(wx * 0.03 + wz * 0.02) * 8
    ) - 5;
  }

  if (theme === "sea") {
    if (wx < -20) return -15;
    return s(wx * 0.02 + wz * 0.01) * 30 + (wx > 20 ? (wx - 20) * 0.8 : 0);
  }

  if (theme === "snow") {
    return (
      s(wx * 0.003 + wz * 0.002) * 180 + // Massive base mountains
      s(wx * 0.01 + wz * 0.008) * 60 +   // Jagged mid-details
      s(wx * 0.04 + wz * 0.03) * 15      // Sharp rocky edges
    ) - 40;
  }

  if (theme === "forest") {
    return (
      s(wx * 0.015 + wz * 0.008) * 25 +
      s(wx * 0.006 + wz * 0.01) * 40 +
      s(wx * 0.04 + wz * 0.03) * 5
    ) - 15;
  }

  return (
    s(wx * 0.019 + wz * 0.007) * 5 +
    s(wx * 0.005 + wz * 0.013) * 8 +
    s(wx * 0.002 + wz * 0.003) * 11 +
    s(wx * 0.04  + wz * 0.02 ) * 2
  ) - 8;
}

// ── Public API (blends automatically when autoBiome is on) ──

export function getRoadX(z: number): number {
  const { primary, secondary, blend } = getBiomeBlend(z);
  if (blend === 0) return roadXForTheme(z, primary);
  return THREE.MathUtils.lerp(roadXForTheme(z, primary), roadXForTheme(z, secondary), blend);
}

export function getRoadY(z: number): number {
  const { primary, secondary, blend } = getBiomeBlend(z);
  if (blend === 0) return roadYForTheme(z, primary);
  return THREE.MathUtils.lerp(roadYForTheme(z, primary), roadYForTheme(z, secondary), blend);
}

export function getGlobalPointAtZ(z: number): THREE.Vector3 {
  return new THREE.Vector3(getRoadX(z), getRoadY(z), z);
}

export function getRoadTangent(z: number): THREE.Vector3 {
  const e = 1.5;
  const a = getGlobalPointAtZ(z - e);
  const b = getGlobalPointAtZ(z + e);
  return b.clone().sub(a).normalize();
}

// This class is kept for RoadChunk useMemo compatibility
export class ProceduralRoadCurve extends THREE.Curve<THREE.Vector3> {
  startZ: number;
  length: number;
  constructor(startZ: number, length: number) {
    super();
    this.startZ = startZ;
    this.length = length;
  }
  getPoint(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    const z = this.startZ + t * this.length;
    return out.set(getRoadX(z), getRoadY(z), z);
  }
}

// Terrain height (independent of road, pure 2D noise)
export function terrainH(wx: number, wz: number): number {
  const { primary, secondary, blend } = getBiomeBlend(wz);
  if (blend === 0) return terrainHForTheme(wx, wz, primary);
  return THREE.MathUtils.lerp(
    terrainHForTheme(wx, wz, primary),
    terrainHForTheme(wx, wz, secondary),
    blend
  );
}

/**
 * Returns the current active biome at a given Z coordinate.
 * Useful for GameScene to know which decorations to spawn.
 */
export function getActiveBiome(z: number): ThemeId {
  const { primary, secondary, blend } = getBiomeBlend(z);
  return blend > 0.5 ? secondary : primary;
}

// Blends road height and terrain height based on lateral offset
export function getSurfaceHeight(z: number, lateralX: number): number {
  const rx = getRoadX(z);
  const ry = getRoadY(z);

  const tangent = getRoadTangent(z);
  const bx = tangent.z;
  const bz = -tangent.x;

  const wx = rx + bx * lateralX;
  const wz = z + bz * lateralX;

  return getGlobalSurfaceHeight(wx, wz);
}

// Global surface height query for true physics
export function getGlobalSurfaceHeight(wx: number, wz: number): number {
  const rx = getRoadX(wz);
  const ry = getRoadY(wz);
  
  const distToRoad = Math.abs(wx - rx);
  
  const ROAD_HW = 5.6;
  const CURB_W = 0.5;
  const TERR_HW = 350;

  const distFrac = distToRoad / TERR_HW;
  const roadEdgeFrac = (ROAD_HW + CURB_W) / TERR_HW;
  const blend = Math.max(0, (distFrac - roadEdgeFrac) / (1 - roadEdgeFrac));
  const blendSm = blend * blend * (3 - 2 * blend);

  const natural = terrainH(wx, wz);
  const gap = ry - natural;
  const bridgeFactor = THREE.MathUtils.clamp((gap - 8) / 4, 0, 1);
  const roadBoundY = THREE.MathUtils.lerp(ry - 0.1, natural, blendSm);
  
  return THREE.MathUtils.lerp(roadBoundY, natural, bridgeFactor);
}