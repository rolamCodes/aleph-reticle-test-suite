import React, { useEffect, useState } from "react";

export type ReticleImplType =
  | "baseline"
  | "event-delegation"
  | "gpu-transform"
  | "viewport-math"
  | "hybrid-smooth"
  | "marketing-lerp-package"
  | "hybrid-original-magnetic";

interface HUDProps {
  activeImpl: ReticleImplType;
  onImplChange: (impl: ReticleImplType) => void;
  stressMode: boolean;
  onStressModeChange: (val: boolean) => void;
  showDebugHitboxes: boolean;
  onDebugHitboxesChange: (val: boolean) => void;
  queryCountPerSec: number;
  reflowCountPerSec: number;
}

export default function ReticleBenchmarkHUD({
  activeImpl,
  onImplChange,
  stressMode,
  onStressModeChange,
  showDebugHitboxes,
  onDebugHitboxesChange,
  queryCountPerSec,
  reflowCountPerSec,
}: HUDProps) {
  const [fps, setFps] = useState(60);
  const [frameTimeMs, setFrameTimeMs] = useState(16.6);

  useEffect(() => {
    let lastTime = performance.now();
    let frameCount = 0;
    let rafId: number;

    const tick = (now: number) => {
      frameCount++;
      const delta = now - lastTime;
      if (delta >= 500) {
        const currentFps = Math.round((frameCount * 1000) / delta);
        const currentFrameTime = Math.round((delta / frameCount) * 10) / 10;
        setFps(currentFps);
        setFrameTimeMs(currentFrameTime);
        frameCount = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="reticle-hud">
      <div className="hud-title">
        <span>⚡ Reticle Performance Test Suite</span>
        <span className="hud-badge">Siloed</span>
      </div>

      <div className="hud-row">
        <label className="hud-label">Implementation:</label>
        <select
          className="hud-select"
          value={activeImpl}
          onChange={(e) => onImplChange(e.target.value as ReticleImplType)}
        >
          <option value="baseline">1. Baseline (Unfixed - 220ms CSS transition lag & thrashing)</option>
          <option value="event-delegation">2. Corrected Proximity (0ms idle lag + Spatial Caching + 80px Lock-on)</option>
          <option value="gpu-transform">3. GPU Hardware Acceleration (translate3d)</option>
          <option value="viewport-math">4. React Flow Viewport Math (Context-Node Math)</option>
          <option value="hybrid-smooth">5. Hybrid Ultra-Smooth (Lerp Motion Damping)</option>
          <option value="marketing-lerp-package">6. Marketing Website Magnetic Trailing Follower (Lerp Spring + GPU)</option>
          <option value="hybrid-original-magnetic">7. Original Proximity + Package Trailing Lerp (Recommended)</option>
        </select>
      </div>

      <div className="hud-metrics">
        <div className="metric-box">
          <div className="metric-val" style={{ color: fps > 50 ? "#4ade80" : "#f87171" }}>
            {fps} FPS
          </div>
          <div className="metric-sub">{frameTimeMs} ms/frame</div>
        </div>

        <div className="metric-box">
          <div className="metric-val" style={{ color: queryCountPerSec > 100 ? "#f87171" : "#38bdf8" }}>
            {queryCountPerSec}
          </div>
          <div className="metric-sub">DOM Queries / sec</div>
        </div>

        <div className="metric-box">
          <div className="metric-val" style={{ color: reflowCountPerSec > 50 ? "#f87171" : "#a855f7" }}>
            {reflowCountPerSec}
          </div>
          <div className="metric-sub">Reflow Reads / sec</div>
        </div>
      </div>

      <div className="hud-toggles">
        <label className="hud-checkbox">
          <input
            type="checkbox"
            checked={stressMode}
            onChange={(e) => onStressModeChange(e.target.checked)}
          />
          Stress Test (50 Nodes)
        </label>
        <label className="hud-checkbox">
          <input
            type="checkbox"
            checked={showDebugHitboxes}
            onChange={(e) => onDebugHitboxesChange(e.target.checked)}
          />
          Show Reticle Targets
        </label>
      </div>
    </div>
  );
}
