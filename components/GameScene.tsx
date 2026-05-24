"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, Instances, Instance } from "@react-three/drei";
import { getGlobalPointAtZ, getSurfaceHeight, getActiveBiome, config as pathConfig, getRoadX, getGlobalSurfaceHeight } from "../utils/pathGenerator";
import { RoadChunk, Theme } from "./RoadChunk";
import { Car } from "./Car";
import { Ocean } from "./Ocean";
import { Trees, getTrees } from "./Trees";
import { Rocks } from "./Rocks";
import { GrassClumps } from "./Grass";
import { WeatherParticles, WeatherType } from "./Weather";
import { Birds } from "./Birds";
import { SunFlare } from "./SunFlare";
import * as THREE from "three";
import { audioEngine } from "../utils/audioEngine";

// ─── Constants ────────────────────────────────────────────────
const CHUNK_LENGTH = 600;

type TimeOfDay = "dawn" | "day" | "dusk" | "night";
type CameraMode = "chase" | "hood" | "cinematic";
type CarType = "sedan" | "coupe" | "suv";

const TIME_CONFIG = {
  dawn:  { sky:{turbidity:6,rayleigh:3,az:90,el:4},   ambient:0.5,  sun:"#ffbb66", fog:"#f0c8a0", fogN:80,  fogF:360 },
  day:   { sky:{turbidity:5,rayleigh:1,az:180,el:45},  ambient:0.75, sun:"#fffde0", fog:"#b8d8f0", fogN:120, fogF:520 },
  dusk:  { sky:{turbidity:10,rayleigh:4,az:270,el:3},  ambient:0.35, sun:"#ff7733", fog:"#b06030", fogN:60,  fogF:280 },
  night: { sky:{turbidity:1,rayleigh:0.5,az:0,el:-5},  ambient:0.08, sun:"#223366", fog:"#080c18", fogN:30,  fogF:140 },
};

const CAM_CONFIG: Record<CameraMode,{back:number;up:number;lookFwd:number;lerp:number}> = {
  chase:     { back:6,   up:3.0, lookFwd:-18, lerp:0.28 },
  hood:      { back:-1.8,up:1.6, lookFwd:-28, lerp:0.35 },
  cinematic: { back:14,  up:5,   lookFwd:-14, lerp:0.12 },
};

function getLightingConfig(time: TimeOfDay, theme: Theme) {
  const base = TIME_CONFIG[time];
  let fog = base.fog;
  let sun = base.sun;
  let ambient = base.ambient;
  
  if (theme === "desert" || theme === "sanddunes") {
    if (time === "day") { fog = "#d4b08c"; sun = "#ffead0"; }
    else if (time === "dusk") { fog = "#8a3c1b"; sun = "#ff5000"; }
    else if (time === "dawn") { fog = "#ba8763"; sun = "#ffa055"; }
    else if (time === "night") { fog = "#150e0a"; sun = "#1f2a52"; }
  } else if (theme === "snow") {
    if (time === "day") { fog = "#e2ecf2"; sun = "#ffffff"; }
    else if (time === "dusk") { fog = "#9397ab"; sun = "#df80a0"; }
    else if (time === "dawn") { fog = "#c9c2cf"; sun = "#ffd0bb"; }
    else if (time === "night") { fog = "#0a0f17"; sun = "#223150"; }
  } else if (theme === "sea") {
    if (time === "day") { fog = "#88b5d1"; sun = "#ffffff"; }
    else if (time === "dusk") { fog = "#a07050"; sun = "#ff6040"; }
    else if (time === "dawn") { fog = "#90b0c0"; sun = "#ffb080"; }
    else if (time === "night") { fog = "#0b121c"; sun = "#203050"; }
  } else if (theme === "forest") {
    if (time === "day") { fog = "#98c8d0"; sun = "#fffde0"; }
    else if (time === "dusk") { fog = "#805030"; sun = "#ff7733"; }
    else if (time === "dawn") { fog = "#a0c0b0"; sun = "#ffbb66"; }
    else if (time === "night") { fog = "#05080c"; sun = "#1a2540"; }
  }
  
  return { ...base, fog, sun, ambient };
}



