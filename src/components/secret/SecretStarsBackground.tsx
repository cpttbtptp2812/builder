import { useEffect, useRef } from "react";

/** 全屏青银粒子 + 鼠标光晕 + 星座连线 */
export function SecretStarsBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -999, y: -999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;

    type Star = {
      x: number;
      y: number;
      r: number;
      vx: number;
      vy: number;
      hue: "cyan" | "silver" | "gold";
      tw: number;
    };

    const stars: Star[] = [];

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
      if (stars.length < 120) {
        for (let i = stars.length; i < 120; i++) {
          const roll = Math.random();
          stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: Math.random() * 2 + 0.3,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            hue: roll > 0.7 ? "gold" : roll > 0.35 ? "cyan" : "silver",
            tw: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    function color(hue: Star["hue"], a: number) {
      if (hue === "cyan") return `rgba(94, 234, 212, ${a})`;
      if (hue === "gold") return `rgba(253, 224, 71, ${a})`;
      return `rgba(210, 226, 240, ${a})`;
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      const grd = ctx.createRadialGradient(
        mouse.current.x,
        mouse.current.y,
        0,
        mouse.current.x,
        mouse.current.y,
        280,
      );
      grd.addColorStop(0, "rgba(94, 234, 212, 0.16)");
      grd.addColorStop(0.45, "rgba(192, 212, 232, 0.07)");
      grd.addColorStop(1, "transparent");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        s.tw += 0.025;
        if (s.x < 0) s.x = w;
        if (s.x > w) s.x = 0;
        if (s.y < 0) s.y = h;
        if (s.y > h) s.y = 0;

        const dx = s.x - mouse.current.x;
        const dy = s.y - mouse.current.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 140) {
          s.x += dx * 0.012;
          s.y += dy * 0.012;
        }
      }

      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const a = stars[i];
          const b = stars[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > 90) continue;
          const alpha = (1 - d / 90) * 0.12;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = color("cyan", alpha);
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }

      if (mouse.current.x > 0) {
        for (const s of stars) {
          const d = Math.hypot(s.x - mouse.current.x, s.y - mouse.current.y);
          if (d > 160) continue;
          ctx.beginPath();
          ctx.moveTo(mouse.current.x, mouse.current.y);
          ctx.lineTo(s.x, s.y);
          ctx.strokeStyle = color(s.hue, (1 - d / 160) * 0.2);
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }

      for (const s of stars) {
        const alpha = 0.3 + Math.sin(s.tw) * 0.4;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = color(s.hue, alpha);
        ctx.fill();
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

  return <canvas ref={canvasRef} className="secret-canvas" aria-hidden="true" />;
}
