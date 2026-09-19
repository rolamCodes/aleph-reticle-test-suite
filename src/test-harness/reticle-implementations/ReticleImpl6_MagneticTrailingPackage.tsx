import React, { useEffect, useRef, useState } from "react";
import type { PointedTarget } from "../../types";

/**
 * ReticleImpl6_MagneticTrailingPackage
 *
 * Implements the standard marketing website custom cursor pattern:
 * - Magnetic pull / spring lerp for cursor follower dot & circle ring.
 * - Target detection using element under cursor / pointer events.
 * - Dynamic scaling & morphing when hovering over interactive targets or text.
 * - Spring physics / lerp damping (0.15 velocity decay) as used in top agency sites (Awwwards/Locomotive style).
 * - Zero layout reflows on move (uses GPU transform translate3d & scale).
 */

const SPRING_EASING = 0.18; // Classic lerp factor for marketing cursor followers
const TARGET_SELECTOR = "[data-reticle], .react-flow__edge, button, a";

function pointedTargetFromElement(element: Element): PointedTarget {
  const reticleTarget = element.closest<HTMLElement>("[data-reticle-kind]");
  const kind = reticleTarget?.dataset.reticleKind;
  const id = reticleTarget?.dataset.reticleId;

  if (kind === "context" && id) return { kind, id };
  const contextId = reticleTarget?.dataset.reticleContextId;
  if ((kind === "component" || kind === "element") && id && contextId) {
    return { kind, id, contextId };
  }

  const edge = element.closest<HTMLElement>(".react-flow__edge");
  const edgeId = edge?.dataset.id;
  return edgeId ? { kind: "edge", id: edgeId } : { kind: "canvas" };
}

function targetKey(target: PointedTarget): string {
  return target.kind === "canvas" ? target.kind : `${target.kind}:${target.id}`;
}

interface ImplProps {
  pointedTarget: PointedTarget;
  onTargetChange: (target: PointedTarget) => void;
  targetLabel: string;
  onRecordQuery?: () => void;
  onRecordReflow?: () => void;
}

export default function ReticleImpl6_MagneticTrailingPackage({
  pointedTarget,
  onTargetChange,
  targetLabel,
  onRecordQuery,
  onRecordReflow,
}: ImplProps) {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);

  // Raw mouse coordinates
  const mousePos = useRef({ x: -100, y: -100, visible: false });

  // Trailing dot position (faster lerp)
  const dotPos = useRef({ x: -100, y: -100 });

  // Trailing ring position & dimensions (slower lerp / magnetic target lock)
  const ringPos = useRef({ x: -100, y: -100, width: 40, height: 40 });

  // Target destination box
  const targetBox = useRef({ x: -100, y: -100, width: 40, height: 40, isHovered: false });

  const activeTargetRef = useRef<Element | null>(null);
  const targetKeyRef = useRef("canvas");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    const well = wellRef.current;
    if (!dot || !ring || !well) return;

    // Hardware acceleration optimization
    dot.style.willChange = "transform, opacity";
    ring.style.willChange = "transform, opacity, width, height";
    well.style.willChange = "transform, opacity";

    const reportTarget = (target: PointedTarget) => {
      const key = targetKey(target);
      if (key !== targetKeyRef.current) {
        targetKeyRef.current = key;
        onTargetChange(target);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      mousePos.current.x = e.clientX;
      mousePos.current.y = e.clientY;
      mousePos.current.visible = true;

      onRecordQuery?.();
      const hit = (e.target as Element | null)?.closest?.(TARGET_SELECTOR);

      if (hit) {
        activeTargetRef.current = hit;
        onRecordReflow?.();
        const r = hit.getBoundingClientRect();
        targetBox.current = {
          x: r.left - 4,
          y: r.top - 4,
          width: r.width + 8,
          height: r.height + 8,
          isHovered: true,
        };
        reportTarget(pointedTargetFromElement(hit));
      } else {
        activeTargetRef.current = null;
        targetBox.current = {
          x: e.clientX - 20,
          y: e.clientY - 20,
          width: 40,
          height: 40,
          isHovered: false,
        };
        reportTarget({ kind: "canvas" });
      }
    };

    const onPointerLeave = () => {
      mousePos.current.visible = false;
      reportTarget({ kind: "canvas" });
    };

    let rafId: number;
    const animate = () => {
      const opacity = mousePos.current.visible ? "1" : "0";
      dot.style.opacity = opacity;
      ring.style.opacity = opacity;
      well.style.opacity = opacity;

      if (mousePos.current.visible) {
        // 1. Update Dot (Fast Follower - lerp factor 0.7)
        dotPos.current.x += (mousePos.current.x - dotPos.current.x) * 0.7;
        dotPos.current.y += (mousePos.current.y - dotPos.current.y) * 0.7;
        dot.style.transform = `translate3d(${dotPos.current.x - 4}px, ${dotPos.current.y - 4}px, 0)`;

        // 2. Update Ring (Magnetic Smooth Spring Trailing - lerp factor SPRING_EASING)
        ringPos.current.x += (targetBox.current.x - ringPos.current.x) * SPRING_EASING;
        ringPos.current.y += (targetBox.current.y - ringPos.current.y) * SPRING_EASING;
        ringPos.current.width += (targetBox.current.width - ringPos.current.width) * SPRING_EASING;
        ringPos.current.height += (targetBox.current.height - ringPos.current.height) * SPRING_EASING;

        // Apply ring GPU transform & size
        ring.style.transform = `translate3d(${ringPos.current.x}px, ${ringPos.current.y}px, 0)`;
        ring.style.width = `${ringPos.current.width}px`;
        ring.style.height = `${ringPos.current.height}px`;

        if (targetBox.current.isHovered) {
          ring.classList.add("reticle--snapped");
          ring.classList.remove("reticle--on-well");
        } else {
          ring.classList.add("reticle--snapped");
          ring.classList.add("reticle--on-well");
        }

        // 3. Update Companion Well UI position
        const wellX = ringPos.current.x + ringPos.current.width;
        const wellY = ringPos.current.y + ringPos.current.height;
        well.style.transform = `translate3d(${wellX}px, ${wellY}px, 0)`;
      }

      rafId = requestAnimationFrame(animate);
    };

    window.addEventListener("pointermove", onPointerMove);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    rafId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      cancelAnimationFrame(rafId);
    };
  }, [onTargetChange, onRecordQuery, onRecordReflow]);

  return (
    <div className="companion">
      {/* Precision inner cursor dot */}
      <div
        ref={dotRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: "#38bdf8",
          pointerEvents: "none",
          zIndex: 9999,
          boxShadow: "0 0 10px rgba(56, 189, 248, 0.8)",
        }}
      />

      {/* Companion well info container */}
      <div ref={wellRef} className="companion-well" style={{ position: "fixed", top: 0, left: 0, margin: 0 }}>
        <div className="companion-orb companion-orb--live" />
        {menuOpen ? (
          <div className="companion-menu">
            <div className="companion-menu__row">
              <span className="companion-menu__label">{targetLabel}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Outer magnetic trailing ring */}
      <div
        ref={ringRef}
        className="reticle"
        style={{ position: "fixed", top: 0, left: 0, margin: 0 }}
        onClick={() => setMenuOpen(!menuOpen)}
      />
    </div>
  );
}
