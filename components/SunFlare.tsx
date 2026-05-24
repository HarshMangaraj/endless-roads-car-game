"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

function createFlareTexture(size: number, colorInner: string, colorOuter: string) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const center = size / 2;
  
  const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
  gradient.addColorStop(0, colorInner);
  gradient.addColorStop(0.2, colorOuter);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  
  const tex = new THREE.CanvasTexture(canvas);
  return tex;
}

export function SunFlare({ position, color = "#ffffff" }: { position: [number, number, number]; color?: string }) {
  const groupRef = useRef<THREE.Group>(null);
  
  const texMain = useMemo(() => createFlareTexture(256, "#ffffff", color.replace(')', ',0.8)').replace('rgb', 'rgba')), [color]);
  const texRing = useMemo(() => createFlareTexture(512, "rgba(255,255,255,0.1)", "rgba(200,200,255,0.02)"), []);
  const texGhost = useMemo(() => createFlareTexture(128, "rgba(255,255,255,0.4)", "rgba(100,150,255,0.1)"), []);

  useFrame(({ camera }) => {
    if (groupRef.current) {
      groupRef.current.lookAt(camera.position);
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Main Core Glow */}
      <sprite scale={[400, 400, 1]}>
        <spriteMaterial map={texMain} blending={THREE.AdditiveBlending} depthWrite={false} transparent />
      </sprite>
      
      {/* Halo / Ring Glow */}
      <sprite scale={[1200, 1200, 1]}>
        <spriteMaterial map={texRing} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.6} />
      </sprite>
      
      {/* Lens Ghosts (Fake screen space effect via absolute positioning relative to camera vector) */}
      {/* Because calculating real screen space requires post-processing, we just add static ghosts */}
      <sprite position={[100, -50, 50]} scale={[150, 150, 1]}>
        <spriteMaterial map={texGhost} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.5} />
      </sprite>
      <sprite position={[-50, 25, 20]} scale={[80, 80, 1]}>
        <spriteMaterial map={texGhost} blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.3} />
      </sprite>
    </group>
  );
}
