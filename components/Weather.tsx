"use client";

import { useRef, useMemo, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { ThemeId } from "../utils/pathGenerator";

export type WeatherType = "clear" | "storm" | "snow" | "auto";

interface WeatherProps {
  weather: WeatherType;
  theme: ThemeId;
  carRef: React.RefObject<THREE.Group | null>;
}

export function WeatherParticles({ weather, theme, carRef }: WeatherProps) {
  const pointsRef = useRef<THREE.Points>(null);
  
  // Auto mode maps specific biomes to weather, otherwise clear
  let activeWeather = weather;
  if (weather === "auto") {
    if (theme === "snow") activeWeather = "snow";
    else activeWeather = "clear";
  }

  const isStorm = activeWeather === "storm";
  const isSnow = activeWeather === "snow";
  const isActive = isStorm || isSnow;

  const count = isStorm ? 2500 : 800;

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 120; // x
      pos[i * 3 + 1] = Math.random() * 50;      // y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 120; // z
      
      if (isStorm) {
        vel[i * 3] = (Math.random() - 0.5) * 2.0;    // swaying x
        vel[i * 3 + 1] = -25.0 - Math.random() * 10; // falling y (very fast)
        vel[i * 3 + 2] = (Math.random() - 0.5) * 2.0; // slight z
      } else {
        vel[i * 3] = (Math.random() - 0.5) * 1.5;   // sway X
        vel[i * 3 + 1] = -4.0 - Math.random() * 2.5;  // falling Y
        vel[i * 3 + 2] = (Math.random() - 0.5) * 1.5; // sway Z
      }
    }
    return [pos, vel];
  }, [count, isStorm]);

  const [lightningIntensity, setLightningIntensity] = useState(0);

  useFrame((_, dt) => {
    if (activeWeather === "storm") {
      if (Math.random() < 0.005) { // Occasional strike
        setLightningIntensity(4.0 + Math.random() * 6.0);
      } else {
        setLightningIntensity(prev => THREE.MathUtils.lerp(prev, 0, 15 * dt));
      }
    } else {
      if (lightningIntensity > 0) setLightningIntensity(0);
    }

    if (!pointsRef.current || !carRef.current || !isActive) return;
    
    const carPos = carRef.current.position;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;

    for (let i = 0; i < count; i++) {
      let x = posAttr.getX(i);
      let y = posAttr.getY(i);
      let z = posAttr.getZ(i);

      y += velocities[i * 3 + 1] * dt;
      x += velocities[i * 3] * dt;
      z += velocities[i * 3 + 2] * dt;

      // Wrap around relative to car position symmetrically
      const dx = x - carPos.x;
      const dz = z - carPos.z;

      if (y < 0) {
        y = 30 + Math.random() * 20;
      }
      if (dx > 60) x -= 120;
      if (dx < -60) x += 120;
      if (dz > 60) z -= 120;
      if (dz < -60) z += 120;

      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <>
      {isActive && (
        <points ref={pointsRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          </bufferGeometry>
          <pointsMaterial 
            color={isStorm ? "#aaccff" : "#ffffff"} 
            size={isStorm ? 0.5 : 0.3} 
            transparent 
            opacity={isStorm ? 0.3 : 0.75} 
            sizeAttenuation 
          />
        </points>
      )}
      {activeWeather === "storm" && lightningIntensity > 0.1 && (
        <directionalLight 
          position={[0, 100, 0]} 
          intensity={lightningIntensity} 
          color="#e0f0ff" 
        />
      )}
    </>
  );
}
