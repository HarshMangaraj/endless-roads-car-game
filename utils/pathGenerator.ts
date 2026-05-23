import * as THREE from "three";

// Smooth value noise
function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123;
  return s - Math.floor(s);
}
function smoothstep(t: number) { return t * t * (3 - 2 * t); }
function vnoise(x: number): number {
  const i = Math.floor(x), f = x - i;
  return THREE.MathUtils.lerp(hash(i), hash(i + 1), smoothstep(f)) * 2 - 1;
}
function fbm(x: number, octaves = 5): number {
  let v = 0, a = 1, f = 1, m = 0;
  for (let i = 0; i < octaves; i++) {
    v += vnoise(x * f + i * 31.7) * a;
    m += a; a *= 0.52; f *= 1.97;
  }
  return v / m;
}

// Road path — continuous global function, no chunk boundaries
export function getRoadX(z: number): number {
  return fbm(z * 0.0006, 4) * 100 + fbm(z * 0.00018, 3) * 55;
}
export function getRoadY(z: number): number {
  return fbm(z * 0.0015, 4) * 7 + fbm(z * 0.0004, 3) * 12;
}

export function getGlobalPointAtZ(z: number): THREE.Vector3 {
  return new THREE.Vector3(getRoadX(z), getRoadY(z), z);
}

export function getRoadTangent(z: number): THREE.Vector3 {
  const e = 1.5;
  const a = getGlobalPointAtZ(z - e);
  const b = getGlobalPointAtZ(z + e);
  return b.clone().sub(a).normalize();
}

// This class is kept for RoadChunk useMemo compatibility
export class ProceduralRoadCurve extends THREE.Curve<THREE.Vector3> {
  startZ: number;
  length: number;
  constructor(startZ: number, length: number) {
    super();
    this.startZ = startZ;
    this.length = length;
  }
  getPoint(t: number, out = new THREE.Vector3()): THREE.Vector3 {
    const z = this.startZ + t * this.length;
    return out.set(getRoadX(z), getRoadY(z), z);
  }
}