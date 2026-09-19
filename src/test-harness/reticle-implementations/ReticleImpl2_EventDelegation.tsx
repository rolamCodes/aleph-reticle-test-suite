import { useEffect, useRef, useState } from "react";
import type { PointedTarget } from "../../types";

const CURSOR_OFFSET = 12;
const ATTACHMENT_RADIUS = 80;
const PADDING = 2;
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

export default function ReticleImpl2_OptimizedProximity({
  pointedTarget,
  onTargetChange,
  targetLabel,
  onRecordQuery,
  onRecordReflow,
}: ImplProps) {
  const reticleRef = useRef<HTMLDivElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);
  const attachedRef = useRef<Element | null>(null);
  const targetsCacheRef = useRef<TargetCache[]>([]);
  const pointerRef = useRef({ x: 0, y: 0, inside: false });
  const targetKeyRef = useRef("canvas");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const reticle = reticleRef.current;
    const well = wellRef.current;
    if (!reticle || !well) return;

    // Refresh spatial bounding rect cache on scroll/zoom/pan/resize
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
    };

    const setBox = (box: Box) => {
      reticle.style.left = `${box.left}px`;
      reticle.style.top = `${box.top}px`;
      reticle.style.width = `${box.width}px`;
      reticle.style.height = `${box.height}px`;
    };

    const setPosition = (left: number, top: number) => {
      well.style.left = `${left}px`;
      well.style.top = `${top}px`;
    };

    const reportTarget = (target: PointedTarget) => {
      const key = targetKey(target);
      if (key !== targetKeyRef.current) {
        targetKeyRef.current = key;
        onTargetChange(target);
      }
    };

    // Fast spatial pick hit using cached rects (0 DOM queries/reflows during pointermove!)
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

    const isStillAttachedCached = (el: Element, x: number, y: number): TargetCache | null => {
      if (!document.contains(el)) return null;
      const item = targetsCacheRef.current.find((t) => t.element === el);
      if (!item) return null;
      if (distanceToRect(x, y, item.rect) <= ATTACHMENT_RADIUS) {
        return item;
      }
      return null;
    };

    const applyIdle = (x: number, y: number) => {
      // IMPORTANT FIX: Disable CSS transitions during free cursor tracking to prevent 220ms lag!
      reticle.style.transition = "none";
      well.style.transition = "none";

      const width = well.offsetWidth;
      const height = well.offsetHeight;
      const left = x - CURSOR_OFFSET - width;
      const top = y - CURSOR_OFFSET - height;

      reticle.classList.remove("reticle--snapped");
      reticle.classList.add("reticle--on-well");
      setBox({ left, top, width, height });
      setPosition(left, top);
    };

    const applySnap = (box: Box) => {
      // Re-enable smooth CSS transition for snapping onto targets
      reticle.style.transition = "left 220ms cubic-bezier(0.22, 1.15, 0.36, 1), top 220ms cubic-bezier(0.22, 1.15, 0.36, 1), width 180ms ease, height 180ms ease";
      well.style.transition = "left 220ms cubic-bezier(0.22, 1.15, 0.36, 1), top 220ms cubic-bezier(0.22, 1.15, 0.36, 1)";

      reticle.classList.add("reticle--snapped");
      reticle.classList.remove("reticle--on-well");
      setBox(box);
      setPosition(box.left + box.width, box.top + box.height);
    };

    const update = () => {
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
        applySnap(boxFromRect(hit.rect));
        reportTarget(pointedTargetFromElement(hit.element));
        return;
      }

      // Proximity lock-on attachment check (80px radius)
      const attached = attachedRef.current;
      if (attached) {
        const attachedCache = isStillAttachedCached(attached, x, y);
        if (attachedCache) {
          applySnap(boxFromRect(attachedCache.rect));
          reportTarget(pointedTargetFromElement(attachedCache.element));
          return;
        }
      }

      attachedRef.current = null;
      applyIdle(x, y);
      reportTarget({ kind: "canvas" });
    };

    const onMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY, inside: true };
      update();
    };

    const onLeave = () => {
      pointerRef.current.inside = false;
      attachedRef.current = null;
      update();
    };

    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", refreshCache, true);
    window.addEventListener("resize", refreshCache);

    // Refresh cache periodically on canvas pan/drag or node movements
    const interval = setInterval(refreshCache, 500);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", refreshCache, true);
      window.removeEventListener("resize", refreshCache);
      clearInterval(interval);
    };
  }, [onTargetChange, onRecordQuery, onRecordReflow]);

  return (
    <div className="companion">
      <div ref={wellRef} className="companion-well">
        <div className="companion-orb companion-orb--live" />
        {menuOpen ? (
          <div className="companion-menu">
            <div className="companion-menu__row">
              <span className="companion-menu__label">{targetLabel}</span>
            </div>
          </div>
        ) : null}
      </div>
      <div
        ref={reticleRef}
        className="reticle"
        onClick={() => setMenuOpen(!menuOpen)}
      />
    </div>
  );
}
