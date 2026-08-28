import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
};

type TraceDot = {
  x: number;
  y: number;
  life: number;
  size: number;
};

const COLORS = ["#0d9488", "#5eead4", "#6366f1", "#38bdf8"];

function pickColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

/** Canvas 粒子 — 鼠标拖尾痕迹 + 轻微飘散 */
export function CursorParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles: Particle[] = [];
    const trace: TraceDot[] = [];
    const mouse = { x: -999, y: -999 };
    const last = { x: -999, y: -999 };
    let active = false;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const pushTrace = (x: number, y: number, n = 1) => {
      for (let i = 0; i < n; i++) {
        if (trace.length > 140) trace.shift();
        trace.push({
          x: x + (Math.random() - 0.5) * 2,
          y: y + (Math.random() - 0.5) * 2,
          life: 1,
          size: 1.4 + Math.random() * 1.6,
        });
      }
    };

    const pushParticle = (x: number, y: number) => {
      if (particles.length > 60) particles.shift();
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.2 + Math.random() * 0.6;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 0.8 + Math.random() * 1.4,
        color: pickColor(),
        life: 0.7 + Math.random() * 0.3,
      });
    };

    const onMove = (e: MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;

      if (last.x > -100) {
        const dx = x - last.x;
        const dy = y - last.y;
        const dist = Math.hypot(dx, dy);
        const steps = Math.max(1, Math.ceil(dist / 5));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = last.x + dx * t;
          const py = last.y + dy * t;
          pushTrace(px, py);
          if (i % 3 === 0) pushParticle(px, py);
        }
      } else {
        pushTrace(x, y, 2);
      }

      last.x = x;
      last.y = y;
      mouse.x = x;
      mouse.y = y;
      active = true;
    };

    const onLeave = () => {
      active = false;
      last.x = -999;
      last.y = -999;
    };

    /** 渐隐上一帧，留下轻微滑动痕迹 */
    const fadeFrame = () => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.09)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
    };

    const drawTrace = () => {
      if (trace.length < 2) return;

      for (let i = 1; i < trace.length; i++) {
        const a = trace[i - 1];
        const b = trace[i];
        const alpha = Math.min(a.life, b.life) * 0.22;
        if (alpha <= 0.01) continue;

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = `rgba(13, 148, 136, ${alpha})`;
        ctx.lineWidth = 1.6;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      for (const dot of trace) {
        if (dot.life <= 0.02) continue;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.size * dot.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(99, 102, 241, ${dot.life * 0.28})`;
        ctx.fill();
      }
    };

    let raf = 0;
    const draw = () => {
      fadeFrame();
      drawTrace();

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vx *= 0.96;
        p.vy *= 0.96;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.018;

        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life * 0.45;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (active && mouse.x > -100) {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(13, 148, 136, 0.55)";
        ctx.fill();
      }

      for (let i = trace.length - 1; i >= 0; i--) {
        trace[i].life -= 0.014;
        if (trace[i].life <= 0) trace.splice(i, 1);
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="site-cursor-particles" aria-hidden="true" />;
}
