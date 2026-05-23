"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Much larger, sleeker car matching the slowroads.io reference (low-slung sports sedan)
// All units in Three.js meters. Car length ~6m, width ~2.6m — fills the frame nicely.

function Wheel({ pos }: { pos: [number,number,number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_,dt) => { if(ref.current) ref.current.rotation.x -= dt*5; });
  return (
    <group ref={ref} position={pos}>
      {/* Tire */}
      <mesh rotation={[0,0,Math.PI/2]}>
        <cylinderGeometry args={[0.42,0.42,0.28,18]} />
        <meshStandardMaterial color="#111" roughness={0.95} />
      </mesh>
      {/* Rim */}
      <mesh rotation={[0,0,Math.PI/2]}>
        <cylinderGeometry args={[0.27,0.27,0.30,12]} />
        <meshStandardMaterial color="#c0c0c8" roughness={0.25} metalness={0.85} />
      </mesh>
      {/* Spoke cross */}
      {[0,1].map(k=>(
        <mesh key={k} rotation={[Math.PI/2, k*Math.PI/2, 0]} position={[k===0?0.155:0, 0, k===0?0:0.155]}>
          <boxGeometry args={[0.04, 0.5, 0.04]} />
          <meshStandardMaterial color="#888" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

export function Car({ groupRef, color="#4a4a5a" }: {
  groupRef: React.RefObject<THREE.Group|null>;
  color?: string;
}) {
  // Reference: slowroads.io white/silver sports sedan, low profile, wide
  const BL = 2.6;  // body length half
  const BW = 1.28; // body half-width
  const BH = 0.42; // body half-height (sits low)
  const BY = BH;   // body center Y (bottom at y=0)
  const cabY = BY + BH + 0.3;

  return (
    <group ref={groupRef}>

      {/* ── Lower body ── */}
      <mesh position={[0, BY, 0]} castShadow receiveShadow>
        <boxGeometry args={[BW*2, BH*2, BL*2]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.35} />
      </mesh>

      {/* ── Wide sill / skirt strips ── */}
      {([-1,1] as const).map((s,i) => (
        <mesh key={i} position={[s*(BW+0.06), BY*0.5, 0]} castShadow>
          <boxGeometry args={[0.12, BY, BL*2]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
        </mesh>
      ))}

      {/* ── Cabin / greenhouse ── */}
      <mesh position={[0, cabY, 0.3]} castShadow>
        <boxGeometry args={[BW*1.82, 0.52, BL*0.88]} />
        <meshStandardMaterial color={color} roughness={0.3} metalness={0.3} />
      </mesh>

      {/* ── Roof ── */}
      <mesh position={[0, cabY+0.28, 0.3]} castShadow>
        <boxGeometry args={[BW*1.72, 0.16, BL*0.76]} />
        <meshStandardMaterial color={color} roughness={0.28} metalness={0.32} />
      </mesh>

      {/* ── Windshield ── */}
      <mesh position={[0, cabY+0.05, -BL*0.38]} rotation={[0.44,0,0]}>
        <planeGeometry args={[BW*1.7, 0.65]} />
        <meshStandardMaterial color="#1a2a3a" transparent opacity={0.72}
          roughness={0.05} metalness={0.5} side={THREE.DoubleSide}/>
      </mesh>

      {/* ── Rear window ── */}
      <mesh position={[0, cabY+0.05, BL*0.44]} rotation={[-0.38,0,0]}>
        <planeGeometry args={[BW*1.62, 0.56]} />
        <meshStandardMaterial color="#1a2a3a" transparent opacity={0.65}
          roughness={0.05} metalness={0.5} side={THREE.DoubleSide}/>
      </mesh>

      {/* ── Side windows ── */}
      {([-1,1] as const).map((s,i)=>(
        <mesh key={i} position={[s*(BW*0.915), cabY+0.04, 0.26]} rotation={[0,Math.PI/2,0]}>
          <planeGeometry args={[BL*0.68, 0.46]} />
          <meshStandardMaterial color="#1a2a3a" transparent opacity={0.6}
            roughness={0.05} metalness={0.5} side={THREE.DoubleSide}/>
        </mesh>
      ))}

      {/* ── Hood (sloped) ── */}
      <mesh position={[0, BY*1.82, -BL*0.72]} rotation={[-0.1,0,0]} castShadow>
        <boxGeometry args={[BW*1.94, 0.1, BL*0.58]} />
        <meshStandardMaterial color={color} roughness={0.28} metalness={0.32} />
      </mesh>

      {/* ── Trunk lid ── */}
      <mesh position={[0, BY*1.78, BL*0.72]} rotation={[0.06,0,0]} castShadow>
        <boxGeometry args={[BW*1.9, 0.1, BL*0.5]} />
        <meshStandardMaterial color={color} roughness={0.28} metalness={0.32} />
      </mesh>

      {/* ── Front bumper ── */}
      <mesh position={[0, BY*0.55, -BL-0.08]}>
        <boxGeometry args={[BW*2.1, BY*1.0, 0.14]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
      </mesh>

      {/* ── Rear bumper ── */}
      <mesh position={[0, BY*0.55, BL+0.08]}>
        <boxGeometry args={[BW*2.1, BY*1.0, 0.14]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
      </mesh>

      {/* ── Headlights (wide strips like the reference) ── */}
      {([-0.72, 0.72] as const).map((x,i)=>(
        <mesh key={i} position={[x, BY+0.1, -BL-0.07]}>
          <boxGeometry args={[0.52, 0.1, 0.06]} />
          <meshStandardMaterial color="#ffffee" emissive="#ffffcc" emissiveIntensity={1.6} />
        </mesh>
      ))}

      {/* ── Taillights — wide red bar like reference ── */}
      <mesh position={[0, BY+0.12, BL+0.07]}>
        <boxGeometry args={[BW*1.7, 0.09, 0.06]} />
        <meshStandardMaterial color="#ff1500" emissive="#ff1500" emissiveIntensity={1.2} />
      </mesh>

      {/* ── Wheels — wide track ── */}
      {([
        [-BW-0.04,  0, -BL*0.55],
        [ BW+0.04,  0, -BL*0.55],
        [-BW-0.04,  0,  BL*0.55],
        [ BW+0.04,  0,  BL*0.55],
      ] as [number,number,number][]).map((p,i)=>(
        <Wheel key={i} pos={p} />
      ))}

    </group>
  );
}