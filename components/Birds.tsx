"use client";

import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export function Birds({ count = 15, radius = 400 }) {
  const birdsRef = useRef<THREE.Group>(null);
  
  // Initialize bird positions and flight paths
  const birdData = useMemo(() => {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        x: (Math.random() - 0.5) * radius,
        y: 80 + Math.random() * 50,
        z: (Math.random() - 0.5) * radius,
        speed: 15 + Math.random() * 10,
        flapSpeed: 8 + Math.random() * 4,
        angle: Math.random() * Math.PI * 2,
        phase: Math.random() * Math.PI * 2,
      });
    }
    return data;
  }, [count, radius]);

  const wingsLeftRef = useRef<THREE.InstancedMesh>(null);
  const wingsRightRef = useRef<THREE.InstancedMesh>(null);
  
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state, dt) => {
    if (!wingsLeftRef.current || !wingsRightRef.current) return;
    
    birdData.forEach((b, i) => {
      // Move bird
      b.x += Math.sin(b.angle) * b.speed * dt;
      b.z += Math.cos(b.angle) * b.speed * dt;
      
      // Wrap around
      if (b.x > radius/2) b.x = -radius/2;
      if (b.x < -radius/2) b.x = radius/2;
      if (b.z > radius/2) b.z = -radius/2;
      if (b.z < -radius/2) b.z = radius/2;
      
      // Flap wings
      const flap = Math.sin(state.clock.elapsedTime * b.flapSpeed + b.phase);
      
      // Update left wing
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(0, b.angle, flap * 0.5);
      dummy.updateMatrix();
      wingsLeftRef.current!.setMatrixAt(i, dummy.matrix);
      
      // Update right wing
      dummy.rotation.set(0, b.angle, -flap * 0.5);
      dummy.updateMatrix();
      wingsRightRef.current!.setMatrixAt(i, dummy.matrix);
    });
    
    wingsLeftRef.current.instanceMatrix.needsUpdate = true;
    wingsRightRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={birdsRef}>
      {/* Left Wings */}
      <instancedMesh ref={wingsLeftRef} args={[undefined, undefined, count]} castShadow>
        <planeGeometry args={[1.2, 0.4]}>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([
            0.0,  0.2, 0,
            1.2,  0.2, 0,
            0.0, -0.2, 0,
            1.2, -0.2, 0,
          ]), 3]} />
        </planeGeometry>
        <meshBasicMaterial color="#111111" side={THREE.DoubleSide} />
      </instancedMesh>
      {/* Right Wings */}
      <instancedMesh ref={wingsRightRef} args={[undefined, undefined, count]} castShadow>
        <planeGeometry args={[1.2, 0.4]}>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([
            -1.2,  0.2, 0,
             0.0,  0.2, 0,
            -1.2, -0.2, 0,
             0.0, -0.2, 0,
          ]), 3]} />
        </planeGeometry>
        <meshBasicMaterial color="#111111" side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}
