import { useEffect, useRef, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import type { PointedTarget } from "../../types";

const CURSOR_OFFSET = 12;

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

export default function ReticleImpl4_ViewportMath({
  pointedTarget,
  onTargetChange,
  targetLabel,
  onRecordQuery,
  onRecordReflow,
}: ImplProps) {
  const reticleRef = useRef<HTMLDivElement>(null);
  const wellRef = useRef<HTMLDivElement>(null);
  const { getViewport, getNodes } = useReactFlow();
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

    const onPointerMove = (e: PointerEvent) => {
      setVisible(true);
      const x = e.clientX;
      const y = e.clientY;

      // First check DOM element target hit via event target (0 reflows)
      onRecordQuery?.();
      const hit = (e.target as Element | null)?.closest?.("[data-reticle], .react-flow__edge");

      if (hit) {
        // Compute screen bounds via React Flow viewport Math if it's a node/context, otherwise fallback safely
        const reticleTarget = hit.closest<HTMLElement>("[data-reticle-kind]");
        const kind = reticleTarget?.dataset.reticleKind;
        const id = reticleTarget?.dataset.reticleId;

        if (kind === "context" && id) {
          const nodes = getNodes();
          const node = nodes.find((n) => n.id === id);
          if (node) {
            const viewport = getViewport();
            // Mathematical transform: screenX = flowX * zoom + viewport.x
            const screenX = node.position.x * viewport.zoom + viewport.x;
            const screenY = node.position.y * viewport.zoom + viewport.y;
            const width = (node.measured?.width ?? 280) * viewport.zoom;
            const height = (node.measured?.height ?? 200) * viewport.zoom;

            reticle.classList.add("reticle--snapped");
            reticle.classList.remove("reticle--on-well");
            const box = { left: screenX - 2, top: screenY - 2, width: width + 4, height: height + 4 };
            setBox(box);
            setPosition(box.left + box.width, box.top + box.height);
            reportTarget({ kind: "context", id });
            return;
          }
        }

        // Standard 0-reflow fallback bounding calculation for sub-elements
        onRecordReflow?.();
        const r = hit.getBoundingClientRect();
        const box = { left: r.left - 2, top: r.top - 2, width: r.width + 4, height: r.height + 4 };
        reticle.classList.add("reticle--snapped");
        reticle.classList.remove("reticle--on-well");
        setBox(box);
        setPosition(box.left + box.width, box.top + box.height);
        reportTarget(pointedTargetFromElement(hit));
        return;
      }

      // Idle cursor mode
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
      reportTarget({ kind: "canvas" });
    };

    window.addEventListener("pointermove", onPointerMove);
    document.documentElement.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [getViewport, getNodes, onTargetChange, onRecordQuery, onRecordReflow]);

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
