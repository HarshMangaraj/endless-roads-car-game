"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";

const GameScene = dynamic(() => import("../components/GameScene"), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

function LoadingScreen() {
  const [dots, setDots] = useState(".");
  useEffect(() => {
    const id = setInterval(
      () => setDots((d) => (d.length >= 3 ? "." : d + ".")),
      400
    );
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#0a0e14",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        fontFamily: "'DM Mono', 'Courier New', monospace",
        color: "rgba(255,255,255,0.7)",
      }}
    >
      {/* Animated road lines */}
      <div
        style={{
          width: 3,
          height: 60,
          background:
            "repeating-linear-gradient(to bottom, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 16px, transparent 16px, transparent 28px)",
          animation: "scrollDown 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes scrollDown { from{background-position:0 0} to{background-position:0 28px} }`}</style>
      <div style={{ fontSize: 24, letterSpacing: 6, textTransform: "lowercase" }}>
        slow roads
      </div>
      <div style={{ fontSize: 11, letterSpacing: 3, opacity: 0.45 }}>
        generating terrain{dots}
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main style={{ width: "100vw", height: "100vh" }}>
      <GameScene />
    </main>
  );
}