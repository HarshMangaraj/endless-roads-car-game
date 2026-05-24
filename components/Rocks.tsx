import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { getGlobalPointAtZ } from "../utils/pathGenerator";
import { ThemeId } from "../utils/pathGenerator";

const CHUNK_LENGTH = 600;
export function getRocks(chunkIdx: number) {
  const rng = (n: number) => Math.abs(Math.sin(n * 311.7 + chunkIdx * 97.3) * 21758.1453) % 1;
  const out = [];
  for (let i = 0; i < 18; i++) {
    const localZ = rng(i * 5) * CHUNK_LENGTH;
    const z      = -(chunkIdx * CHUNK_LENGTH + localZ);
    const side   = rng(i * 5 + 1) > 0.5 ? 1 : -1;
    const dist   = 18 + rng(i * 5 + 2) * 90;
    const pt     = getGlobalPointAtZ(z);
    out.push({ x: pt.x + side * dist, y: pt.y - 0.3, z, s: 0.5 + rng(i * 11) * 1.8, ry: rng(i * 13) * Math.PI * 2 });
  }
  return out;
}

export function Rocks({ chunks, theme }: { chunks: number[]; theme: ThemeId }) {
  const allRocks = useMemo(() => chunks.flatMap(c => getRocks(c)), [chunks]);
  
  const rockColor = theme === "desert" || theme === "sanddunes" ? "#8b6914" : theme === "snow" ? "#6b7b8d" : "#5a5a52";
  const rockColor2 = theme === "desert" || theme === "sanddunes" ? "#a07830" : theme === "snow" ? "#8090a0" : "#4a4a42";
  
  return (
    <group>
      <Instances castShadow receiveShadow>
        <dodecahedronGeometry args={[1.0, 0]} />
        <meshStandardMaterial color={rockColor} roughness={0.95} flatShading />
        {allRocks.map((r, i) => <Instance key={`r1-${i}`} position={[r.x, r.y, r.z]} rotation={[0, r.ry, 0]} scale={r.s} />)}
      </Instances>
      <Instances castShadow receiveShadow>
        <dodecahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color={rockColor2} roughness={0.95} flatShading />
        {allRocks.map((r, i) => {
          // Calculate offset relative to rotation
          const ox = 0.6 * r.s * Math.cos(r.ry) - 0.4 * r.s * Math.sin(r.ry);
          const oz = 0.6 * r.s * Math.sin(r.ry) + 0.4 * r.s * Math.cos(r.ry);
          return <Instance key={`r2-${i}`} position={[r.x + ox, r.y - 0.2 * r.s, r.z + oz]} rotation={[0, r.ry, 0]} scale={r.s} />;
        })}
      </Instances>
    </group>
  );
}
