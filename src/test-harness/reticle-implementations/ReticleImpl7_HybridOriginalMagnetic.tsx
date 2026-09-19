import { useEffect, useRef, useState } from "react";
import type { PointedTarget } from "../../types";

/**
 * ReticleImpl7_HybridOriginalMagnetic
 *
 * Combines the original reticle logic (pickHit, 80px magnetic proximity attachment lock,
 * candidate area selection, spatial caching, and companion orb / menu integration)
 * with the marketing cursor follower package enhancements (precision follower dot,
 * lerp motion damping, and GPU hardware acceleration).
 */

const CURSOR_OFFSET = 12;
const ATTACHMENT_RADIUS = 80;
const PADDING = 2;
const LERP_FACTOR = 0.25; // Damped motion interpolation
const TARGET_SELECTOR = "[data-reticle], .react-flow__edge";

type TargetCache = {
  element: Element;
  rect: DOMRect;
  area: number;
};

type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function distanceToRect(x: number, y: number, r: DOMRect): number {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

function containsPoint(x: number, y: number, r: DOMRect): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function boxFromRect(r: DOMRect, padding = PADDING): Box {
  return {
    left: r.left - padding,
    top: r.top - padding,
    width: r.width + padding * 2,
    height: r.height + padding * 2,
  };
}

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

export default function ReticleImpl7_HybridOriginalMagnetic({
  pointedTarget,
  onTargetChange,
  targetLabel,
  onRecordQuery,
  onRecordReflow,
}: ImplProps) {
  const reticleRef = useRef<HTMLDivElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  const attachedRef = useRef<Element | null>(null);
  const targetsCacheRef = useRef<TargetCache[]>([]);
  const pointerRef = useRef({ x: 0, y: 0, inside: false });

  // Current physics states for Lerp motion smoothing
  const currentDotPos = useRef({ x: -100, y: -100 });
  const currentBox = useRef<Box>({ left: 0, top: 0, width: 40, height: 40 });
  const targetBox = useRef<Box>({ left: 0, top: 0, width: 40, height: 40 });

  const isSnappedRef = useRef(false);
  const targetKeyRef = useRef("canvas");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const reticle = reticleRef.current;
    const well = wellRef.current;
    const dot = dotRef.current;
    if (!reticle || !well || !dot) return;

    // Enable hardware acceleration
    reticle.style.willChange = "transform, opacity, width, height";
    well.style.willChange = "transform, opacity";
    dot.style.willChange = "transform, opacity";

    // Refresh spatial bounding rect cache for zero-reflow fast movement
    const refreshCache = () => {
      onRecordQuery?.();
      const elements = document.querySelectorAll(TARGET_SELECTOR);
      const cache: TargetCache[] = [];
      for (const element of elements) {
        onRecordReflow?.();
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          cache.push({
            element,
            rect,
            area: rect.width * rect.height,
          });
        }
      }
      targetsCacheRef.current = cache;
    };

    refreshCache();

    const setVisible = (visible: boolean) => {
      const opacity = visible ? "1" : "0";
      reticle.style.opacity = opacity;
      well.style.opacity = opacity;
      dot.style.opacity = opacity;
    };

    const reportTarget = (target: PointedTarget) => {
      const key = targetKey(target);
      if (key !== targetKeyRef.current) {
        targetKeyRef.current = key;
        onTargetChange(target);
      }
    };

    // Fast hit pick using cached rects & area comparison
    const pickHitCached = (x: number, y: number): TargetCache | null => {
      let bestItem: TargetCache | null = null;
      let bestArea = Infinity;

      for (const item of targetsCacheRef.current) {
        if (containsPoint(x, y, item.rect)) {
          if (item.area < bestArea) {
            bestItem = item;
            bestArea = item.area;
          }
        }
      }
      return bestItem;
    };

    // Original 80px Proximity Attachment Lock Check
    const isStillAttachedCached = (el: Element, x: number, y: number): TargetCache | null => {
      if (!document.contains(el)) return null;
      const item = targetsCacheRef.current.find((t) => t.element === el);
      if (!item) return null;
      if (distanceToRect(x, y, item.rect) <= ATTACHMENT_RADIUS) {
        return item;
      }
      return null;
    };

    const setIdleTarget = (x: number, y: number) => {
      const width = well.offsetWidth || 40;
      const height = well.offsetHeight || 40;
      const left = x - CURSOR_OFFSET - width;
      const top = y - CURSOR_OFFSET - height;

      isSnappedRef.current = false;
      targetBox.current = { left, top, width, height };
    };

    const setSnapTarget = (box: Box) => {
      isSnappedRef.current = true;
      targetBox.current = box;
    };

    const updateTarget = () => {
      const { x, y, inside } = pointerRef.current;
      if (!inside) {
        setVisible(false);
        reportTarget({ kind: "canvas" });
        return;
      }

      setVisible(true);

      // Direct hit check
      const hit = pickHitCached(x, y);
      if (hit) {
        attachedRef.current = hit.element;
        setSnapTarget(boxFromRect(hit.rect));
        reportTarget(pointedTargetFromElement(hit.element));
        return;
      }

      // Proximity attachment check
      const attached = attachedRef.current;
      if (attached) {
        const attachedCache = isStillAttachedCached(attached, x, y);
        if (attachedCache) {
          setSnapTarget(boxFromRect(attachedCache.rect));
          reportTarget(pointedTargetFromElement(attachedCache.element));
          return;
        }
      }

      attachedRef.current = null;
      setIdleTarget(x, y);
      reportTarget({ kind: "canvas" });
    };

    const onMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY, inside: true };
      updateTarget();
    };

    const onLeave = () => {
      pointerRef.current.inside = false;
      attachedRef.current = null;
      updateTarget();
    };

    let rafId: number;
    const animateLoop = () => {
      if (pointerRef.current.inside) {
        const { x, y } = pointerRef.current;

        // 1. Precision Inner Dot Lerp (Faster follower)
        currentDotPos.current.x += (x - currentDotPos.current.x) * 0.75;
        currentDotPos.current.y += (y - currentDotPos.current.y) * 0.75;
        dot.style.transform = `translate3d(${currentDotPos.current.x - 4}px, ${currentDotPos.current.y - 4}px, 0)`;

        // 2. Reticle Box Lerp (Smooth Spring Follower)
        const curr = currentBox.current;
        const target = targetBox.current;

        curr.left += (target.left - curr.left) * LERP_FACTOR;
        curr.top += (target.top - curr.top) * LERP_FACTOR;
        curr.width += (target.width - curr.width) * LERP_FACTOR;
        curr.height += (target.height - curr.height) * LERP_FACTOR;

        // Render reticle box & companion well position
        reticle.style.transform = `translate3d(${curr.left}px, ${curr.top}px, 0)`;
        reticle.style.width = `${curr.width}px`;
        reticle.style.height = `${curr.height}px`;

        well.style.transform = `translate3d(${curr.left + curr.width}px, ${curr.top + curr.height}px, 0)`;

        if (isSnappedRef.current) {
          reticle.classList.add("reticle--snapped");
          reticle.classList.remove("reticle--on-well");
        } else {
          reticle.classList.add("reticle--snapped");
          reticle.classList.add("reticle--on-well");
        }
      }

      rafId = requestAnimationFrame(animateLoop);
    };

    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", refreshCache, true);
    window.addEventListener("resize", refreshCache);

    const interval = setInterval(refreshCache, 500);
    rafId = requestAnimationFrame(animateLoop);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", refreshCache, true);
      window.removeEventListener("resize", refreshCache);
      clearInterval(interval);
      cancelAnimationFrame(rafId);
    };
  }, [onTargetChange, onRecordQuery, onRecordReflow]);

  return (
    <div className="companion">
      {/* Marketing Precision Dot Follower */}
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

      {/* Companion Well */}
      <div
        ref={wellRef}
        className="companion-well"
        style={{ position: "fixed", top: 0, left: 0, margin: 0 }}
      >
        <div className="companion-orb companion-orb--live" />
        {menuOpen ? (
          <div className="companion-menu">
            <div className="companion-menu__row">
              <span className="companion-menu__label">{targetLabel}</span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Main Reticle */}
      <div
        ref={reticleRef}
        className="reticle"
        style={{ position: "fixed", top: 0, left: 0, margin: 0 }}
        onClick={() => setMenuOpen(!menuOpen)}
      />
    </div>
  );
}
