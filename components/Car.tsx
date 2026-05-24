"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

interface WheelProps {
  pos: [number, number, number];
  speedRef?: React.RefObject<number>;
  scale?: number;
}

function Wheel({ pos, speedRef, scale = 1 }: WheelProps) {
  const ref = useRef<THREE.Group>(null);
  
  useFrame((_, dt) => {
    if (ref.current) {
      const speed = speedRef?.current ?? 0;
      // Wheel radius in ThreeJS is 0.42 * scale
      const radius = 0.42 * scale;
      // Angular velocity = speed / radius
      const rotSpeed = (speed / radius) * dt;
      ref.current.rotation.x -= rotSpeed;
    }
  });

  return (
    <group ref={ref} position={pos} scale={[scale, scale, scale]}>
      {/* Tire */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.42, 0.28, 18]} />
        <meshStandardMaterial color="#111111" roughness={0.95} />
      </mesh>
      {/* Rim */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.27, 0.27, 0.30, 12]} />
        <meshStandardMaterial color="#c0c0c8" roughness={0.25} metalness={0.85} />
      </mesh>
      {/* Spoke cross */}
      {[0, 1].map((k) => (
        <mesh
          key={k}
          rotation={[Math.PI / 2, (k * Math.PI) / 2, 0]}
          position={[k === 0 ? 0.155 : 0, 0, k === 0 ? 0 : 0.155]}
        >
          <boxGeometry args={[0.04, 0.5, 0.04]} />
          <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

interface CarProps {
  groupRef: React.RefObject<THREE.Group | null>;
  color?: string;
  steerRef?: React.RefObject<number>;
  speedRef?: React.RefObject<number>;
  keysHeld?: React.RefObject<Set<string>>;
  carType?: "sedan" | "coupe" | "suv";
  timeOfDay?: string;
}

export function Car({
  groupRef,
  color = "#c0392b",
  steerRef,
  speedRef,
  keysHeld,
  carType = "sedan",
  timeOfDay = "day",
}: CarProps) {
  const frontLeftRef = useRef<THREE.Group>(null);
  const frontRightRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const targetLRef = useRef<THREE.Object3D>(null);
  const targetRRef = useRef<THREE.Object3D>(null);

  // ── Frame Suspension & Steer Calculations ──
  useFrame((_, dt) => {
    // 1. Front wheels steering rotation (around Y axis)
    const steer = steerRef?.current ?? 0;
    const targetSteerAngle = -steer * 0.42; // ~24 deg max
    if (frontLeftRef.current) {
      frontLeftRef.current.rotation.y = THREE.MathUtils.lerp(
        frontLeftRef.current.rotation.y,
        targetSteerAngle,
        0.18
      );
    }
    if (frontRightRef.current) {
      frontRightRef.current.rotation.y = THREE.MathUtils.lerp(
        frontRightRef.current.rotation.y,
        targetSteerAngle,
        0.18
      );
    }

    // 2. Chassis Body roll (rotation Z) and pitch (rotation X)
    const speed = speedRef?.current ?? 0;
    const targetRoll = -steer * (speed / 150) * 0.07; // Roll away from steer direction
    
    let targetPitch = 0;
    const keys = keysHeld?.current;
    if (keys) {
      if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) {
        targetPitch = -0.024; // Braking nose dive
      } else if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) {
        targetPitch = 0.016;  // Accelerating squat
      }
    }

    if (bodyRef.current) {
      bodyRef.current.rotation.z = THREE.MathUtils.lerp(bodyRef.current.rotation.z, targetRoll, 0.12);
      bodyRef.current.rotation.x = THREE.MathUtils.lerp(bodyRef.current.rotation.x, targetPitch, 0.12);
    }
  });

  // ── Dimension Calculations based on carType ──
  const isCoupe = carType === "coupe";
  const isSuv = carType === "suv";

  // Body Dimensions
  const BL = isCoupe ? 2.7 : isSuv ? 2.4 : 2.6;    // length half
  const BW = isCoupe ? 1.32 : isSuv ? 1.34 : 1.28;  // width half
  const BH = isCoupe ? 0.35 : isSuv ? 0.65 : 0.42;  // height half
  
  // Lift body so bottom clearance works correctly relative to axles
  const BY = isSuv ? BH + 0.22 : BH; 
  const cabY = BY + BH + (isSuv ? 0.45 : isCoupe ? 0.22 : 0.3);
  
  // Wheel Setup
  const wScale = isSuv ? 1.22 : 1.0;
  const frontZ = -BL * 0.58;
  const rearZ = BL * 0.58;
  const wheelX = BW + (isSuv ? 0.08 : 0.04);

  // Brake Light configuration
  const isBraking = keysHeld?.current?.has("ArrowDown") || keysHeld?.current?.has("s") || keysHeld?.current?.has("S");
  const brakeGlow = isBraking ? 4.5 : (timeOfDay === "night" || timeOfDay === "dusk" ? 1.3 : 0.15);
  const brakeColor = isBraking ? "#ff0500" : "#aa1000";

  return (
    <group ref={groupRef}>
      {/* ── Main chassis group supporting suspension roll/pitch ── */}
      <group ref={bodyRef}>
        
        {/* Lower body shell */}
        <mesh position={[0, BY, 0]} castShadow receiveShadow>
          <boxGeometry args={[BW * 2, BH * 2, BL * 2]} />
          <meshStandardMaterial color={color} roughness={0.25} metalness={0.4} />
        </mesh>

        {/* Side Skirts */}
        {([-1, 1] as const).map((s, i) => (
          <mesh key={i} position={[s * (BW + 0.05), BY * (isSuv ? 0.75 : 0.5), 0]} castShadow>
            <boxGeometry args={[isSuv ? 0.14 : 0.10, isSuv ? 0.35 : BY, BL * 2]} />
            <meshStandardMaterial color="#141414" roughness={0.88} />
          </mesh>
        ))}

        {/* ── Cabin greenhouse ── */}
        <mesh position={[0, cabY, isCoupe ? 0.2 : 0.3]} castShadow>
          <boxGeometry args={[BW * (isSuv ? 1.88 : 1.82), isSuv ? 0.75 : isCoupe ? 0.44 : 0.52, BL * (isSuv ? 1.08 : isCoupe ? 0.78 : 0.88)]} />
          <meshStandardMaterial color={color} roughness={0.25} metalness={0.35} />
        </mesh>

        {/* Roof panel */}
        <mesh position={[0, cabY + (isSuv ? 0.38 : isCoupe ? 0.22 : 0.26), isCoupe ? 0.2 : 0.3]} castShadow>
          <boxGeometry args={[BW * (isSuv ? 1.82 : 1.72), 0.12, BL * (isSuv ? 1.02 : isCoupe ? 0.68 : 0.76)]} />
          <meshStandardMaterial color={color} roughness={0.25} metalness={0.35} />
        </mesh>

        {/* Windshield */}
        <mesh position={[0, cabY + 0.02, isCoupe ? -BL * 0.32 : -BL * 0.38]} rotation={[isCoupe ? 0.52 : isSuv ? 0.32 : 0.44, 0, 0]}>
          <planeGeometry args={[BW * 1.7, isSuv ? 0.88 : 0.65]} />
          <meshStandardMaterial
            color="#142230"
            transparent
            opacity={0.78}
            roughness={0.03}
            metalness={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Rear window */}
        <mesh position={[0, cabY + 0.02, isCoupe ? BL * 0.38 : BL * 0.44]} rotation={[isCoupe ? -0.48 : isSuv ? -0.22 : -0.38, 0, 0]}>
          <planeGeometry args={[BW * 1.62, isSuv ? 0.78 : 0.56]} />
          <meshStandardMaterial
            color="#142230"
            transparent
            opacity={0.72}
            roughness={0.03}
            metalness={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Side windows */}
        {([-1, 1] as const).map((s, i) => (
          <mesh
            key={i}
            position={[s * (BW * 0.915), cabY + 0.02, isCoupe ? 0.2 : 0.26]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[BL * (isSuv ? 0.98 : isCoupe ? 0.64 : 0.68), isSuv ? 0.66 : 0.46]} />
            <meshStandardMaterial
              color="#142230"
              transparent
              opacity={0.68}
              roughness={0.03}
              metalness={0.6}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}

        {/* Hood */}
        <mesh position={[0, BY * (isSuv ? 1.45 : 1.82), -BL * 0.72]} rotation={[isSuv ? -0.05 : -0.1, 0, 0]} castShadow>
          <boxGeometry args={[BW * 1.94, 0.1, BL * 0.58]} />
          <meshStandardMaterial color={color} roughness={0.25} metalness={0.35} />
        </mesh>

        {/* Trunk lid */}
        {!isSuv && (
          <mesh position={[0, BY * (isCoupe ? 1.82 : 1.78), BL * 0.72]} rotation={[0.06, 0, 0]} castShadow>
            <boxGeometry args={[BW * 1.9, 0.1, BL * 0.5]} />
            <meshStandardMaterial color={color} roughness={0.25} metalness={0.35} />
          </mesh>
        )}

        {/* Front bumper */}
        <mesh position={[0, BY * 0.45, -BL - 0.08]} castShadow>
          <boxGeometry args={[BW * 2.05, BY * (isSuv ? 0.65 : 0.95), 0.14]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
        </mesh>

        {/* Rear bumper */}
        <mesh position={[0, BY * 0.45, BL + 0.08]} castShadow>
          <boxGeometry args={[BW * 2.05, BY * (isSuv ? 0.65 : 0.95), 0.14]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
        </mesh>

        {/* Headlights (bars) */}
        {([-0.72, 0.72] as const).map((x, i) => (
          <mesh key={i} position={[x, BY + (isSuv ? 0.22 : 0.1), -BL - 0.07]}>
            <boxGeometry args={[isSuv ? 0.38 : 0.52, 0.1, 0.06]} />
            <meshStandardMaterial color="#ffffee" emissive="#ffffcc" emissiveIntensity={1.8} />
          </mesh>
        ))}

        {/* Taillights */}
        <mesh position={[0, BY + (isSuv ? 0.26 : 0.12), BL + 0.07]}>
          <boxGeometry args={[BW * 1.7, isSuv ? 0.14 : 0.09, 0.06]} />
          <meshStandardMaterial color={brakeColor} emissive={brakeColor} emissiveIntensity={brakeGlow} />
        </mesh>

        {/* ── Coupe Features (Spoiler) ── */}
        {isCoupe && (
          <group>
            {/* Spoiler uprights */}
            {[-BW * 0.6, BW * 0.6].map((x, idx) => (
              <mesh key={idx} position={[x, BY + 0.36, BL - 0.12]} castShadow>
                <boxGeometry args={[0.06, 0.38, 0.06]} />
                <meshStandardMaterial color="#111111" roughness={0.8} />
              </mesh>
            ))}
            {/* Spoiler wing */}
            <mesh position={[0, BY + 0.55, BL - 0.12]} castShadow>
              <boxGeometry args={[BW * 1.84, 0.04, 0.35]} />
              <meshStandardMaterial color="#111111" roughness={0.5} />
            </mesh>
          </group>
        )}

        {/* ── SUV Features (Roof Rack and Bull Bar) ── */}
        {isSuv && (
          <group>
            {/* Roof rails */}
            {[-BW * 0.8, BW * 0.8].map((x, idx) => (
              <mesh key={idx} position={[x, cabY + 0.44, isCoupe ? 0.2 : 0.3]} castShadow>
                <boxGeometry args={[0.04, 0.04, BL * 1.15]} />
                <meshStandardMaterial color="#181818" />
              </mesh>
            ))}
            {/* Roof cargo carrier */}
            <mesh position={[0, cabY + 0.56, 0.25]} castShadow>
              <boxGeometry args={[BW * 1.25, 0.22, BL * 0.72]} />
              <meshStandardMaterial color="#0f0f0f" roughness={0.9} />
            </mesh>
            {/* Front black bullbar */}
            <mesh position={[0, BY * 0.5, -BL - 0.12]} castShadow>
              <boxGeometry args={[BW * 1.5, BY * 0.9, 0.06]} />
              <meshStandardMaterial color="#111111" roughness={0.9} />
            </mesh>
          </group>
        )}

        {/* ── Active Night Spotlights ── */}
        {timeOfDay === "night" && (
          <group>
            <object3D ref={targetLRef} position={[-0.8, BY - 0.3, -BL - 22]} />
            <object3D ref={targetRRef} position={[0.8, BY - 0.3, -BL - 22]} />
            
            <spotLight
              position={[-0.8, BY + (isSuv ? 0.22 : 0.1), -BL - 0.15]}
              target={targetLRef.current || undefined}
              angle={0.44}
              penumbra={0.6}
              intensity={28}
              distance={110}
              castShadow
              shadow-mapSize={[512, 512]}
            />
            <spotLight
              position={[0.8, BY + (isSuv ? 0.22 : 0.1), -BL - 0.15]}
              target={targetRRef.current || undefined}
              angle={0.44}
              penumbra={0.6}
              intensity={28}
              distance={110}
              castShadow
              shadow-mapSize={[512, 512]}
            />
          </group>
        )}

      </group>

      {/* ── Wheels (separated so they don't roll/pitch with suspension) ── */}
      {/* Front Left */}
      <group ref={frontLeftRef} position={[-wheelX, 0, frontZ]}>
        <Wheel pos={[0, 0, 0]} speedRef={speedRef} scale={wScale} />
      </group>
      {/* Front Right */}
      <group ref={frontRightRef} position={[wheelX, 0, frontZ]}>
        <Wheel pos={[0, 0, 0]} speedRef={speedRef} scale={wScale} />
      </group>
      {/* Rear Left */}
      <group position={[-wheelX, 0, rearZ]}>
        <Wheel pos={[0, 0, 0]} speedRef={speedRef} scale={wScale} />
      </group>
      {/* Rear Right */}
      <group position={[wheelX, 0, rearZ]}>
        <Wheel pos={[0, 0, 0]} speedRef={speedRef} scale={wScale} />
      </group>
    </group>
  );
}