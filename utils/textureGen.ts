"use client";

import * as THREE from "three";

// Cache for generated textures so we don't recreate them every frame/chunk
const textureCache: Record<string, THREE.CanvasTexture> = {};

function createNoiseTexture(width: number, height: number, type: "asphalt" | "dirt" | "grass"): THREE.CanvasTexture {
  if (textureCache[type]) return textureCache[type];

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  // Simple PRNG for deterministic noise
  let seed = 1;
  const rand = () => {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  };

  for (let i = 0; i < data.length; i += 4) {
    let r = 128, g = 128, b = 255; // Default flat normal (facing up Z)

    if (type === "asphalt") {
      // High frequency granular noise for asphalt
      const noise = (rand() - 0.5) * 60;
      r = 128 + noise;
      g = 128 + noise;
      b = 255; 
    } else if (type === "dirt") {
      // Low frequency chunky noise (approximated with multiple frequencies)
      const x = (i / 4) % width;
      const y = Math.floor((i / 4) / width);
      const nx = x / 10;
      const ny = y / 10;
      const noise = (Math.sin(nx) * Math.cos(ny) + (rand() - 0.5) * 0.5) * 40;
      r = 128 + noise;
      g = 128 + noise;
    } else if (type === "grass") {
      // Directional noise for grass blades
      const noise = (rand() - 0.5) * 20;
      r = 128;
      g = 128 + noise;
    }

    data[i]     = r;     // R (X vector)
    data[i + 1] = g;     // G (Y vector)
    data[i + 2] = b;     // B (Z vector)
    data[i + 3] = 255;   // A
  }

  ctx.putImageData(imgData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4; // High quality filtering

  textureCache[type] = texture;
  return texture;
}

export function getAsphaltNormal() {
  const tex = createNoiseTexture(256, 256, "asphalt");
  tex.repeat.set(10, 100);
  return tex;
}

export function getDirtNormal() {
  const tex = createNoiseTexture(256, 256, "dirt");
  tex.repeat.set(40, 40);
  return tex;
}