// ─── Cloud layer ──────────────────────────────────────────────
function CloudLayer({ theme, timeOfDay }: { theme: Theme; timeOfDay: string }) {
  const cloudColor = timeOfDay === "night" ? "#1a2030" : timeOfDay === "dusk" ? "#d08050" : timeOfDay === "dawn" ? "#e0a878" : "#ffffff";
  const opacity = timeOfDay === "night" ? 0.15 : 0.45;
  const clouds = useMemo(() => {
    const out = [];
    for (let i = 0; i < 20; i++) {
      const x = (Math.sin(i * 73.7) * 0.5 + 0.5 - 0.5) * 600;
      const z = (Math.sin(i * 47.3) * 0.5 + 0.5 - 0.5) * 800 - 400;
      const y = 60 + (Math.sin(i * 31.1) * 0.5 + 0.5) * 40;
      const sx = 15 + (Math.sin(i * 19.9) * 0.5 + 0.5) * 30;
      const sz = 10 + (Math.sin(i * 23.1) * 0.5 + 0.5) * 20;
      out.push({ x, y, z, sx, sz });
    }
    return out;
  }, []);

  return (
    <>
      {clouds.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]}>
          <boxGeometry args={[c.sx, 2, c.sz]} />
          <meshStandardMaterial color={cloudColor} transparent opacity={opacity} roughness={1} />
        </mesh>
      ))}
    </>
  );
}

