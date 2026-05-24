"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { getRoadX, getRoadY, terrainH } from "../utils/pathGenerator";

// ── Config ──────────────────────────────────────────────────────
const ROAD_SEGS  = 120;
const ROAD_HW    = 5.6;
const CURB_W     = 0.5;
const CURB_H     = 0.16;
const TERR_HW    = 350;
const TERR_COLS  = 18;

// ── Road geometry ────────────────────────────────────────────────
function buildRoad(startZ: number, length: number) {
  const segs = ROAD_SEGS;
  const pos: number[] = [], nor: number[] = [], uvs: number[] = [], idx: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const t  = i / segs;
    const z  = startZ + t * length;
    const x  = getRoadX(z);
    const y  = getRoadY(z);

    // Tangent via finite difference
    const dz = length / segs * 0.5;
    const tx = getRoadX(z + dz) - getRoadX(z - dz);
    const tz = 2 * dz;
    const len = Math.sqrt(tx * tx + tz * tz);
    // Binormal (perpendicular in XZ plane)
    const bx =  tz / len;
    const bz = -tx / len;

    const crown = 0.07;
    // Left edge, center (crown), right edge
    pos.push(
      x + bx * -ROAD_HW, y,        z + bz * -ROAD_HW,
      x,                  y+crown,  z,
      x + bx *  ROAD_HW, y,        z + bz *  ROAD_HW,
    );
    nor.push(0,1,0, 0,1,0, 0,1,0);
    const vt = t * segs * 2.0;
    uvs.push(0,vt, 0.5,vt, 1,vt);
  }

  for (let i = 0; i < segs; i++) {
    const b = i * 3;
    idx.push(b,b+3,b+1, b+1,b+3,b+4);   // left half
    idx.push(b+1,b+4,b+2, b+2,b+4,b+5); // right half
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal",   new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv",       new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ── Curb geometry ────────────────────────────────────────────────
function buildCurb(startZ: number, length: number, side: 1|-1) {
  const segs = ROAD_SEGS;
  const pos: number[] = [], nor: number[] = [], idx: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const t  = i / segs;
    const z  = startZ + t * length;
    const x  = getRoadX(z);
    const y  = getRoadY(z);
    const dz = length / segs * 0.5;
    const tx = getRoadX(z + dz) - getRoadX(z - dz);
    const tz = 2 * dz;
    const len = Math.sqrt(tx * tx + tz * tz);
    const bx  =  tz / len;
    const bz  = -tx / len;

    const s = side;
    pos.push(
      x + bx * s * ROAD_HW,           y + CURB_H,        z + bz * s * ROAD_HW,
      x + bx * s * (ROAD_HW+CURB_W),  y + CURB_H * 0.2,  z + bz * s * (ROAD_HW+CURB_W),
    );
    nor.push(0,1,0, 0,1,0);
  }

  for (let i = 0; i < segs; i++) {
    const b = i * 2;
    if (side === 1) idx.push(b,b+2,b+1, b+1,b+2,b+3);
    else            idx.push(b,b+1,b+2, b+1,b+3,b+2);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal",   new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ── Terrain — stitches seamlessly via global terrainH() ──────────
function buildTerrain(startZ: number, length: number) {
  const segs = ROAD_SEGS;
  const cols = TERR_COLS * 2; // columns each side = total TERR_COLS*2+1
  const w    = cols + 1;
  const pos: number[] = [], nor: number[] = [], uvs: number[] = [], idx: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const t  = i / segs;
    const z  = startZ + t * length;
    const rx = getRoadX(z);
    const ry = getRoadY(z);

    // Binormal
    const dz = length / segs * 0.5;
    const tx = getRoadX(z + dz) - getRoadX(z - dz);
    const tz = 2 * dz;
    const tl = Math.sqrt(tx * tx + tz * tz);
    const bx =  tz / tl;
    const bz = -tx / tl;

    for (let j = 0; j <= cols; j++) {
      const frac   = (j / cols) * 2 - 1;           // -1 to +1
      const offset = frac * TERR_HW;
      const wx     = rx + bx * offset;
      const wz     = rz_at(z, bz, offset);

      // Blend: at road edge (|frac|≈0.016) terrain locks to road height;
      // outside it follows natural terrain
      const distFrac = Math.abs(frac);
      const roadEdgeFrac = (ROAD_HW + CURB_W) / TERR_HW;
      const blend = Math.max(0, (distFrac - roadEdgeFrac) / (1 - roadEdgeFrac));
      const blendSm = blend * blend * (3 - 2 * blend); // smoothstep

      const natural = terrainH(wx, wz);
      const y = THREE.MathUtils.lerp(ry - 0.1, natural, blendSm);

      pos.push(wx, y, wz);
      nor.push(0,1,0);
      uvs.push((frac+1)*0.5, t*5);
    }
  }

  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i*w+j, b=a+1, c=a+w, d=c+1;
      idx.push(a,c,b, b,c,d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal",   new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("uv",       new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// helper: world-z along the binormal
function rz_at(z: number, bz: number, offset: number) { return z + bz * offset; }

// ── Dash marks ───────────────────────────────────────────────────
function makeDashes(startZ: number, length: number, count = 32) {
  const pts: [number,number,number][] = [];
  for (let i = 0; i < count; i++) {
    const z = startZ + ((i+0.5)/count) * length;
    pts.push([getRoadX(z), getRoadY(z), z]);
  }
  return pts;
}

// ── Component ────────────────────────────────────────────────────
type TOD = "dawn" | "day" | "dusk" | "night";
type Theme = "hills" | "desert" | "snow";

const GRASS_COLORS: Record<Theme, Record<TOD, string>> = {
  hills:  { dawn: "#4e7e50", day: "#4e8c4a", dusk: "#4a6438", night: "#192618" },
  desert: { dawn: "#b87040", day: "#d29060", dusk: "#a05030", night: "#2d1b10" },
  snow:   { dawn: "#cbdbe6", day: "#e5eff5", dusk: "#b3c7d6", night: "#15202a" }
};

const ROAD_COLORS: Record<Theme, Record<TOD, string>> = {
  hills:  { dawn: "#383838", day: "#2a2a2a", dusk: "#262626", night: "#161616" },
  desert: { dawn: "#443c38", day: "#38322e", dusk: "#2d2825", night: "#1c1816" },
  snow:   { dawn: "#2b343c", day: "#222a30", dusk: "#1c2227", night: "#0f1317" }
};

export function RoadChunk({
  startZ,
  length,
  timeOfDay = "day",
  theme = "hills",
}: {
  startZ: number;
  length: number;
  timeOfDay?: TOD;
  theme?: Theme;
}) {
  const roadGeo  = useMemo(() => buildRoad(startZ, length),      [startZ, length]);
  const curbL    = useMemo(() => buildCurb(startZ, length, -1),  [startZ, length]);
  const curbR    = useMemo(() => buildCurb(startZ, length,  1),  [startZ, length]);
  const terrGeo  = useMemo(() => buildTerrain(startZ, length),   [startZ, length]);
  const dashes   = useMemo(() => makeDashes(startZ, length, 34), [startZ, length]);

  // Dash marks: yellow dividers in Desert and Snow, white in Hills
  const dashColor = theme === "hills" ? "#e8e8e8" : "#f59e0b";
  const dashEmissive = theme === "hills" ? "#ffffff" : "#f59e0b";

  return (
    <group>
      <mesh geometry={terrGeo} receiveShadow>
        <meshStandardMaterial color={GRASS_COLORS[theme][timeOfDay]} roughness={0.92} flatShading={false} />
      </mesh>
      <mesh geometry={roadGeo} receiveShadow>
        <meshStandardMaterial color={ROAD_COLORS[theme][timeOfDay]} roughness={0.88} metalness={0.03} />
      </mesh>
      <mesh geometry={curbL} receiveShadow>
        <meshStandardMaterial color="#aaaaaa" roughness={0.75} />
      </mesh>
      <mesh geometry={curbR} receiveShadow>
        <meshStandardMaterial color="#aaaaaa" roughness={0.75} />
      </mesh>
      {dashes.map(([x,y,z], i) => (
        <mesh key={i} position={[x, y+0.05, z]}>
          <planeGeometry args={[0.15, 2.4]} />
          <meshStandardMaterial color={dashColor} roughness={0.7} emissive={dashEmissive} emissiveIntensity={0.08} />
        </mesh>
      ))}
    </group>
  );
}