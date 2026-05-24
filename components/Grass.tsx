import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { getGlobalPointAtZ } from "../utils/pathGenerator";
import { ThemeId } from "../utils/pathGenerator";

const CHUNK_LENGTH = 600;
export function getGrassClumps(chunkIdx: number) {
  const rng = (n: number) => Math.abs(Math.sin(n * 199.3 + chunkIdx * 67.1) * 35758.7453) % 1;
  const out = [];
  for (let i = 0; i < 60; i++) {
    const localZ = rng(i * 4) * CHUNK_LENGTH;
    const z      = -(chunkIdx * CHUNK_LENGTH + localZ);
    const side   = rng(i * 4 + 1) > 0.5 ? 1 : -1;
    const dist   = 6 + rng(i * 4 + 2) * 45;
    const pt     = getGlobalPointAtZ(z);
    out.push({ x: pt.x + side * dist, y: pt.y, z, s: 0.5 + rng(i * 9) * 1.2, ry: rng(i * 14) * Math.PI * 2 });
  }
  return out;
}

export function GrassClumps({ chunks, theme }: { chunks: number[]; theme: ThemeId }) {
  if (theme === "desert" || theme === "sanddunes") return null;
  const allGrass = useMemo(() => chunks.flatMap(c => getGrassClumps(c)), [chunks]);
  const clr = theme === "snow" ? "#c8d8e4" : "#3a7030";
  const clr2 = theme === "snow" ? "#b0c4d0" : "#2e5a28";
  
  return (
    <group>
      {/* Dense grass clusters using 5 slightly offset blades per clump */}
      {[
        { ox: 0, oz: 0, s: 1.0, clr },
        { ox: 0.15, oz: 0.15, s: 0.8, clr: clr2 },
        { ox: -0.15, oz: 0.1, s: 0.9, clr },
        { ox: 0.1, oz: -0.15, s: 0.7, clr: clr2 },
        { ox: -0.1, oz: -0.15, s: 0.85, clr }
      ].map((offset, j) => (
        <Instances key={`grass-group-${j}`} castShadow>
          <coneGeometry args={[0.06, 0.5, 3]} />
          <meshStandardMaterial color={offset.clr} roughness={0.9} />
          {allGrass.map((g, i) => {
            const rx = offset.ox * g.s * Math.cos(g.ry) - offset.oz * g.s * Math.sin(g.ry);
            const rz = offset.ox * g.s * Math.sin(g.ry) + offset.oz * g.s * Math.cos(g.ry);
            return <Instance key={`g-${j}-${i}`} position={[g.x + rx, g.y + 0.25 * g.s * offset.s, g.z + rz]} rotation={[(Math.random()-0.5)*0.2, g.ry, (Math.random()-0.5)*0.2]} scale={g.s * offset.s} />;
          })}
        </Instances>
      ))}
    </group>
  );
}
