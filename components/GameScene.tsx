"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { getGlobalPointAtZ } from "../utils/pathGenerator";
import { RoadChunk } from "./RoadChunk";
import { Car } from "./Car";
import * as THREE from "three";

// ─── Constants ────────────────────────────────────────────────
const CHUNK_LENGTH = 600;

type TimeOfDay = "dawn" | "day" | "dusk" | "night";
type CameraMode = "chase" | "hood" | "cinematic";

const TIME_CONFIG = {
  dawn:  { sky:{turbidity:6,rayleigh:3,az:90,el:4},   ambient:0.5,  sun:"#ffbb66", fog:"#f0c8a0", fogN:80,  fogF:360 },
  day:   { sky:{turbidity:5,rayleigh:1,az:180,el:45},  ambient:0.75, sun:"#fffde0", fog:"#b8d8f0", fogN:120, fogF:520 },
  dusk:  { sky:{turbidity:10,rayleigh:4,az:270,el:3},  ambient:0.35, sun:"#ff7733", fog:"#b06030", fogN:60,  fogF:280 },
  night: { sky:{turbidity:1,rayleigh:0.5,az:0,el:-5},  ambient:0.08, sun:"#223366", fog:"#080c18", fogN:30,  fogF:140 },
};

const CAM_CONFIG: Record<CameraMode,{back:number;up:number;lookFwd:number;lerp:number}> = {
  chase:     { back:9,   up:3.5, lookFwd:-18, lerp:0.10 },
  hood:      { back:-1.8,up:1.6, lookFwd:-28, lerp:0.22 },
  cinematic: { back:18,  up:7,   lookFwd:-14, lerp:0.06 },
};

// ─── Tree instancing (no per-frame re-creation) ───────────────
const TREE_CACHE: Record<number, {x:number;y:number;z:number;s:number}[]> = {};

function getTrees(chunkIdx: number) {
  if (!TREE_CACHE[chunkIdx]) {
    const rng = (n: number) => Math.abs(Math.sin(n * 127.1 + chunkIdx * 43.7) * 43758.5453) % 1;
    const out = [];
    for (let i = 0; i < 38; i++) {
      const localZ = rng(i * 3) * CHUNK_LENGTH;
      const z      = -(chunkIdx * CHUNK_LENGTH + localZ);
      const side   = rng(i * 3 + 1) > 0.5 ? 1 : -1;
      const dist   = 12 + rng(i * 3 + 2) * 70;
      const pt     = getGlobalPointAtZ(z);
      out.push({ x: pt.x + side * dist, y: pt.y, z, s: 0.7 + rng(i * 7) * 1.3 });
    }
    TREE_CACHE[chunkIdx] = out;
  }
  return TREE_CACHE[chunkIdx];
}

function Trees({ chunks }: { chunks: number[] }) {
  return (
    <>
      {chunks.map(c =>
        getTrees(c).map((t, i) => (
          <group key={`${c}-${i}`} position={[t.x, t.y, t.z]} scale={t.s}>
            <mesh position={[0, 1.0, 0]}>
              <cylinderGeometry args={[0.17, 0.24, 2.0, 5]} />
              <meshStandardMaterial color="#5a3418" roughness={0.95} />
            </mesh>
            <mesh position={[0, 3.0, 0]}>
              <coneGeometry args={[1.5, 2.6, 6]} />
              <meshStandardMaterial color="#2a6030" roughness={0.88} />
            </mesh>
            <mesh position={[0, 4.4, 0]}>
              <coneGeometry args={[1.1, 2.0, 6]} />
              <meshStandardMaterial color="#348040" roughness={0.88} />
            </mesh>
            <mesh position={[0, 5.6, 0]}>
              <coneGeometry args={[0.65, 1.5, 5]} />
              <meshStandardMaterial color="#42904e" roughness={0.88} />
            </mesh>
          </group>
        ))
      )}
    </>
  );
}

// ─── Core game logic (inside Canvas) ─────────────────────────
interface GLProps {
  speedRef:      React.RefObject<number>;
  steerRef:      React.RefObject<number>;
  timeOfDay:     TimeOfDay;
  cameraMode:    CameraMode;
  carRef:        React.RefObject<THREE.Group | null>;
  onHudUpdate:   (speed: number, dist: number) => void;
}

