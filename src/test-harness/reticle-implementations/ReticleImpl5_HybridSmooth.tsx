import { useEffect, useRef, useState } from "react";
import type { PointedTarget } from "../../types";

const LERP_FACTOR = 0.35; // Motion smoothing coefficient
const TARGET_SELECTOR = "[data-reticle], .react-flow__edge";
const BASE_SIZE = 100;

type TargetBox = {
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

export default function ReticleImpl5_HybridSmooth({
  pointedTarget,
  onTargetChange,
  targetLabel,
  onRecordQuery,
  onRecordReflow,
}: ImplProps) {
  const reticleRef = useRef<HTMLDivElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);
  const activeTargetRef = useRef<Element | null>(null);
  const currentBoxRef = useRef<TargetBox>({ left: 0, top: 0, width: 40, height: 40 });
  const targetBoxRef = useRef<TargetBox>({ left: 0, top: 0, width: 40, height: 40 });
  const mousePosRef = useRef<{ x: number; y: number; inside: boolean }>({ x: 0, y: 0, inside: false });
  const targetKeyRef = useRef("canvas");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const reticle = reticleRef.current;
    const well = wellRef.current;
    if (!reticle || !well) return;

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

    const reportTarget = (target: PointedTarget) => {
      const key = targetKey(target);
      if (key !== targetKeyRef.current) {
        targetKeyRef.current = key;
        onTargetChange(target);
      }
    };

    const computeBox = (el: Element): TargetBox => {
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
      mousePosRef.current = { x: e.clientX, y: e.clientY, inside: true };

      onRecordQuery?.();
      const hit = (e.target as Element | null)?.closest?.(TARGET_SELECTOR);

      if (hit) {
        if (hit !== activeTargetRef.current) {
          activeTargetRef.current = hit;
        }
        targetBoxRef.current = computeBox(hit);
        reportTarget(pointedTargetFromElement(hit));
        return;
      }

      // Idle cursor state
      activeTargetRef.current = null;
      const width = well.offsetWidth;
      const height = well.offsetHeight;
      const left = e.clientX - 12 - width;
      const top = e.clientY - 12 - height;
      targetBoxRef.current = { left, top, width, height };
      reportTarget({ kind: "canvas" });
    };

    const onLeave = () => {
      mousePosRef.current.inside = false;
      setVisible(false);
      reportTarget({ kind: "canvas" });
    };

    let rafId: number;
    const animateLoop = () => {
      if (mousePosRef.current.inside) {
        setVisible(true);

        const curr = currentBoxRef.current;
        const target = targetBoxRef.current;

        // Smooth Lerp step: curr = curr + (target - curr) * factor
        curr.left += (target.left - curr.left) * LERP_FACTOR;
        curr.top += (target.top - curr.top) * LERP_FACTOR;
        curr.width += (target.width - curr.width) * LERP_FACTOR;
        curr.height += (target.height - curr.height) * LERP_FACTOR;

        const scaleX = curr.width / BASE_SIZE;
        const scaleY = curr.height / BASE_SIZE;

        reticle.style.transform = `translate3d(${curr.left}px, ${curr.top}px, 0) scale(${scaleX}, ${scaleY})`;
        well.style.transform = `translate3d(${curr.left + curr.width}px, ${curr.top + curr.height}px, 0)`;

        if (activeTargetRef.current) {
          reticle.classList.add("reticle--snapped");
          reticle.classList.remove("reticle--on-well");
        } else {
          reticle.classList.add("reticle--snapped");
          reticle.classList.add("reticle--on-well");
        }
      }

      rafId = requestAnimationFrame(animateLoop);
    };

    window.addEventListener("pointermove", onPointerMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    rafId = requestAnimationFrame(animateLoop);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(rafId);
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
