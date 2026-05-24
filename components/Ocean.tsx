"use client";

import { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// ── GLSL Vertex Shader ────────────────────────────────
const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveHeight;
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Layered sine waves for organic ocean movement
    float wave1 = sin(pos.x * 0.08 + uTime * 0.7) * cos(pos.y * 0.06 + uTime * 0.5) * uWaveHeight;
    float wave2 = sin(pos.x * 0.15 + uTime * 1.1 + 1.5) * cos(pos.y * 0.12 + uTime * 0.8) * uWaveHeight * 0.5;
    float wave3 = sin(pos.x * 0.03 + pos.y * 0.04 + uTime * 0.3) * uWaveHeight * 1.5;
    float wave4 = cos(pos.x * 0.22 + uTime * 1.6) * sin(pos.y * 0.18 + uTime * 1.2) * uWaveHeight * 0.25;

    float elevation = wave1 + wave2 + wave3 + wave4;
    pos.z += elevation;

    vElevation = elevation;
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// ── GLSL Fragment Shader ──────────────────────────────
const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFoamColor;
  uniform float uFoamThreshold;
  varying vec2 vUv;
  varying float vElevation;
  varying vec3 vWorldPos;

  void main() {
    // Depth gradient based on wave elevation
    float depthFactor = smoothstep(-1.5, 1.5, vElevation);
    vec3 waterColor = mix(uDeepColor, uShallowColor, depthFactor);

    // Foam at wave crests
    float foam = smoothstep(uFoamThreshold - 0.15, uFoamThreshold, vElevation);
    // Animated sparkle
    float sparkle = sin(vWorldPos.x * 2.0 + uTime * 3.0) * cos(vWorldPos.z * 1.5 + uTime * 2.5);
    sparkle = smoothstep(0.7, 1.0, sparkle) * 0.3;

    waterColor = mix(waterColor, uFoamColor, foam * 0.6 + sparkle);

    // Fresnel-like edge glow
    float fresnel = pow(1.0 - abs(dot(normalize(vWorldPos - cameraPosition), vec3(0.0, 0.0, 1.0))), 2.0) * 0.15;
    waterColor += fresnel;

    // Subtle distance fade for atmosphere
    float distFade = smoothstep(800.0, 50.0, length(vWorldPos.xz - cameraPosition.xz));
    float alpha = 0.88 * distFade;

    gl_FragColor = vec4(waterColor, alpha);
  }
`;

interface OceanProps {
  startZ: number;
  length: number;
  timeOfDay?: string;
}

export function Ocean({ startZ, length, timeOfDay = "day" }: OceanProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const uniforms = useMemo(() => ({
    uTime:           { value: 0 },
    uWaveHeight:     { value: 1.2 },
    uDeepColor:      { value: new THREE.Color("#052e4a") },
    uShallowColor:   { value: new THREE.Color("#1a8ab5") },
    uFoamColor:      { value: new THREE.Color("#e8f0f4") },
    uFoamThreshold:  { value: 1.0 },
  }), []);

  // Update colors based on time of day
  useMemo(() => {
    if (timeOfDay === "night") {
      uniforms.uDeepColor.value.set("#020a14");
      uniforms.uShallowColor.value.set("#0a2030");
      uniforms.uFoamColor.value.set("#2a3a4a");
      uniforms.uWaveHeight.value = 0.8;
    } else if (timeOfDay === "dusk") {
      uniforms.uDeepColor.value.set("#1a1520");
      uniforms.uShallowColor.value.set("#4a3040");
      uniforms.uFoamColor.value.set("#e0a080");
      uniforms.uWaveHeight.value = 1.0;
    } else if (timeOfDay === "dawn") {
      uniforms.uDeepColor.value.set("#0a2030");
      uniforms.uShallowColor.value.set("#306080");
      uniforms.uFoamColor.value.set("#f0d0b0");
      uniforms.uWaveHeight.value = 1.0;
    } else {
      uniforms.uDeepColor.value.set("#052e4a");
      uniforms.uShallowColor.value.set("#1a8ab5");
      uniforms.uFoamColor.value.set("#e8f0f4");
      uniforms.uWaveHeight.value = 1.2;
    }
  }, [timeOfDay, uniforms]);

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
  });

  // The ocean plane is placed to the left of the road, at sea level
  const planeWidth = 500;
  const planeDepth = Math.abs(length) * 2;

  return (
    <mesh
      ref={meshRef}
      position={[-180, -15.5, startZ + length * 0.5]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[planeWidth, planeDepth, 128, 128]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
