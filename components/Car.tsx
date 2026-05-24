"use client";

import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";

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
      const radius = 0.42 * scale;
      const rotSpeed = (speed / radius) * dt;
      ref.current.rotation.x -= rotSpeed;
    }
  });

  return (
    <group ref={ref} position={pos} scale={[scale, scale, scale]}>
      {/* Tire */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[0.3, 0.14, 16, 32]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.85} emissive="#111111" emissiveIntensity={0.15} />
      </mesh>
      
      {/* Rim Base */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.26, 0.26, 0.24, 24]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} metalness={0.9} />
      </mesh>

      {/* Spokes (Premium Alloy look) */}
      {[0, 1, 2, 3, 4].map((k) => (
        <mesh
          key={k}
          rotation={[Math.PI / 2, (k * Math.PI * 2) / 5, 0]}
          position={[Math.cos((k * Math.PI * 2) / 5) * 0.12, 0, Math.sin((k * Math.PI * 2) / 5) * 0.12]}
        >
          <boxGeometry args={[0.04, 0.3, 0.04]} />
          <meshStandardMaterial color="#e0e0e0" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}

      {/* Glowing Brake Disc */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0.05, 0, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 24]} />
        <meshStandardMaterial color="#ff4400" emissive="#ff2200" emissiveIntensity={0.2} roughness={0.4} metalness={0.8} />
      </mesh>
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

  // Smooth suspension interpolation
  const currentRoll = useRef(0);
  const currentPitch = useRef(0);

  useFrame((_, dt) => {
    const steer = steerRef?.current ?? 0;
    const targetSteerAngle = -steer * 0.42;
    
    // Smooth steering visuals
    if (frontLeftRef.current) {
      frontLeftRef.current.rotation.y = THREE.MathUtils.lerp(frontLeftRef.current.rotation.y, targetSteerAngle, 10 * dt);
    }
    if (frontRightRef.current) {
      frontRightRef.current.rotation.y = THREE.MathUtils.lerp(frontRightRef.current.rotation.y, targetSteerAngle, 10 * dt);
    }

    const speed = speedRef?.current ?? 0;
    
    // Compute roll based on lateral g-force (steering * speed)
    const targetRoll = -steer * (speed / 150) * 0.08;
    
    // Compute pitch based on acceleration/braking
    let targetPitch = 0;
    const keys = keysHeld?.current;
    if (keys) {
      if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) {
        targetPitch = -0.03; // Braking dive
      } else if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) {
        targetPitch = 0.02;  // Acceleration squat
      }
    }

    if (bodyRef.current) {
      currentRoll.current = THREE.MathUtils.lerp(currentRoll.current, targetRoll, 8 * dt);
      currentPitch.current = THREE.MathUtils.lerp(currentPitch.current, targetPitch, 8 * dt);
      
      bodyRef.current.rotation.z = currentRoll.current;
      bodyRef.current.rotation.x = currentPitch.current;
    }
  });

  const isCoupe = carType === "coupe";
  const isSuv = carType === "suv";

  // Sleek modern dimensions
  const BL = isCoupe ? 2.5 : isSuv ? 2.6 : 2.5;
  const BW = isCoupe ? 1.15 : isSuv ? 1.25 : 1.15;
  const BH = isCoupe ? 0.30 : isSuv ? 0.50 : 0.35;
  
  const BY = isSuv ? 0.7 : 0.45;
  const cabY = BY + BH * 0.5 + (isSuv ? 0.35 : isCoupe ? 0.2 : 0.25);
  
  const wScale = isSuv ? 1.25 : 1.1;
  const frontZ = -BL * 0.62;
  const rearZ = BL * 0.62;
  const wheelX = BW + 0.08;

  const isBraking = keysHeld?.current?.has("ArrowDown") || keysHeld?.current?.has("s") || keysHeld?.current?.has("S");
  const brakeGlow = isBraking ? 8.0 : (timeOfDay === "night" || timeOfDay === "dusk" ? 2.0 : 0.2);
  const brakeColor = isBraking ? "#ff0000" : "#ff1100";

  // Materials
  const paintMat = <meshStandardMaterial color={color} roughness={0.15} metalness={0.6} clearcoat={1.0} clearcoatRoughness={0.1} />;
  const glassMat = <meshPhysicalMaterial color="#050a0f" transmission={0.9} opacity={1} roughness={0.05} ior={1.5} thickness={0.1} transparent />;
  const darkTrimMat = <meshStandardMaterial color="#111111" roughness={0.8} metalness={0.2} />;
  
  return (
    <group ref={groupRef}>
      {/* ── Main Chassis Body ── */}
      <group ref={bodyRef}>
        
        {/* Lower Body (Sleek RoundedBox) */}
        <RoundedBox args={[BW * 2, BH, BL * 2]} radius={isSuv ? 0.15 : 0.12} smoothness={4} position={[0, BY, 0]} castShadow receiveShadow>
          {paintMat}
        </RoundedBox>

        {/* Side Skirts / Aero */}
        <RoundedBox args={[BW * 2.05, BH * 0.2, BL * 1.8]} radius={0.02} smoothness={2} position={[0, BY - BH * 0.4, 0]} castShadow>
          <meshStandardMaterial color="#080808" roughness={0.9} />
        </RoundedBox>

        {/* Cabin (Glasshouse) */}
        <RoundedBox 
          args={[BW * 1.7, isSuv ? 0.7 : isCoupe ? 0.45 : 0.55, BL * (isSuv ? 1.2 : isCoupe ? 0.9 : 1.0)]} 
          radius={0.15} 
          smoothness={4} 
          position={[0, cabY, isCoupe ? 0.1 : 0.05]} 
          castShadow 
          receiveShadow
        >
          {glassMat}
        </RoundedBox>

        {/* Roof line accent / pillars */}
        <RoundedBox 
          args={[BW * 1.6, 0.05, BL * (isSuv ? 1.0 : isCoupe ? 0.6 : 0.7)]} 
          radius={0.02} 
          smoothness={2} 
          position={[0, cabY + (isSuv ? 0.35 : isCoupe ? 0.22 : 0.27), isCoupe ? 0.1 : 0.05]} 
          castShadow
        >
          {paintMat}
        </RoundedBox>

        {/* Front Bumper Aero */}
        <RoundedBox args={[BW * 1.9, BH * 0.5, 0.2]} radius={0.05} smoothness={2} position={[0, BY - BH * 0.2, -BL - 0.05]} castShadow>
          {darkTrimMat}
        </RoundedBox>

        {/* Glowing Grille / DRL Matrix */}
        <mesh position={[0, BY + 0.05, -BL - 0.08]}>
          <planeGeometry args={[BW * 1.2, BH * 0.3]} />
          <meshStandardMaterial color="#000000" roughness={0.5} />
        </mesh>
        
        {/* Headlight LED Strip */}
        <mesh position={[0, BY + 0.12, -BL - 0.09]}>
          <boxGeometry args={[BW * 1.8, 0.03, 0.02]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={3.0} />
        </mesh>

        {/* Rear Diffuser */}
        <RoundedBox args={[BW * 1.9, BH * 0.5, 0.2]} radius={0.05} smoothness={2} position={[0, BY - BH * 0.2, BL + 0.05]} castShadow>
          {darkTrimMat}
        </RoundedBox>

        {/* Taillight LED Strip (Cyberpunk Style) */}
        <mesh position={[0, BY + 0.1, BL + 0.09]}>
          <boxGeometry args={[BW * 1.8, 0.04, 0.02]} />
          <meshStandardMaterial color={brakeColor} emissive={brakeColor} emissiveIntensity={brakeGlow} />
        </mesh>
        
        {/* Tailpipes (if not electric/coupe) */}
        {!isCoupe && [-0.5, 0.5].map((x, i) => (
          <mesh key={`pipe-${i}`} position={[x * BW, BY - BH * 0.35, BL + 0.1]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.1, 16]} />
            <meshStandardMaterial color="#111" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}

        {/* Spoiler for Coupe */}
        {isCoupe && (
          <group position={[0, BY + 0.25, BL - 0.1]}>
            <RoundedBox args={[0.04, 0.2, 0.1]} position={[-BW * 0.7, 0, 0]} radius={0.01} smoothness={2}>{darkTrimMat}</RoundedBox>
            <RoundedBox args={[0.04, 0.2, 0.1]} position={[BW * 0.7, 0, 0]} radius={0.01} smoothness={2}>{darkTrimMat}</RoundedBox>
            <RoundedBox args={[BW * 1.8, 0.04, 0.3]} position={[0, 0.1, 0.1]} radius={0.01} smoothness={2} castShadow>
              {paintMat}
            </RoundedBox>
          </group>
        )}

        {/* SUV Roof Rack */}
        {isSuv && (
          <group position={[0, cabY + 0.4, 0.05]}>
            <RoundedBox args={[BW * 1.4, 0.04, BL * 1.1]} position={[0, 0, 0]} radius={0.01} smoothness={2} castShadow>
              {darkTrimMat}
            </RoundedBox>
            <RoundedBox args={[BW * 1.2, 0.15, BL * 0.8]} position={[0, 0.1, 0]} radius={0.04} smoothness={2} castShadow>
              <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
            </RoundedBox>
          </group>
        )}

        {/* ── Active Night Spotlights & Ambient Glow ── */}
        {timeOfDay === "night" && (
          <group>
            <object3D ref={targetLRef} position={[-0.8, BY - 0.5, -BL - 20]} />
            <object3D ref={targetRRef} position={[0.8, BY - 0.5, -BL - 20]} />
            
            {/* Wider, softer headlights */}
            <spotLight position={[-0.6, BY + 0.12, -BL]} target={targetLRef.current || undefined} angle={0.55} penumbra={0.6} intensity={50} distance={150} castShadow shadow-mapSize={[1024, 1024]} />
            <spotLight position={[0.6, BY + 0.12, -BL]} target={targetRRef.current || undefined} angle={0.55} penumbra={0.6} intensity={50} distance={150} castShadow shadow-mapSize={[1024, 1024]} />
            
            {/* Ambient bounce / Rim light so car is visible at night */}
            <pointLight position={[0, BY + 1.2, 0]} intensity={3.0} color="#d0d8f0" distance={8} />
            <pointLight position={[0, BY - 0.3, 0]} intensity={2.0} color={color} distance={5} />
            
            {/* Underglow ambient for tire visibility */}
            <pointLight position={[0, -0.1, 0]} intensity={1.5} color="#4488cc" distance={4} />
            <pointLight position={[-wheelX, 0.1, frontZ]} intensity={0.8} color="#ffffff" distance={3} />
            <pointLight position={[wheelX, 0.1, frontZ]} intensity={0.8} color="#ffffff" distance={3} />
            <pointLight position={[-wheelX, 0.1, rearZ]} intensity={0.6} color="#ff4400" distance={3} />
            <pointLight position={[wheelX, 0.1, rearZ]} intensity={0.6} color="#ff4400" distance={3} />
          </group>
        )}

      </group>

      {/* ── Wheels ── */}
      <group ref={frontLeftRef} position={[-wheelX, 0, frontZ]}>
        <Wheel pos={[0, 0, 0]} speedRef={speedRef} scale={wScale} />
      </group>
      <group ref={frontRightRef} position={[wheelX, 0, frontZ]}>
        <Wheel pos={[0, 0, 0]} speedRef={speedRef} scale={wScale} />
      </group>
      <group position={[-wheelX, 0, rearZ]}>
        <Wheel pos={[0, 0, 0]} speedRef={speedRef} scale={wScale} />
      </group>
      <group position={[wheelX, 0, rearZ]}>
        <Wheel pos={[0, 0, 0]} speedRef={speedRef} scale={wScale} />
      </group>
    </group>
  );
}