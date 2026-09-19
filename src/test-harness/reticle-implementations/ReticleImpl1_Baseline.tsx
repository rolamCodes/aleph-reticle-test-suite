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

function distanceToRect(x: number, y: number, r: DOMRect): number {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

function containsPoint(x: number, y: number, r: DOMRect): boolean {
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function boxFromElement(el: Element, padding = PADDING, onReflow?: () => void): Box {
  onReflow?.();
  const r = el.getBoundingClientRect();
  return {
    left: r.left - padding,
    top: r.top - padding,
    width: r.width + padding * 2,
    height: r.height + padding * 2,
  };
}

function setBox(el: HTMLElement, box: Box) {
  el.style.left = `${box.left}px`;
  el.style.top = `${box.top}px`;
  el.style.width = `${box.width}px`;
  el.style.height = `${box.height}px`;
}

function setPosition(el: HTMLElement, left: number, top: number) {
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.width = "";
  el.style.height = "";
}

function pickHit(x: number, y: number, onQuery?: () => void, onReflow?: () => void): Element | null {
  onQuery?.();
  let bestEl: Element | null = null;
  let bestArea = Infinity;

  const targets = document.querySelectorAll(TARGET_SELECTOR);
  for (const el of targets) {
    onReflow?.();
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    if (containsPoint(x, y, rect)) {
      const area = rect.width * rect.height;
      if (area < bestArea) {
        bestEl = el;
        bestArea = area;
      }
    }
  }

  return bestEl;
}

function stillAttached(target: Element, x: number, y: number, onReflow?: () => void): boolean {
  if (!document.contains(target)) return false;
  onReflow?.();
  return distanceToRect(x, y, target.getBoundingClientRect()) <= ATTACHMENT_RADIUS;
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

export default function ReticleImpl1_Baseline({
  pointedTarget,
  onTargetChange,
  targetLabel,
  onRecordQuery,
  onRecordReflow,
}: ImplProps) {
  const reticleRef = useRef<HTMLDivElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);
  const attachedRef = useRef<Element | null>(null);
  const pointerRef = useRef({ x: 0, y: 0, inside: false });
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

    const snapToWell = () => {
      reticle.classList.add("reticle--snapped");
      reticle.classList.add("reticle--on-well");
      setBox(reticle, boxFromElement(well, 0, onRecordReflow));
    };

    const applyIdle = (x: number, y: number) => {
      const width = well.offsetWidth;
      const height = well.offsetHeight;
      const left = x - CURSOR_OFFSET - width;
      const top = y - CURSOR_OFFSET - height;

      if (well.style.left !== "" && well.style.top !== "") {
        snapToWell();
      } else {
        reticle.classList.add("reticle--snapped");
        reticle.classList.add("reticle--on-well");
        setBox(reticle, { left, top, width, height });
      }
      setPosition(well, left, top);
    };

    const applySnap = (focus: Box) => {
      reticle.classList.add("reticle--snapped");
      reticle.classList.remove("reticle--on-well");
      setBox(reticle, focus);
      setPosition(well, focus.left + focus.width, focus.top + focus.height);
    };

    const reportTarget = (target: PointedTarget) => {
      const key = targetKey(target);
      if (key !== targetKeyRef.current) {
        targetKeyRef.current = key;
        onTargetChange(target);
      }
    };

    const update = () => {
      const { x, y, inside } = pointerRef.current;
      if (!inside) {
        setVisible(false);
        reportTarget({ kind: "canvas" });
        return;
      }

      setVisible(true);

      const hit = pickHit(x, y, onRecordQuery, onRecordReflow);
      if (hit) {
        attachedRef.current = hit;
        applySnap(boxFromElement(hit, PADDING, onRecordReflow));
        reportTarget(pointedTargetFromElement(hit));
        return;
      }

      const attached = attachedRef.current;
      if (attached && stillAttached(attached, x, y, onRecordReflow)) {
        applySnap(boxFromElement(attached, PADDING, onRecordReflow));
        reportTarget(pointedTargetFromElement(attached));
        return;
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

    let raf = 0;
    const loop = () => {
      if (pointerRef.current.inside) {
        update();
      }
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    update();
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
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
