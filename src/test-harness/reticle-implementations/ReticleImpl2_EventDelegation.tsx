import { useEffect, useRef, useState } from "react";
import type { PointedTarget } from "../../types";

const CURSOR_OFFSET = 12;
const ATTACHMENT_RADIUS = 80;
const PADDING = 2;
const TARGET_SELECTOR = "[data-reticle], .react-flow__edge";

type Box = {
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

export default function ReticleImpl2_EventDelegation({
  pointedTarget,
  onTargetChange,
  targetLabel,
  onRecordQuery,
  onRecordReflow,
}: ImplProps) {
  const reticleRef = useRef<HTMLDivElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);
  const activeTargetRef = useRef<Element | null>(null);
  const cachedBoxRef = useRef<Box | null>(null);
  const targetKeyRef = useRef("canvas");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const reticle = reticleRef.current;
    const well = wellRef.current;
    if (!reticle || !well) return;

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

    const computeBox = (el: Element): Box => {
      onRecordReflow?.();
      const r = el.getBoundingClientRect();
      return {
        left: r.left - PADDING,
        top: r.top - PADDING,
        width: r.width + PADDING * 2,
        height: r.height + PADDING * 2,
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
          cachedBoxRef.current = computeBox(hit);
        }
        const box = cachedBoxRef.current!;
        reticle.classList.add("reticle--snapped");
        reticle.classList.remove("reticle--on-well");
        setBox(box);
        setPosition(box.left + box.width, box.top + box.height);
        reportTarget(pointedTargetFromElement(hit));
        return;
      }

      // Check attachment distance to existing target
      const currentTarget = activeTargetRef.current;
      if (currentTarget && document.contains(currentTarget) && cachedBoxRef.current) {
        const box = cachedBoxRef.current;
        const dx = Math.max(box.left - x, 0, x - (box.left + box.width));
        const dy = Math.max(box.top - y, 0, y - (box.top + box.height));
        if (Math.hypot(dx, dy) <= ATTACHMENT_RADIUS) {
          reticle.classList.add("reticle--snapped");
          reticle.classList.remove("reticle--on-well");
          setBox(box);
          setPosition(box.left + box.width, box.top + box.height);
          reportTarget(pointedTargetFromElement(currentTarget));
          return;
        }
      }

      // Idle cursor mode
      activeTargetRef.current = null;
      cachedBoxRef.current = null;
      const width = well.offsetWidth;
      const height = well.offsetHeight;
      const left = x - CURSOR_OFFSET - width;
      const top = y - CURSOR_OFFSET - height;

      reticle.classList.add("reticle--snapped");
      reticle.classList.add("reticle--on-well");
      setBox({ left, top, width, height });
      setPosition(left, top);
      reportTarget({ kind: "canvas" });
    };

    const onLeave = () => {
      setVisible(false);
      activeTargetRef.current = null;
      cachedBoxRef.current = null;
      reportTarget({ kind: "canvas" });
    };

    // Recalculate target box on window resize or scroll
    const updateCache = () => {
      if (activeTargetRef.current && document.contains(activeTargetRef.current)) {
        cachedBoxRef.current = computeBox(activeTargetRef.current);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    window.addEventListener("scroll", updateCache, true);
    window.addEventListener("resize", updateCache);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", updateCache, true);
      window.removeEventListener("resize", updateCache);
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