function GameLogic({ speedRef, steerRef, timeOfDay, cameraMode, carRef, onHudUpdate }: GLProps) {
  const chunksRef   = useRef<number[]>([0, 1, 2]);
  const [activeChunks, setActiveChunks] = useState<number[]>([0, 1, 2]);
  const currentZ    = useRef(0);
  const lateralX    = useRef(0);   // manual left/right offset
  const distRef     = useRef(0);
  const lastChunkIdx= useRef(-1);
  const hudTimer    = useRef(0);
  const { camera }  = useThree();
  const tc          = TIME_CONFIG[timeOfDay];
  const camCfg      = CAM_CONFIG[cameraMode];

  useFrame((state, delta) => {
    const spd = speedRef.current ?? 0;
    const str = steerRef.current ?? 0;

    // Clamp delta so large spikes don't teleport the car
    const dt = Math.min(delta, 0.05);

    // Advance along road
    currentZ.current  -= spd * dt;
    distRef.current   += Math.abs(spd * dt);

    // Lateral steering — offset from road center
    lateralX.current  += str * spd * 0.018 * dt;
    lateralX.current   = THREE.MathUtils.clamp(lateralX.current, -4.5, 4.5);
    // Natural drift back to center when no input
    lateralX.current  *= 0.995;

    // Road path positions
    const roadPos    = getGlobalPointAtZ(currentZ.current);
    const roadAhead  = getGlobalPointAtZ(currentZ.current + camCfg.lookFwd);

    // Apply lateral offset perpendicular to road direction
    const tangent = new THREE.Vector3(
      roadAhead.x - roadPos.x,
      0,
      roadAhead.z - roadPos.z
    ).normalize();
    const right = new THREE.Vector3(-tangent.z, 0, tangent.x);

    const carPos = new THREE.Vector3(
      roadPos.x + right.x * lateralX.current,
      roadPos.y + 0.42, // lift car so wheels sit on road (wheel radius)
      roadPos.z + right.z * lateralX.current
    );

    if (carRef.current) {
      carRef.current.position.copy(carPos);
      const lookTarget = new THREE.Vector3(
        roadAhead.x + right.x * lateralX.current,
        roadAhead.y + 0.42,
        roadAhead.z + right.z * lateralX.current
      );
      carRef.current.lookAt(lookTarget);
    }

    // ── Camera ──
    const back = new THREE.Vector3(-tangent.x, 0, -tangent.z)
      .multiplyScalar(camCfg.back);
    const camTarget = carPos.clone()
      .add(back)
      .add(new THREE.Vector3(0, camCfg.up, 0));

    if (cameraMode === "cinematic") {
      camTarget.x += Math.sin(currentZ.current * 0.0025) * 5;
    }

    camera.position.lerp(camTarget, camCfg.lerp);
    camera.lookAt(
      roadAhead.x + right.x * lateralX.current,
      roadAhead.y + 0.8,
      roadAhead.z + right.z * lateralX.current
    );

    // ── Fog live update ──
    if (state.scene.fog instanceof THREE.Fog) {
      state.scene.fog.color.setStyle(tc.fog);
      state.scene.fog.near = tc.fogN;
      state.scene.fog.far  = tc.fogF;
    }

    // ── Chunk streaming — only setState when chunk index changes ──
    const idx = Math.floor(-currentZ.current / CHUNK_LENGTH);
    if (idx !== lastChunkIdx.current) {
      lastChunkIdx.current = idx;
      const next = [idx, idx + 1, idx + 2];
      chunksRef.current = next;
      setActiveChunks(next);
    }

    // ── HUD update at ~20 fps to avoid React render hammering ──
    hudTimer.current += dt;
    if (hudTimer.current > 0.05) {
      hudTimer.current = 0;
      onHudUpdate(spd, distRef.current);
    }
  });

  return (
    <>
      <fog attach="fog" args={[tc.fog, tc.fogN, tc.fogF]} />
      <ambientLight intensity={tc.ambient} />
      <directionalLight
        position={[40, 80, 30]}
        intensity={timeOfDay === "night" ? 0.06 : 1.3}
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
        <pointLight color="#ffeecc" intensity={2.5} distance={18} position={[0, 2, -3]} />
      )}
      {activeChunks.map(i => (
        <RoadChunk key={i} startZ={-(i * CHUNK_LENGTH)} length={-CHUNK_LENGTH} timeOfDay={timeOfDay} />
      ))}
      <Trees chunks={activeChunks} />
    </>
  );
}

