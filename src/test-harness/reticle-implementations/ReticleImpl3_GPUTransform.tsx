import { useEffect, useRef, useState } from "react";
import type { PointedTarget } from "../../types";

const CURSOR_OFFSET = 12;
const ATTACHMENT_RADIUS = 80;
const TARGET_SELECTOR = "[data-reticle], .react-flow__edge";

type TargetRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

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

export default function ReticleImpl3_GPUTransform({
  pointedTarget,
  onTargetChange,
  targetLabel,
  onRecordQuery,
  onRecordReflow,
}: ImplProps) {
  const reticleRef = useRef<HTMLDivElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);
  const activeTargetRef = useRef<Element | null>(null);
  const cachedRectRef = useRef<TargetRect | null>(null);
  const targetKeyRef = useRef("canvas");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const reticle = reticleRef.current;
    const well = wellRef.current;
    if (!reticle || !well) return;

    // Fixed base dimensions for reticle transform scaling
    const BASE_SIZE = 100;
    reticle.style.width = `${BASE_SIZE}px`;
    reticle.style.height = `${BASE_SIZE}px`;
    reticle.style.top = "0px";
    reticle.style.left = "0px";
    reticle.style.willChange = "transform, opacity";
    well.style.willChange = "transform, opacity";
    well.style.top = "0px";
    well.style.left = "0px";

    const setVisible = (visible: boolean) => {
      const opacity = visible ? "1" : "0";
      reticle.style.opacity = opacity;
      well.style.opacity = opacity;
    };

    const applyGpuTransform = (x: number, y: number, w: number, h: number) => {
      const scaleX = w / BASE_SIZE;
      const scaleY = h / BASE_SIZE;
      reticle.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scaleX}, ${scaleY})`;
    };

    const applyWellGpuTransform = (x: number, y: number) => {
      well.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const reportTarget = (target: PointedTarget) => {
      const key = targetKey(target);
      if (key !== targetKeyRef.current) {
        targetKeyRef.current = key;
        onTargetChange(target);
      }
    };

    const computeRect = (el: Element): TargetRect => {
      onRecordReflow?.();
      const r = el.getBoundingClientRect();
      return {
        left: r.left - 2,
        top: r.top - 2,
        width: r.width + 4,
        height: r.height + 4,
      };
    };

    const onPointerMove = (e: PointerEvent) => {
      setVisible(true);
      const x = e.clientX;
      const y = e.clientY;

      onRecordQuery?.();
      const hit = (e.target as Element | null)?.closest?.(TARGET_SELECTOR);

      if (hit) {
        if (hit !== activeTargetRef.current) {
          activeTargetRef.current = hit;
          cachedRectRef.current = computeRect(hit);
        }
        const rect = cachedRectRef.current!;
        reticle.classList.add("reticle--snapped");
        reticle.classList.remove("reticle--on-well");
        applyGpuTransform(rect.left, rect.top, rect.width, rect.height);
        applyWellGpuTransform(rect.left + rect.width, rect.top + rect.height);
        reportTarget(pointedTargetFromElement(hit));
        return;
      }

      // Check distance attachment
      const currentTarget = activeTargetRef.current;
      if (currentTarget && document.contains(currentTarget) && cachedRectRef.current) {
        const rect = cachedRectRef.current;
        const dx = Math.max(rect.left - x, 0, x - (rect.left + rect.width));
        const dy = Math.max(rect.top - y, 0, y - (rect.top + rect.height));
        if (Math.hypot(dx, dy) <= ATTACHMENT_RADIUS) {
          reticle.classList.add("reticle--snapped");
          reticle.classList.remove("reticle--on-well");
          applyGpuTransform(rect.left, rect.top, rect.width, rect.height);
          applyWellGpuTransform(rect.left + rect.width, rect.top + rect.height);
          reportTarget(pointedTargetFromElement(currentTarget));
          return;
        }
      }

      // Idle cursor mode
      activeTargetRef.current = null;
      cachedRectRef.current = null;
      const width = well.offsetWidth;
      const height = well.offsetHeight;
      const left = x - CURSOR_OFFSET - width;
      const top = y - CURSOR_OFFSET - height;

      reticle.classList.add("reticle--snapped");
      reticle.classList.add("reticle--on-well");
      applyGpuTransform(left, top, width, height);
      applyWellGpuTransform(left, top);
      reportTarget({ kind: "canvas" });
    };

    const onLeave = () => {
      setVisible(false);
      activeTargetRef.current = null;
      cachedRectRef.current = null;
      reportTarget({ kind: "canvas" });
    };

    window.addEventListener("pointermove", onPointerMove);
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
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