// ─── Off-Road Wheel dust particles ────────────────────────────
function WheelParticles({
  carRef,
  speedRef,
  isOffRoad,
  theme,
}: {
  carRef: React.RefObject<THREE.Group | null>;
  speedRef: React.RefObject<number>;
  isOffRoad: boolean;
  theme: Theme;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 50;

  const [positions, velocities, ages] = useRef([
    new Float32Array(count * 3),
    new Float32Array(count * 3),
    new Float32Array(count),
  ]).current;

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      ages[i] = Math.random() * 2.0;
    }
  }, [ages]);

  useFrame((_, dt) => {
    if (!pointsRef.current || !carRef.current) return;
    const car = carRef.current;
    const speed = speedRef.current ?? 0;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;

    const leftRear = new THREE.Vector3(-1.1, -0.2, 1.4).applyMatrix4(car.matrixWorld);
    const rightRear = new THREE.Vector3(1.1, -0.2, 1.4).applyMatrix4(car.matrixWorld);
    const emitting = isOffRoad && Math.abs(speed) > 4;

    for (let i = 0; i < count; i++) {
      ages[i] += dt;
      let x = posAttr.getX(i);
      let y = posAttr.getY(i);
      let z = posAttr.getZ(i);

      x += velocities[i * 3] * dt;
      y += velocities[i * 3 + 1] * dt;
      z += velocities[i * 3 + 2] * dt;

      velocities[i * 3 + 1] -= 9.8 * dt; // gravity
      velocities[i * 3] *= 0.94;
      velocities[i * 3 + 2] *= 0.94;

      const maxAge = 0.4 + Math.random() * 0.4;
      if (ages[i] > maxAge) {
        ages[i] = 0;
        if (emitting) {
          const source = Math.random() > 0.5 ? leftRear : rightRear;
          x = source.x + (Math.random() - 0.5) * 0.3;
          y = source.y + 0.1;
          z = source.z + (Math.random() - 0.5) * 0.3;

          const carDir = new THREE.Vector3(0, 0, -1).applyQuaternion(car.quaternion).normalize();
          velocities[i * 3] = -carDir.x * speed * 0.22 + (Math.random() - 0.5) * 2.5;
          velocities[i * 3 + 1] = Math.abs(speed) * 0.08 + Math.random() * 3;
          velocities[i * 3 + 2] = -carDir.z * speed * 0.22 + (Math.random() - 0.5) * 2.5;
        } else {
          x = 0; y = -999; z = 0;
          velocities[i * 3] = 0; velocities[i * 3 + 1] = 0; velocities[i * 3 + 2] = 0;
        }
      }
      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  });

  const pColor = theme === "snow" ? "#d0e0ed" : theme === "desert" ? "#dca979" : "#5d4e3b";

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={pColor} size={0.34} transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

// ─── Core Game Logic ──────────────────────────────────────────
interface GLProps {
  speedRef:      React.RefObject<number>;
  steerRef:      React.RefObject<number>;
  keysHeld:      React.RefObject<Set<string>>;
  timeOfDay:     TimeOfDay;
  cameraMode:    CameraMode;
  theme:         Theme;
  weather:       WeatherType;
  carType:       CarType;
  carColor:      string;
  soundOn:       boolean;
  carRef:        React.RefObject<THREE.Group | null>;
  onHudUpdate:   (speed: number, dist: number) => void;
}

function GameLogic({
  speedRef,
  steerRef,
  keysHeld,
  timeOfDay,
  cameraMode,
  theme,
  weather,
  carType,
  carColor,
  soundOn,
  carRef,
  onHudUpdate,
}: GLProps) {
  const chunksRef   = useRef<number[]>([0, 1, 2]);
  const [activeChunks, setActiveChunks] = useState<number[]>([0, 1, 2]);
  const pos         = useRef(new THREE.Vector3(0, 0, 0));
  const heading     = useRef(Math.PI); // Facing -Z
  const isInit      = useRef(false);
  const distRef     = useRef(0);
  const lastChunkIdx= useRef(-1);
  const hudTimer    = useRef(0);
  const shakeTime   = useRef(0); // Camera crash vibration time accumulator
  const { camera }  = useThree();

  const tc          = getLightingConfig(timeOfDay, theme);
  const camCfg      = CAM_CONFIG[cameraMode];
  const wheelRadius = carType === "suv" ? 0.52 : 0.42;
  const [isOffRoad, setIsOffRoad] = useState(false);

  useFrame((state, delta) => {
    let spd = speedRef.current ?? 0;
    const str = steerRef.current ?? 0;
    const dt = Math.min(delta, 0.05);

    if (!isInit.current) {
      pos.current.set(getRoadX(0), getGlobalSurfaceHeight(getRoadX(0), 0) + wheelRadius, 0);
      isInit.current = true;
    }

    // ── True Kinematic Vehicle Physics ──
    const roadX = getRoadX(pos.current.z);
    const distToRoad = Math.abs(pos.current.x - roadX);
    const offroad = distToRoad > 6.1;
    if (offroad !== isOffRoad) setIsOffRoad(offroad);
    
    const maxSpeed = offroad ? 42 : 150;
    if (spd > maxSpeed) {
      spd = THREE.MathUtils.lerp(spd, maxSpeed, 0.08);
      speedRef.current = spd;
    }

    // Steering turns the vehicle's heading (Yaw)
    // Scale turning response by speed so you don't spin out standing still, but don't turn instantly at max speed.
    const speedFactor = Math.abs(spd) > 5 ? 1 : Math.abs(spd) / 5;
    const actualTurnRate = str * speedFactor * 1.5 * dt;
    heading.current -= actualTurnRate;

    // Apply velocity to global position
    pos.current.x += Math.sin(heading.current) * spd * dt;
    pos.current.z += Math.cos(heading.current) * spd * dt;

    // Calculate ground height
    const surfaceY = getGlobalSurfaceHeight(pos.current.x, pos.current.z);
    pos.current.y = surfaceY + wheelRadius;
    
    distRef.current += Math.abs(spd * dt);

    // Look target for car orientation (pitch to match ground)
    const lookAhead = new THREE.Vector3(
      pos.current.x + Math.sin(heading.current) * 4,
      pos.current.y,
      pos.current.z + Math.cos(heading.current) * 4
    );
    const aheadY = getGlobalSurfaceHeight(lookAhead.x, lookAhead.z);
    lookAhead.y = aheadY + wheelRadius;

    if (carRef.current) {
      carRef.current.position.copy(pos.current);
      carRef.current.lookAt(lookAhead);
    }

    // ── Tree Collisions ──
    let collided = false;
    for (const cIdx of activeChunks) {
      const trees = getTrees(cIdx);
      for (const t of trees) {
        const dx = pos.current.x - t.x;
        const dz = pos.current.z - t.z;
        const distSq = dx*dx + dz*dz;
        if (distSq < 4.6) { // Collision radius ~2.1m
          collided = true;
          break;
        }
      }
      if (collided) break;
    }

    if (collided && Math.abs(speedRef.current) > 10) {
      // Bounce back slightly and trigger shake
      speedRef.current = -8;
      shakeTime.current = 0.45;
    }

    // ── Camera Chase ──
    const camBackX = -Math.sin(heading.current) * camCfg.back;
    const camBackZ = -Math.cos(heading.current) * camCfg.back;
    
    const camTarget = pos.current.clone().add(new THREE.Vector3(camBackX, camCfg.up, camBackZ));

    if (cameraMode === "cinematic") {
      camTarget.x += Math.sin(pos.current.z * 0.0025) * 5;
    }

    if (distRef.current < 1) {
      camera.position.copy(camTarget);
    } else {
      const dampFactor = 1 - Math.exp(-(camCfg.lerp + Math.abs(spd) * 0.005) * 30 * dt);
      camera.position.lerp(camTarget, dampFactor);
      
      if (cameraMode !== "cinematic") {
        const maxDist = camCfg.back + 2.5;
        if (camera.position.distanceTo(pos.current) > maxDist) {
          const dir = camera.position.clone().sub(pos.current).normalize();
          camera.position.copy(pos.current).add(dir.multiplyScalar(maxDist));
        }
      }
    }

    if (shakeTime.current > 0) {
      shakeTime.current -= dt;
      const amt = shakeTime.current * 1.6;
      camera.position.x += (Math.random() - 0.5) * amt;
      camera.position.y += (Math.random() - 0.5) * amt;
    }

    // Camera lookat target
    const camLookTarget = new THREE.Vector3(
      pos.current.x + Math.sin(heading.current) * -camCfg.lookFwd,
      pos.current.y + 0.8,
      pos.current.z + Math.cos(heading.current) * -camCfg.lookFwd
    );
    camera.lookAt(camLookTarget);

    // ── Fog updates ──
    if (state.scene.fog instanceof THREE.Fog) {
      state.scene.fog.color.setStyle(tc.fog);
      state.scene.fog.near = tc.fogN;
      state.scene.fog.far  = tc.fogF;
    }

    // ── Audio Engine Pitch Modulator ──
    if (soundOn) {
      const isThrottling = keysHeld.current?.has("ArrowUp") || keysHeld.current?.has("w") || keysHeld.current?.has("W");
      audioEngine.update(Math.abs(spd), isThrottling);
    }

    // Chunk Streaming
    const idx = Math.floor(-pos.current.z / CHUNK_LENGTH);
    if (idx !== lastChunkIdx.current) {
      lastChunkIdx.current = idx;
      const next = [idx, idx + 1, idx + 2];
      chunksRef.current = next;
      setActiveChunks(next);
    }

    // HUD Update rate capped at ~20fps
    hudTimer.current += dt;
    if (hudTimer.current > 0.05) {
      hudTimer.current = 0;
      onHudUpdate(spd, distRef.current);
    }
  });

  const activeBiome = pathConfig.autoBiome ? getActiveBiome(pos.current.z) : theme;

  return (
    <>
      <fog attach="fog" args={[weather === "storm" ? "#4a5a6a" : tc.fog, tc.fogN, tc.fogF]} />
      <ambientLight intensity={weather === "storm" ? tc.ambient * 0.4 : tc.ambient} />
      
      {/* Dynamic Sky */}
      <Sky 
        sunPosition={timeOfDay === "night" ? [0, -1, 0] : [tc.sky.az === 180 ? 0 : 50, tc.sky.el, tc.sky.az === 180 ? -100 : 50]} 
        turbidity={tc.sky.turbidity} 
        rayleigh={tc.sky.rayleigh} 
        inclination={0.5} 
        azimuth={0.25} 
      />

      {/* Sun/Moon Mesh & Flare for visual immersion */}
      {timeOfDay !== "night" && (
        <group position={[tc.sky.az === 180 ? 0 : 1500, tc.sky.el * 200, tc.sky.az === 180 ? -3000 : 1500]}>
          <mesh>
            <circleGeometry args={[200, 32]} />
            <meshBasicMaterial color={tc.sun} fog={false} />
          </mesh>
          <SunFlare position={[0,0,0]} color={tc.sun} />
        </group>
      )}
      {timeOfDay === "night" && (
        <group position={[400, 800, -1500]}>
          <mesh>
            <circleGeometry args={[80, 32]} />
            <meshBasicMaterial color="#e0e0e0" fog={false} />
          </mesh>
          <SunFlare position={[0,0,0]} color="rgba(220,230,255,0.4)" />
          <pointLight color="#ffeecc" intensity={0.5} distance={3000} />
        </group>
      )}

      <directionalLight
        position={[40, 80, 30]}
        intensity={timeOfDay === "night" ? 0.04 : 1.3}
        color={tc.sun}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={600}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={160}
        shadow-camera-bottom={-160}
      />
      {timeOfDay === "night" && (
        <pointLight color="#ffeecc" intensity={2.8} distance={20} position={[0, 2.2, -3]} />
      )}
      {/* Hemisphere light for subtle ambient fill (especially night) */}
      <hemisphereLight args={[
        timeOfDay === "night" ? "#1a2540" : (weather === "storm" ? "#3a4a5a" : "#b1e1ff"), 
        timeOfDay === "night" ? "#080810" : "#333340", 
        timeOfDay === "night" ? 0.25 : (weather === "storm" ? 0.2 : 0.4)
      ]} />

      {activeChunks.map(i => (
        <RoadChunk key={i} startZ={-(i * CHUNK_LENGTH)} length={-CHUNK_LENGTH} timeOfDay={timeOfDay} theme={activeBiome} weather={weather} />
      ))}

      {/* Animated GLSL Ocean for Sea biome */}
      {activeBiome === "sea" && activeChunks.map(i => (
        <Ocean key={`ocean-${i}`} startZ={-(i * CHUNK_LENGTH)} length={-CHUNK_LENGTH} timeOfDay={timeOfDay} />
      ))}

      <Trees chunks={activeChunks} theme={activeBiome} />
      <Rocks chunks={activeChunks} theme={activeBiome} />
      <GrassClumps chunks={activeChunks} theme={activeBiome} />
      <CloudLayer theme={activeBiome} timeOfDay={timeOfDay} />
      
      {/* Ambient Wildlife */}
      <Birds count={25} radius={500} />
      
      {/* Dynamic dust particles for offroad driving */}
      <WheelParticles carRef={carRef} speedRef={speedRef} isOffRoad={isOffRoad} theme={activeBiome} />
      
      {/* Weather particles (falling snow, rain, thunder) */}
      <WeatherParticles theme={activeBiome} weather={weather} carRef={carRef} />
    </>
  );
}

// ─── Root Component ───────────────────────────────────────────
export default function GameScene() {
  const [timeOfDay, setTimeOfDay]   = useState<TimeOfDay>("day");
  const [cameraMode, setCameraMode] = useState<CameraMode>("chase");
  const [theme, setThemeState]      = useState<Theme>("hills");
  const [weather, setWeather]       = useState<WeatherType>("auto");
  const [carType, setCarType]       = useState<CarType>("sedan");
  const [carColor, setCarColor]     = useState("#c0392b");
  const [soundOn, setSoundOn]       = useState(false);

  const [hudSpeed, setHudSpeed]     = useState(0);
  const [hudDist, setHudDist]       = useState(0);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    pathConfig.theme = t;
    pathConfig.autoBiome = false;
    setAutoBiome(false);
  };
  const [autoBiome, setAutoBiome] = useState(false);
  const toggleAutoBiome = () => {
    const next = !autoBiome;
    setAutoBiome(next);
    pathConfig.autoBiome = next;
  };
  const [uiVisible, setUiVisible]   = useState(true);

  const speedRef = useRef<number>(50);
  const steerRef = useRef<number>(0);
  const keysHeld = useRef<Set<string>>(new Set());
  const carRef   = useRef<THREE.Group>(null);
  
  const tc = getLightingConfig(timeOfDay, theme);

  // ── Keyboard state listeners ──
  const onKeyDown = useCallback((e: KeyboardEvent) => {
    keysHeld.current.add(e.key);
    if (e.key === "c" || e.key === "C")
      setCameraMode(m => { const a:CameraMode[]=["chase","hood","cinematic"]; return a[(a.indexOf(m)+1)%3]; });
    if (e.key === "t" || e.key === "T")
      setTimeOfDay(t => { const a:TimeOfDay[]=["dawn","day","dusk","night"]; return a[(a.indexOf(t)+1)%4]; });
    if (e.key === "h" || e.key === "H")
      setUiVisible(v => !v);
  }, []);

  const onKeyUp = useCallback((e: KeyboardEvent) => {
    keysHeld.current.delete(e.key);
  }, []);

  // Continuous loop checking keys and applying friction
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);
    let raf: number;

    const tick = () => {
      const k = keysHeld.current;
      const acc = k.has("ArrowUp") || k.has("w") || k.has("W");
      const brk = k.has("ArrowDown") || k.has("s") || k.has("S");

      // Acceleration and braking (with reverse gear)
      if (acc) {
        speedRef.current = Math.min(speedRef.current + 1.25, 150);
      } else if (brk) {
        speedRef.current = Math.max(speedRef.current - 1.8, -25);
      } else {
        // Natural friction decay
        const curSpd = speedRef.current;
        if (curSpd > 0) {
          speedRef.current = Math.max(curSpd - 0.58, 0);
        } else if (curSpd < 0) {
          speedRef.current = Math.min(curSpd + 0.58, 0);
        }
      }

      // Steering
      if (k.has("ArrowLeft") || k.has("a") || k.has("A"))
        steerRef.current = -1;
      else if (k.has("ArrowRight") || k.has("d") || k.has("D"))
        steerRef.current = 1;
      else
        steerRef.current = 0;

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup",   onKeyUp);
      cancelAnimationFrame(raf);
    };
  }, [onKeyDown, onKeyUp]);

  // Audio Engine Lifecycle
  useEffect(() => {
    if (soundOn) {
      audioEngine.start();
      audioEngine.setMute(false);
    } else {
      audioEngine.setMute(true);
    }
  }, [soundOn]);

  useEffect(() => {
    return () => {
      audioEngine.stop();
    };
  }, []);

  const handleHud = useCallback((s: number, d: number) => {
    setHudSpeed(Math.round(Math.abs(s)));
    setHudDist(d);
  }, []);

  const distKm = (hudDist / 1000).toFixed(2);
  const skyC = tc.sky;
  const sunPos: [number,number,number] = [
    Math.cos((skyC.az*Math.PI)/180) * Math.cos((skyC.el*Math.PI)/180),
    Math.sin((skyC.el*Math.PI)/180),
    Math.sin((skyC.az*Math.PI)/180) * Math.cos((skyC.el*Math.PI)/180),
  ];

  // Calculate simulated gear and RPM for the circular dashboard HUD
  let simulatedGear = 1;
  let simulatedRPM = 1000;
  const currentSpeed = speedRef.current ?? 0;
  const absSpd = Math.abs(currentSpeed);
  
  if (absSpd > 110) {
    simulatedGear = 4;
    simulatedRPM = 3000 + ((absSpd - 110) / 40) * 4500;
  } else if (absSpd > 65) {
    simulatedGear = 3;
    simulatedRPM = 2800 + ((absSpd - 65) / 45) * 4200;
  } else if (absSpd > 28) {
    simulatedGear = 2;
    simulatedRPM = 2500 + ((absSpd - 28) / 37) * 4300;
  } else {
    simulatedGear = 1;
    simulatedRPM = 1000 + (absSpd / 28) * 5000;
  }
  simulatedRPM = Math.min(8000, Math.max(1000, simulatedRPM));
  const rpmColor = simulatedRPM > 6700 ? "#ef4444" : simulatedRPM > 5400 ? "#fbbf24" : "#10b981";

  return (
    <div style={{ width:"100vw", height:"100vh", position:"relative", background:"#000", overflow:"hidden" }}>
      <Canvas
        shadows
        camera={{ position:[0,5,10], fov:75, near:0.4, far:1100 }}
        gl={{ antialias:true, toneMapping:THREE.ACESFilmicToneMapping,
              toneMappingExposure: timeOfDay === "night" ? 0.38 : 0.98 }}
      >
        <color attach="background" args={[tc.fog]} />
        <Sky turbidity={skyC.turbidity} rayleigh={skyC.rayleigh}
             mieCoefficient={0.005} mieDirectionalG={0.8} sunPosition={sunPos} />
        
        <Car
          groupRef={carRef}
          color={carColor}
          steerRef={steerRef}
          speedRef={speedRef}
          keysHeld={keysHeld}
          carType={carType}
          timeOfDay={timeOfDay}
        />
        
        <GameLogic
          speedRef={speedRef}
          steerRef={steerRef}
          keysHeld={keysHeld}
          timeOfDay={timeOfDay}
          cameraMode={cameraMode}
          theme={theme}
          weather={weather}
          carType={carType}
          carColor={carColor}
          soundOn={soundOn}
          carRef={carRef}
          onHudUpdate={handleHud}
        />
      </Canvas>

      {/* ── HUD Dashboard ── */}
      {uiVisible && (
        <div style={S.hud}>
          
          {/* Circular Speedometer / Tachometer Gauge */}
          <div style={S.gaugeContainer}>
            <svg width="150" height="150" viewBox="0 0 150 150">
              <defs>
                <linearGradient id="speedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
              </defs>
              {/* Speed Arc Background */}
              <path
                d="M 37.5 112.5 A 53 53 0 1 1 112.5 112.5"
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="6"
                strokeLinecap="round"
              />
              {/* Speed Arc Active */}
              <path
                d="M 37.5 112.5 A 53 53 0 1 1 112.5 112.5"
                fill="none"
                stroke="url(#speedGrad)"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray="250"
                strokeDashoffset={250 - Math.min(250, (hudSpeed / 160) * 250)}
                style={{ transition: "stroke-dashoffset 0.08s ease" }}
              />
              {/* RPM Arc Background */}
              <path
                d="M 45 105 A 42 42 0 1 1 105 105"
                fill="none"
                stroke="rgba(255,255,255,0.04)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              {/* RPM Arc Active */}
              <path
                d="M 45 105 A 42 42 0 1 1 105 105"
                fill="none"
                stroke={rpmColor}
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="198"
                strokeDashoffset={198 - Math.min(198, ((simulatedRPM - 1000) / 7000) * 198)}
                style={{ transition: "stroke-dashoffset 0.1s ease" }}
              />
            </svg>
            <div style={S.gaugeReadout}>
              <span style={S.gaugeSpeed}>{hudSpeed}</span>
              <span style={S.gaugeUnit}>KM/H</span>
              <span style={S.gaugeGear}>{currentSpeed === 0 ? "N" : currentSpeed < 0 ? "R" : `GEAR ${simulatedGear}`}</span>
            </div>
          </div>

          {/* Distance */}
          <div style={S.distBox}>
            <span style={S.distLabel}>DISTANCE</span>
            <span style={S.distVal}>{distKm} km</span>
          </div>

          {/* Controls Information */}
          <div style={S.ctrlBox}>
            <Row icon="↑↓" label="THROTTLE"  hint="W / S" />
            <Row icon="←→" label="STEERING"  hint="A / D" />
            <Row icon="⊙"  label="CAMERA"    hint="C" />
            <Row icon="☀"  label="TIME"      hint="T" />
            <Row icon="▣"  label="HUD"       hint="H" />
          </div>

          {/* Configuration Badges */}
          <div style={S.badges}>
            <Bdg label={cameraMode.toUpperCase()} />
            <Bdg label={timeOfDay.toUpperCase()} />
            <Bdg label={weather.toUpperCase()} />
            <Bdg label={autoBiome ? "AUTO BIOME" : theme.toUpperCase()} />
          </div>

          {/* ── CUSTOMIZE MENU PANEL ── */}
          <div style={S.customPanel}>
            {/* Theme selector */}
            <div style={S.customGroup}>
              <span style={S.customGroupTitle}>THEME</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {(["hills", "forest", "desert", "sanddunes", "snow", "sea"] as const).map(t => (
                  <button
                    key={t}
                    style={{
                      ...S.customBtn,
                      background: theme === t ? "rgba(255,255,255,0.22)" : "transparent",
                      color: theme === t ? "#fff" : "rgba(255,255,255,0.65)",
                    }}
                    onClick={() => setTheme(t)}
                  >
                    {t.substring(0, 5).toUpperCase()}
                  </button>
                ))}
              </div>
              <button
                style={{
                  ...S.customBtn,
                  marginTop: 4,
                  width: '100%',
                  background: autoBiome ? "rgba(16,185,129,0.25)" : "transparent",
                  color: autoBiome ? "#10b981" : "rgba(255,255,255,0.5)",
                  borderColor: autoBiome ? "#10b981" : "rgba(255,255,255,0.12)",
                  fontWeight: 700,
                }}
                onClick={toggleAutoBiome}
              >
                {autoBiome ? "✦ AUTO ON" : "AUTO"}
              </button>
            </div>

            <div style={S.vDivider} />

            <div style={S.section}>
              <div style={S.sectionTitle}>WEATHER</div>
              <div style={S.grid2}>
                {(["auto", "clear", "rain", "snow", "thunder"] as WeatherType[]).map(w => (
                  <button
                    key={w}
                    style={{ ...S.customBtn, ...(weather === w ? S.btnActive : {}) }}
                    onClick={() => setWeather(w)}
                  >
                    {w.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div style={S.vDivider} />

            {/* Car selector */}
            <div style={S.customGroup}>
              <span style={S.customGroupTitle}>CAR MODEL</span>
              <div style={S.customRow}>
                {(["sedan", "coupe", "suv"] as const).map(m => (
                  <button
                    key={m}
                    style={{
                      ...S.customBtn,
                      background: carType === m ? "rgba(255,255,255,0.22)" : "transparent",
                      color: carType === m ? "#fff" : "rgba(255,255,255,0.65)",
                    }}
                    onClick={() => setCarType(m)}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div style={S.vDivider} />

            {/* Paint customizer */}
            <div style={S.customGroup}>
              <span style={S.customGroupTitle}>PAINT</span>
              <div style={S.customRow}>
                {[
                  { hex: "#c0392b", name: "Red" },
                  { hex: "#d1d5db", name: "Silver" },
                  { hex: "#1f2937", name: "Slate" },
                  { hex: "#f59e0b", name: "Gold" },
                  { hex: "#06b6d4", name: "Cyan" }
                ].map(c => (
                  <button
                    key={c.hex}
                    title={c.name}
                    style={{
                      ...S.colorDot,
                      backgroundColor: c.hex,
                      border: carColor === c.hex ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.25)",
                      transform: carColor === c.hex ? "scale(1.2)" : "scale(1)",
                    }}
                    onClick={() => setCarColor(c.hex)}
                  />
                ))}
              </div>
            </div>

            <div style={S.vDivider} />

            {/* Audio Toggle */}
            <div style={S.customGroup}>
              <button
                onClick={() => setSoundOn(s => !s)}
                style={{
                  ...S.customBtn,
                  background: soundOn ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.15)",
                  color: soundOn ? "#10b981" : "#ef4444",
                  borderColor: soundOn ? "#10b981" : "#ef4444",
                  fontWeight: 700,
                  width: 92,
                }}
              >
                {soundOn ? "🔊 AUDIO" : "🔇 MUTED"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={S.brand}>slow roads</div>
    </div>
  );
}

function Row({ icon, label, hint }: {icon:string;label:string;hint:string}) {
  return (
    <div style={S.ctrlRow}>
      <span style={S.ctrlIcon}>{icon}</span>
      <span style={S.ctrlLabel}>{label}</span>
      <kbd style={S.ctrlKbd}>{hint}</kbd>
    </div>
  );
}
function Bdg({ label }: {label:string}) {
  return <div style={S.badge}>{label}</div>;
}
function Btn({ label, onPress }: {label:string; onPress:()=>void}) {
  return (
    <button style={S.touchBtn}
      onPointerDown={onPress}
      onTouchStart={e => { e.preventDefault(); onPress(); }}
    >{label}</button>
  );
}

const mono = "'DM Mono','Courier New',monospace";
const glass = { background:"rgba(10,14,20,0.45)", backdropFilter:"blur(10px)",
                border:"1px solid rgba(255,255,255,0.13)" };

const S: Record<string, React.CSSProperties> = {
  hud: { position:"absolute", inset:0, pointerEvents:"none" },

  gaugeContainer: {
    ...glass, position: "absolute", bottom: 24, left: 24,
    width: 135, height: 135, borderRadius: "50%",
    pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center"
  },
  gaugeReadout: {
    position: "absolute", display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", top: "50%", left: "50%",
    transform: "translate(-50%, -46%)", fontFamily: mono, color: "#fff",
  },
  gaugeSpeed: { fontSize: 30, fontWeight: 800, lineHeight: 1, letterSpacing: -1 },
  gaugeUnit: { fontSize: 8, letterSpacing: 2, opacity: 0.5, marginTop: 1 },
  gaugeGear: { fontSize: 9, fontWeight: 700, letterSpacing: 1, opacity: 0.8, color: "#06b6d4", marginTop: 4 },

  distBox: {
    ...glass, position:"absolute", bottom:24, left:175,
    borderRadius:12, padding:"10px 16px",
    fontFamily:mono, color:"#fff",
    display:"flex", flexDirection:"column", gap:3,
  },
  distLabel: { fontSize:9, letterSpacing:3, opacity:0.5, textTransform:"uppercase" },
  distVal:   { fontSize:17, fontWeight:600, letterSpacing:1, fontVariantNumeric:"tabular-nums" },

  ctrlBox: {
    ...glass, position:"absolute", top:24, right:24,
    borderRadius:14, padding:"14px 18px",
    fontFamily:mono, color:"#fff",
    display:"flex", flexDirection:"column", gap:9, minWidth:172,
  },
  ctrlRow:   { display:"flex", alignItems:"center", gap:8 },
  ctrlIcon:  { width:18, fontSize:12, opacity:0.55, textAlign:"center" },
  ctrlLabel: { flex:1, fontSize:10, letterSpacing:1.5, opacity:0.65 },
  ctrlKbd: {
    background:"rgba(255,255,255,0.11)",
    border:"1px solid rgba(255,255,255,0.2)",
    borderRadius:4, padding:"1px 6px",
    fontSize:10, letterSpacing:0.5, fontFamily:mono,
  },

  badges: { position:"absolute", top:24, left:24, display:"flex", gap:8 },
  badge: {
    ...glass, borderRadius:20, padding:"5px 13px",
    fontFamily:mono, fontSize:10, letterSpacing:1.8,
    color:"rgba(255,255,255,0.8)",
  },

  touch: { position:"absolute", bottom:32, right:32,
           display:"flex", gap:10, pointerEvents:"all" },
  touchBtn: {
    ...glass, width:52, height:52, borderRadius:"50%",
    color:"rgba(255,255,255,0.85)", fontSize:22,
    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
    fontFamily:mono, pointerEvents:"all",
  } as React.CSSProperties,

  brand: {
    position:"absolute", bottom:12, left:"50%", transform:"translateX(-50%)",
    fontFamily:mono, fontSize:11, letterSpacing:5,
    color:"rgba(255,255,255,0.15)", pointerEvents:"none",
  },

  customPanel: {
    ...glass, position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)",
    borderRadius: 16, padding: "10px 20px", display: "flex", alignItems: "center", gap: 16,
    pointerEvents: "auto", zIndex: 100
  },
  customGroup: { display: "flex", flexDirection: "column", gap: 5, alignItems: "center" },
  customGroupTitle: { fontSize: 8, letterSpacing: 2, fontFamily: mono, color: "rgba(255,255,255,0.4)" },
  customRow: { display: "flex", gap: 6, alignItems: "center" },
  customBtn: {
    background: "transparent", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 6, padding: "4px 8px", fontSize: 9, letterSpacing: 0.8,
    fontFamily: mono, cursor: "pointer", color: "rgba(255,255,255,0.7)",
    transition: "all 0.15s ease", outline: "none",
  },
  colorDot: {
    width: 15, height: 15, borderRadius: "50%", cursor: "pointer",
    padding: 0, outline: "none", transition: "all 0.15s ease",
  },
  vDivider: { width: 1, height: 32, background: "rgba(255,255,255,0.12)" },
};