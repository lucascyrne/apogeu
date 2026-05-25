import { useEffect, useRef, type RefObject } from "react";
import { roiScreenRect, spatialToScreen } from "@hand-gestures/mapping";
import type { ControlFrameEvent, GestureStableEvent } from "@hand-gestures/protocol";

type Particle = { x: number; y: number; vx: number; vy: number; life: number };

type Props = {
  frame: ControlFrameEvent | null;
  gestureFlash: GestureStableEvent | null;
  containerRef: RefObject<HTMLElement | null>;
};

function handScreen(
  hand: ControlFrameEvent["left"],
  roi: ReturnType<typeof roiScreenRect>
): { sx: number; sy: number } | null {
  if (!hand.presence) return null;
  const sx = hand.spatial_x ?? hand.x;
  const sy = hand.spatial_y ?? hand.y;
  return spatialToScreen(sx, sy, roi);
}

function isMobileViewport(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function Visualizer({ frame, gestureFlash, containerRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const trailLRef = useRef<{ x: number; y: number }[]>([]);
  const trailRRef = useRef<{ x: number; y: number }[]>([]);
  const flashRef = useRef(0);
  const frameRef = useRef(frame);
  const reducedMotionRef = useRef(prefersReducedMotion());
  frameRef.current = frame;

  useEffect(() => {
    reducedMotionRef.current = prefersReducedMotion();
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => {
      reducedMotionRef.current = mq.matches;
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotionRef.current) return;
    if (!gestureFlash || gestureFlash.gesture === "None") return;
    flashRef.current = 1;
    const c = canvasRef.current;
    if (!c) return;
    const count = isMobileViewport() ? 12 : 24;
    const w = c.width;
    const h = c.height;
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x: w / 2,
        y: h / 2,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        life: 1,
      });
    }
  }, [gestureFlash]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const draw = () => {
      t += 0.016;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w <= 0 || h <= 0) {
        raf = requestAnimationFrame(draw);
        return;
      }

      const cf = frameRef.current;
      const vol = cf?.pair.volume_master ?? 0;
      const spread = cf?.pair.spread ?? 0;
      const reduced = reducedMotionRef.current;

      const hue = (t * 40 + vol * 120) % 360;
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
      g.addColorStop(0, `hsla(${hue}, 80%, 12%, 1)`);
      g.addColorStop(1, `hsla(${(hue + 80) % 360}, 70%, 4%, 1)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const gridAlpha = 0.08 + spread * 0.12;
      ctx.strokeStyle = `rgba(100, 255, 200, ${gridAlpha})`;
      ctx.lineWidth = 1;
      const step = Math.max(32, Math.round(Math.min(w, h) / 12));
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const roi = roiScreenRect(w, h);
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, w, roi.y0);
      ctx.fillRect(0, roi.y0 + roi.h, w, h - roi.y0 - roi.h);
      ctx.fillRect(0, roi.y0, roi.x0, roi.h);
      ctx.fillRect(roi.x0 + roi.w, roi.y0, w - roi.x0 - roi.w, roi.h);

      ctx.strokeStyle = "rgba(100, 255, 200, 0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(roi.x0, roi.y0, roi.w, roi.h);

      if (cf) {
        const lPos = handScreen(cf.left, roi);
        const rPos = handScreen(cf.right, roi);

        if (lPos && cf.left.presence) {
          trailLRef.current.push({ x: lPos.sx, y: lPos.sy });
          if (trailLRef.current.length > 20) trailLRef.current.shift();
        } else trailLRef.current = [];

        if (rPos && cf.right.presence) {
          trailRRef.current.push({ x: rPos.sx, y: rPos.sy });
          if (trailRRef.current.length > 20) trailRRef.current.shift();
        } else trailRRef.current = [];

        if (lPos && rPos && cf.left.presence && cf.right.presence) {
          const dist = cf.pair.hands_distance ?? 0;
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 + vol * 0.55})`;
          ctx.lineWidth = 1.5 + dist * 2.5;
          ctx.beginPath();
          ctx.moveTo(lPos.sx, lPos.sy);
          ctx.lineTo(rPos.sx, rPos.sy);
          ctx.stroke();
        }

        const orbScale = Math.min(1, Math.min(w, h) / 400);
        const drawOrb = (
          x: number,
          y: number,
          color: string,
          on: boolean,
          intensity = 1
        ) => {
          if (!on) return;
          const r = 32 * orbScale * (0.75 + intensity * 0.45);
          const alpha = 0.4 + intensity * 0.5;
          const c = color.replace(/[\d.]+\)$/, `${alpha})`);
          const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2);
          glow.addColorStop(0, c);
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, r * 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        };

        if (lPos) {
          drawOrb(lPos.sx, lPos.sy, "rgba(255, 140, 0, 0.85)", cf.left.presence);
        }
        const rightGate = cf.right.gate_open === true;
        const rightDim =
          cf.right.presence && !rightGate && cf.right.gesture === "Closed_Fist";
        if (rPos) {
          drawOrb(
            rPos.sx,
            rPos.sy,
            rightDim ? "rgba(40, 60, 80, 0.5)" : "rgba(0, 210, 255, 0.85)",
            cf.right.presence,
            rightGate ? 1.2 : rightDim ? 0.35 : 0.7
          );
        }
      }

      if (!reduced && flashRef.current > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashRef.current * 0.25})`;
        ctx.fillRect(0, 0, w, h);
        flashRef.current *= 0.92;
      }

      if (!reduced) {
        particlesRef.current = particlesRef.current.filter((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.02;
          if (p.life <= 0) return false;
          ctx.fillStyle = `rgba(180, 255, 220, ${p.life})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3 * p.life, 0, Math.PI * 2);
          ctx.fill();
          return true;
        });
      } else {
        particlesRef.current = [];
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [containerRef]);

  return <canvas ref={canvasRef} className="visualizer-canvas" aria-hidden />;
}
