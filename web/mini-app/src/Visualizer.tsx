import { useEffect, useRef } from "react";
import type { ControlFrameEvent, GestureStableEvent } from "./types";

type Particle = { x: number; y: number; vx: number; vy: number; life: number };

type Props = {
  frame: ControlFrameEvent | null;
  gestureFlash: GestureStableEvent | null;
};

export function Visualizer({ frame, gestureFlash }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const trailLRef = useRef<{ x: number; y: number }[]>([]);
  const trailRRef = useRef<{ x: number; y: number }[]>([]);
  const flashRef = useRef(0);
  const frameRef = useRef(frame);
  const gestureRef = useRef(gestureFlash);
  frameRef.current = frame;
  gestureRef.current = gestureFlash;

  useEffect(() => {
    if (gestureFlash && gestureFlash.gesture !== "None") {
      flashRef.current = 1;
      const c = canvasRef.current;
      if (c) {
        const w = c.width;
        const h = c.height;
        for (let i = 0; i < 24; i++) {
          particlesRef.current.push({
            x: w / 2,
            y: h / 2,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1,
          });
        }
      }
    }
  }, [gestureFlash]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      t += 0.016;
      const w = canvas.width;
      const h = canvas.height;
      const cf = frameRef.current;
      const vol = cf?.pair.volume_master ?? 0;
      const spread = cf?.pair.spread ?? 0;

      const hue = (t * 40 + vol * 120) % 360;
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.7);
      g.addColorStop(0, `hsla(${hue}, 80%, 12%, 1)`);
      g.addColorStop(1, `hsla(${(hue + 80) % 360}, 70%, 4%, 1)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const gridAlpha = 0.08 + spread * 0.12;
      ctx.strokeStyle = `rgba(100, 255, 200, ${gridAlpha})`;
      ctx.lineWidth = 1;
      const step = 48;
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

      if (cf) {
        const lx = (1 - cf.left.x) * w * 0.85 + w * 0.075;
        const ly = cf.left.y * h * 0.85 + h * 0.075;
        const rx = (1 - cf.right.x) * w * 0.85 + w * 0.075;
        const ry = cf.right.y * h * 0.85 + h * 0.075;

        if (cf.left.presence) {
          trailLRef.current.push({ x: lx, y: ly });
          if (trailLRef.current.length > 20) trailLRef.current.shift();
        } else {
          trailLRef.current = [];
        }
        if (cf.right.presence) {
          trailRRef.current.push({ x: rx, y: ry });
          if (trailRRef.current.length > 20) trailRRef.current.shift();
        } else {
          trailRRef.current = [];
        }

        if (cf.left.presence && cf.right.presence) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 + vol * 0.5})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.lineTo(rx, ry);
          ctx.stroke();
          const mx = (lx + rx) / 2;
          const my = (ly + ry) / 2;
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.font = "12px monospace";
          ctx.fillText(`dist ${cf.pair.hands_distance.toFixed(2)}`, mx + 8, my - 8);
        }

        const drawOrb = (
          x: number,
          y: number,
          color: string,
          pitch: number,
          on: boolean,
          intensity = 1
        ) => {
          if (!on) return;
          const r = (28 + pitch * 40) * (0.7 + intensity * 0.5);
          const alpha = 0.35 + intensity * 0.55;
          const c = color.replace(/[\d.]+\)$/, `${alpha})`);
          const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
          glow.addColorStop(0, c);
          glow.addColorStop(1, "transparent");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        };

        drawOrb(
          lx,
          ly,
          "rgba(255, 140, 0, 0.85)",
          cf.left.pitch_norm,
          cf.left.presence
        );
        const rightGate = cf.right.gate_open === true;
        const rightDim =
          cf.right.presence &&
          !rightGate &&
          cf.right.gesture === "Closed_Fist";
        drawOrb(
          rx,
          ry,
          rightDim ? "rgba(40, 60, 80, 0.5)" : "rgba(0, 210, 255, 0.85)",
          cf.right.pitch_norm,
          cf.right.presence,
          rightGate ? 1.25 : rightDim ? 0.35 : 0.75
        );

        for (const p of trailLRef.current) {
          ctx.fillStyle = "rgba(255, 140, 0, 0.15)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
        for (const p of trailRRef.current) {
          ctx.fillStyle = "rgba(0, 210, 255, 0.15)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (flashRef.current > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashRef.current * 0.25})`;
        ctx.fillRect(0, 0, w, h);
        flashRef.current *= 0.92;
      }

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

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="visualizer-canvas" aria-hidden />;
}
