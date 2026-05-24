import { useMemo } from "react";
import { Instances, Instance } from "@react-three/drei";
import { getGlobalPointAtZ } from "../utils/pathGenerator";
import { ThemeId } from "../utils/pathGenerator";

const CHUNK_LENGTH = 600;
export function getTrees(chunkIdx: number) {
  const rng = (n: number) => Math.abs(Math.sin(n * 127.1 + chunkIdx * 43.7) * 43758.5453) % 1;
  const out = [];
  for (let i = 0; i < 38; i++) {
    const localZ = rng(i * 3) * CHUNK_LENGTH;
    const z      = -(chunkIdx * CHUNK_LENGTH + localZ);
    const side   = rng(i * 3 + 1) > 0.5 ? 1 : -1;
    const dist   = 14 + rng(i * 3 + 2) * 72;
    const pt     = getGlobalPointAtZ(z);
    out.push({ x: pt.x + side * dist, y: pt.y, z, s: 0.7 + rng(i * 7) * 1.3 });
  }
  return out;
}

export function Trees({ chunks, theme }: { chunks: number[]; theme: ThemeId }) {
  const allTrees = useMemo(() => chunks.flatMap(c => getTrees(c)), [chunks]);

  if (theme === "desert" || theme === "sanddunes") {
    return (
      <group>
        {/* Cactus Main Trunk */}
        <Instances castShadow>
          <cylinderGeometry args={[0.26, 0.26, 3.0, 7]} />
          <meshStandardMaterial color="#306b43" roughness={0.9} />
          {allTrees.map((t, i) => <Instance key={`t-trunk-${i}`} position={[t.x, t.y + 1.5 * t.s, t.z]} scale={t.s} />)}
        </Instances>
        {/* Left Arm Horizontal */}
        <Instances castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.8, 6]} />
          <meshStandardMaterial color="#306b43" roughness={0.9} />
          {allTrees.map((t, i) => <Instance key={`t-la-${i}`} position={[t.x - 0.4 * t.s, t.y + 1.6 * t.s, t.z]} rotation={[0, 0, Math.PI / 2]} scale={t.s} />)}
        </Instances>
        {/* Left Arm Vertical */}
        <Instances castShadow>
          <cylinderGeometry args={[0.2, 0.2, 1.2, 6]} />
          <meshStandardMaterial color="#306b43" roughness={0.9} />
          {allTrees.map((t, i) => <Instance key={`t-lv-${i}`} position={[t.x - 0.8 * t.s, t.y + 2.1 * t.s, t.z]} scale={t.s} />)}
        </Instances>
        {/* Right Arm Horizontal */}
        <Instances castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.6, 6]} />
          <meshStandardMaterial color="#306b43" roughness={0.9} />
          {allTrees.map((t, i) => <Instance key={`t-ra-${i}`} position={[t.x + 0.3 * t.s, t.y + 1.2 * t.s, t.z]} rotation={[0, 0, Math.PI / 2]} scale={t.s} />)}
        </Instances>
        {/* Right Arm Vertical */}
        <Instances castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.9, 6]} />
          <meshStandardMaterial color="#306b43" roughness={0.9} />
          {allTrees.map((t, i) => <Instance key={`t-rv-${i}`} position={[t.x + 0.6 * t.s, t.y + 1.55 * t.s, t.z]} scale={t.s} />)}
        </Instances>
        
        {/* Dry Scrub Bushes */}
        <Instances castShadow>
          <dodecahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color="#6b6644" roughness={1.0} flatShading />
          {allTrees.map((t, i) => {
            const ox = (t.s * 13) % 4 - 2;
            const oz = (t.x * 7) % 4 - 2;
            return <Instance key={`scrub-${i}`} position={[t.x + ox * t.s, t.y + 0.3 * t.s, t.z + oz * t.s]} scale={t.s * 0.7} />;
          })}
        </Instances>
      </group>
    );
  }

  // Pine tree styles for forest, snow, hills, sea
  const isSnow = theme === "snow";
  return (
    <group>
      <Instances castShadow>
        <cylinderGeometry args={[0.17, 0.24, 2.0, 5]} />
        <meshStandardMaterial color={isSnow ? "#3a251b" : "#5a3418"} roughness={0.95} />
        {allTrees.map((t, i) => <Instance key={`trunk-${i}`} position={[t.x, t.y + 1.0 * t.s, t.z]} scale={t.s} />)}
      </Instances>
      <Instances castShadow>
        <coneGeometry args={[1.5, 2.6, 6]} />
        <meshStandardMaterial color={isSnow ? "#d9e6ee" : "#2a6030"} roughness={0.88} />
        {allTrees.map((t, i) => <Instance key={`c1-${i}`} position={[t.x, t.y + 3.0 * t.s, t.z]} scale={t.s} />)}
      </Instances>
      <Instances castShadow>
        <coneGeometry args={[1.1, 2.0, 6]} />
        <meshStandardMaterial color={isSnow ? "#e8f2f8" : "#348040"} roughness={0.88} />
        {allTrees.map((t, i) => <Instance key={`c2-${i}`} position={[t.x, t.y + 4.4 * t.s, t.z]} scale={t.s} />)}
      </Instances>
      <Instances castShadow>
        <coneGeometry args={[0.65, 1.5, 5]} />
        <meshStandardMaterial color={isSnow ? "#ffffff" : "#42904e"} roughness={0.88} />
        {allTrees.map((t, i) => <Instance key={`c3-${i}`} position={[t.x, t.y + 5.6 * t.s, t.z]} scale={t.s} />)}
      </Instances>
    </group>
  );
}
