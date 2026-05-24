"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { getRoadX, getRoadY, terrainH } from "../utils/pathGenerator";
import { getAsphaltNormal, getDirtNormal } from "../utils/textureGen";

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
      
      // Dynamic Bridge Logic: Check if road is far above center terrain
      const centerNatural = terrainH(rx, z);
      const gap = ry - centerNatural;
      const bridgeFactor = THREE.MathUtils.clamp((gap - 8) / 4, 0, 1);
      
      const roadBoundY = THREE.MathUtils.lerp(ry - 0.1, natural, blendSm);
      // If bridgeFactor is 1, terrain drops to its natural valley shape
      const y = THREE.MathUtils.lerp(roadBoundY, natural, bridgeFactor);

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

// ── Edge lines geometry ──────────────────────────────────────────
function buildEdgeLine(startZ: number, length: number, side: 1|-1) {
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
    const edgeOffset = ROAD_HW - 0.4;
    const lineWidth = 0.15;
    
    pos.push(
      x + bx * s * edgeOffset,           y + 0.02,  z + bz * s * edgeOffset,
      x + bx * s * (edgeOffset+lineWidth), y + 0.02,  z + bz * s * (edgeOffset+lineWidth),
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

type TOD = "dawn" | "day" | "dusk" | "night";
export type Theme = "hills" | "desert" | "snow" | "forest" | "sea" | "sanddunes";

const GRASS_COLORS: Record<Theme, Record<TOD, string>> = {
  hills:  { dawn: "#4e7e50", day: "#4e8c4a", dusk: "#4a6438", night: "#192618" },
  desert: { dawn: "#b87040", day: "#d29060", dusk: "#a05030", night: "#2d1b10" },
  snow:   { dawn: "#cbdbe6", day: "#e5eff5", dusk: "#b3c7d6", night: "#15202a" },
  forest: { dawn: "#2a4d2c", day: "#2e5b30", dusk: "#203a22", night: "#0d170e" },
  sea:    { dawn: "#6a8c5a", day: "#76a463", dusk: "#5a7a48", night: "#1c2616" },
  sanddunes:{ dawn: "#d69a65", day: "#e6b07c", dusk: "#b57945", night: "#332212" },
};

const ROAD_COLORS: Record<Theme, Record<TOD, string>> = {
  hills:  { dawn: "#222426", day: "#1a1b1d", dusk: "#18191a", night: "#0c0c0d" },
  desert: { dawn: "#2d2825", day: "#221e1c", dusk: "#1c1816", night: "#0f0d0c" },
  snow:   { dawn: "#1f252a", day: "#161b20", dusk: "#111518", night: "#0a0c0f" },
  forest: { dawn: "#1c1e1f", day: "#121314", dusk: "#101111", night: "#080809" },
  sea:    { dawn: "#2b2e30", day: "#232628", dusk: "#1f2224", night: "#0f1112" },
  sanddunes:{ dawn: "#38312d", day: "#2e2825", dusk: "#241f1c", night: "#14110f" }
};

import { Instances, Instance } from "@react-three/drei";

interface RoadChunkProps {
  startZ: number;
  length: number;
  timeOfDay: string;
  theme: Theme;
  weather?: string;
}

export function RoadChunk({ startZ, length, timeOfDay, theme, weather }: RoadChunkProps) {
  const roadGeo  = useMemo(() => buildRoad(startZ, length),      [startZ, length]);
  const curbL    = useMemo(() => buildCurb(startZ, length, -1),  [startZ, length]);
  const curbR    = useMemo(() => buildCurb(startZ, length,  1),  [startZ, length]);
  const edgeL    = useMemo(() => buildEdgeLine(startZ, length, -1), [startZ, length]);
  const edgeR    = useMemo(() => buildEdgeLine(startZ, length, 1),  [startZ, length]);
  const terrGeo  = useMemo(() => buildTerrain(startZ, length),   [startZ, length]);
  
  // Calculate dashes with proper rotation
  const dashes = useMemo(() => {
    const pts = [];
    const count = 34;
    for (let i = 0; i < count; i++) {
      const z = startZ + ((i+0.5)/count) * length;
      const dz = length / ROAD_SEGS * 0.5;
      const tx = getRoadX(z + dz) - getRoadX(z - dz);
      const tz = 2 * dz;
      const angle = Math.atan2(tx, tz);
      pts.push({ x: getRoadX(z), y: getRoadY(z) + 0.05, z, angle });
    }
    return pts;
  }, [startZ, length]);

  // Calculate dynamic bridge parts
  const bridgeData = useMemo(() => {
    const pillars = [];
    const rails = [];
    for (let i = 0; i <= ROAD_SEGS; i += 2) {
      const t = i / ROAD_SEGS;
      const z = startZ + t * length;
      const rx = getRoadX(z);
      const ry = getRoadY(z);
      const centerNatural = terrainH(rx, z);
      const gap = ry - centerNatural;
      const bridgeFactor = THREE.MathUtils.clamp((gap - 8) / 4, 0, 1);
      
      if (bridgeFactor > 0.5) {
        const dz = length / ROAD_SEGS * 0.5;
        const tx = getRoadX(z + dz) - getRoadX(z - dz);
        const tz = 2 * dz;
        const lenVec = Math.sqrt(tx * tx + tz * tz);
        const angle = Math.atan2(tx, tz);
        const bx = tz / lenVec;
        const bz = -tx / lenVec;
        
        rails.push({ x: rx, y: ry, z, angle, bx, bz });
        
        // Place pillars less frequently
        if (i % 16 === 0) {
          pillars.push({ x: rx, y: centerNatural + gap / 2, z, angle, h: gap });
        }
      }
    }
    return { pillars, rails };
  }, [startZ, length]);

  const dashColor = theme === "hills" ? "#e8e8e8" : "#f59e0b";
  const dashEmissive = theme === "hills" ? "#ffffff" : "#f59e0b";
  const edgeColor = "#ffffff";
  
  // Lazy-load procedural normal maps
  const asphaltNormal = useMemo(() => {
    if (typeof window !== "undefined") return getAsphaltNormal();
    return undefined;
  }, []);
  const dirtNormal = useMemo(() => {
    if (typeof window !== "undefined") return getDirtNormal();
    return undefined;
  }, []);

  const isWet = weather === "storm" || weather === "rain" || weather === "thunder";

  return (
    <group>
      {/* ── Road Surface ── */}
      <mesh geometry={roadGeo} receiveShadow castShadow>
        <meshStandardMaterial 
          color={ROAD_COLORS[theme][timeOfDay]} 
          roughness={isWet ? 0.1 : 0.85} 
          metalness={isWet ? 0.8 : 0.1}
          normalMap={asphaltNormal}
          normalScale={new THREE.Vector2(0.8, 0.8)}
        />
      </mesh>

      {/* ── Curbs / Sidewalks ── */}
      <mesh geometry={curbL} receiveShadow castShadow>
        <meshStandardMaterial color="#333333" roughness={0.9} normalMap={asphaltNormal} normalScale={new THREE.Vector2(0.5, 0.5)} />
      </mesh>
      <mesh geometry={curbR} receiveShadow castShadow>
        <meshStandardMaterial color="#333333" roughness={0.9} normalMap={asphaltNormal} normalScale={new THREE.Vector2(0.5, 0.5)} />
      </mesh>

      {/* ── Terrain ── */}
      <mesh geometry={terrGeo} receiveShadow castShadow>
        <meshStandardMaterial 
          color={GRASS_COLORS[theme][timeOfDay]} 
          roughness={1.0}
          flatShading
          normalMap={dirtNormal}
          normalScale={new THREE.Vector2(1.5, 1.5)}
        />
      </mesh>

      {/* Continuous Edge Lines */}
      <mesh geometry={edgeL}>
        <meshStandardMaterial color={edgeColor} roughness={0.5} emissive={edgeColor} emissiveIntensity={0.1} />
      </mesh>
      <mesh geometry={edgeR}>
        <meshStandardMaterial color={edgeColor} roughness={0.5} emissive={edgeColor} emissiveIntensity={0.1} />
      </mesh>

      {/* Dashed Center Line */}
      <Instances>
        <planeGeometry args={[0.15, 2.4]} />
        <meshStandardMaterial color={dashColor} roughness={0.5} emissive={dashEmissive} emissiveIntensity={0.15} />
        {dashes.map((d, i) => (
          <Instance key={i} position={[d.x, d.y, d.z]} rotation={[-Math.PI/2, 0, d.angle]} />
        ))}
      </Instances>

      {/* Bridge Pillars */}
      {bridgeData.pillars.length > 0 && (
        <Instances castShadow receiveShadow>
          <boxGeometry args={[ROAD_HW * 1.6, 1, 3.0]} />
          <meshStandardMaterial color="#888c8d" roughness={0.8} />
          {bridgeData.pillars.map((p, i) => (
            <Instance key={`pillar-${i}`} position={[p.x, p.y, p.z]} rotation={[0, p.angle, 0]} scale={[1, p.h, 1]} />
          ))}
        </Instances>
      )}

      {/* Bridge Guardrails */}
      {bridgeData.rails.length > 0 && (
        <Instances castShadow>
          <boxGeometry args={[0.3, 1.4, Math.abs(length / ROAD_SEGS * 2.1)]} />
          <meshStandardMaterial color="#b0b4b5" roughness={0.7} />
          {bridgeData.rails.map((r, i) => <Instance key={`rl-${i}`} position={[r.x + r.bx * (ROAD_HW + 0.2), r.y + 0.5, r.z + r.bz * (ROAD_HW + 0.2)]} rotation={[0, r.angle, 0]} />)}
          {bridgeData.rails.map((r, i) => <Instance key={`rr-${i}`} position={[r.x - r.bx * (ROAD_HW + 0.2), r.y + 0.5, r.z - r.bz * (ROAD_HW + 0.2)]} rotation={[0, r.angle, 0]} />)}
        </Instances>
      )}

    </group>
  );
}