// ─── Root component ───────────────────────────────────────────
export default function GameScene() {
  const [timeOfDay, setTimeOfDay]   = useState<TimeOfDay>("day");
  const [cameraMode, setCameraMode] = useState<CameraMode>("chase");
  const [hudSpeed, setHudSpeed]     = useState(0);
  const [hudDist, setHudDist]       = useState(0);
  const [uiVisible, setUiVisible]   = useState(true);

  // Mutable refs for speed & steering — no re-render on change
  const speedRef = useRef<number>(55);
  const steerRef = useRef<number>(0);
  const keysHeld = useRef<Set<string>>(new Set());
  const carRef   = useRef<THREE.Group>(null);
  const tc       = TIME_CONFIG[timeOfDay];

  // ── Keyboard input ──
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

  // Continuous key handling in a rAF loop so we don't fight React state
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);
    let raf: number;
    const tick = () => {
      const k = keysHeld.current;
      if (k.has("ArrowUp")   || k.has("w") || k.has("W"))
        speedRef.current = Math.min(speedRef.current + 1.2, 150);
      if (k.has("ArrowDown") || k.has("s") || k.has("S"))
        speedRef.current = Math.max(speedRef.current - 1.8, 0);
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

  const handleHud = useCallback((s: number, d: number) => {
    setHudSpeed(Math.round(s * 2.2));
    setHudDist(d);
  }, []);

  const distKm = (hudDist / 1000).toFixed(2);

  const skyC = tc.sky;
  const sunPos: [number,number,number] = [
    Math.cos((skyC.az*Math.PI)/180) * Math.cos((skyC.el*Math.PI)/180),
    Math.sin((skyC.el*Math.PI)/180),
    Math.sin((skyC.az*Math.PI)/180) * Math.cos((skyC.el*Math.PI)/180),
  ];

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
        <Car groupRef={carRef} color="#c0392b" />
        <GameLogic
          speedRef={speedRef} steerRef={steerRef}
          timeOfDay={timeOfDay} cameraMode={cameraMode}
          carRef={carRef} onHudUpdate={handleHud}
        />
      </Canvas>

      {/* ── HUD ── */}
      {uiVisible && (
        <div style={S.hud}>
          {/* Speed */}
          <div style={S.speedBox}>
            <span style={S.speedNum}>{hudSpeed}</span>
            <span style={S.speedUnit}>km/h</span>
          </div>

          {/* Distance */}
          <div style={S.distBox}>
            <span style={S.distLabel}>DISTANCE</span>
            <span style={S.distVal}>{distKm} km</span>
          </div>

          {/* Controls */}
          <div style={S.ctrlBox}>
            <Row icon="↑↓" label="SPEED"  hint="W / S" />
            <Row icon="←→" label="STEER"  hint="A / D" />
            <Row icon="⊙"  label="CAMERA" hint="C" />
            <Row icon="☀"  label="TIME"   hint="T" />
            <Row icon="▣"  label="HUD"    hint="H" />
          </div>

          {/* Badges */}
          <div style={S.badges}>
            <Bdg label={cameraMode.toUpperCase()} />
            <Bdg label={timeOfDay.toUpperCase()} />
          </div>
        </div>
      )}

      {/* Mobile speed buttons */}
      <div style={S.touch}>
        <Btn label="+" onPress={() => { speedRef.current = Math.min(speedRef.current + 12, 150); }} />
        <Btn label="−" onPress={() => { speedRef.current = Math.max(speedRef.current - 12, 0); }} />
      </div>

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

  speedBox: {
    ...glass, position:"absolute", bottom:32, left:32,
    borderRadius:14, padding:"12px 20px 10px",
    fontFamily:mono, color:"#fff",
    display:"flex", flexDirection:"column", alignItems:"flex-start",
  },
  speedNum: { fontSize:54, fontWeight:700, lineHeight:1,
              letterSpacing:-2, fontVariantNumeric:"tabular-nums" },
  speedUnit: { fontSize:11, letterSpacing:3, opacity:0.55,
               textTransform:"uppercase", marginTop:3 },

  distBox: {
    ...glass, position:"absolute", bottom:32, left:168,
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
    color:"rgba(255,255,255,0.2)", pointerEvents:"none",
  },
};