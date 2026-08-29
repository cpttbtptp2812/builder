import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type SecretFxHandle = {
  ripple: (x: number, y: number) => void;
  confetti: (x: number, y: number, count?: number) => void;
  hearts: (x: number, y: number) => void;
};

type Ripple = { x: number; y: number; r: number; life: number };
type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  kind: "confetti" | "heart" | "trail";
};

/** 光标拖尾 · 点击涟漪 · 礼花 */
export const SecretFxCanvas = forwardRef<SecretFxHandle>(function SecretFxCanvas(_, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -999, y: -999 });
  const ripples = useRef<Ripple[]>([]);
  const particles = useRef<Particle[]>([]);

  useImperativeHandle(ref, () => ({
    ripple(x, y) {
      ripples.current.push({ x, y, r: 0, life: 1 });
    },
    confetti(x, y, count = 48) {
      const colors = ["#5eead4", "#c0d4e8", "#fde68a", "#f9a8d4", "#a78bfa", "#fbbf24"];
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = Math.random() * 5 + 2;
        particles.current.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 2,
          life: 1,
          color: colors[i % colors.length],
          size: Math.random() * 5 + 3,
          kind: "confetti",
        });
      }
    },
    hearts(x, y) {
      for (let i = 0; i < 14; i++) {
        particles.current.push({
          x: x + (Math.random() - 0.5) * 30,
          y: y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 2,
          vy: -Math.random() * 3 - 1,
          life: 1,
          color: "#f9a8d4",
          size: Math.random() * 4 + 8,
          kind: "heart",
        });
      }
    },
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let lastTrail = 0;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      const now = performance.now();
      if (mouse.current.x > 0 && now - lastTrail > 40) {
        lastTrail = now;
        particles.current.push({
          x: mouse.current.x + (Math.random() - 0.5) * 8,
          y: mouse.current.y + (Math.random() - 0.5) * 8,
          vx: 0,
          vy: 0,
          life: 0.7,
          color: Math.random() > 0.5 ? "#5eead4" : "#c0d4e8",
          size: Math.random() * 3 + 1,
          kind: "trail",
        });
      }

      ripples.current = ripples.current.filter((r) => {
        r.r += 2.2;
        r.life -= 0.028;
        if (r.life <= 0) return false;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(94, 234, 212, ${r.life * 0.35})`;
        ctx.lineWidth = 2;
        ctx.stroke();
        return true;
      });

      particles.current = particles.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.kind === "confetti" ? 0.06 : 0.02;
        p.life -= p.kind === "trail" ? 0.04 : 0.012;
        if (p.life <= 0) return false;

        ctx.globalAlpha = p.life;
        if (p.kind === "heart") {
          ctx.fillStyle = p.color;
          ctx.font = `${p.size}px serif`;
          ctx.fillText("♥", p.x, p.y);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        return true;
      });

      if (particles.current.length > 400) {
        particles.current = particles.current.slice(-400);
      }

      raf = requestAnimationFrame(draw);
    }

    const onMove = (e: MouseEvent) => {
      mouse.current = { x: e.clientX, y: e.clientY };
    };
    const onLeave = () => {
      mouse.current = { x: -999, y: -999 };
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} className="secret-fx-canvas" aria-hidden="true" />;
});
