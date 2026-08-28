import { useEffect, useRef } from "react";

/** 3D 粒子波浪 — 来自 tianyangbuilder Builder 登录页 */
export function WaveCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    class Vec3 {
      x: number;
      y: number;
      z: number;
      constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
      }
      rotateX(a: number) {
        const z = this.z * Math.cos(a) - this.x * Math.sin(a);
        const x = this.z * Math.sin(a) + this.x * Math.cos(a);
        return new Vec3(x, this.y, z);
      }
      rotateY(a: number) {
        const y = this.y * Math.cos(a) - this.z * Math.sin(a);
        const z = this.y * Math.sin(a) + this.z * Math.cos(a);
        return new Vec3(this.x, y, z);
      }
      project(fov: number, dist: number, w: number, h: number) {
        const f = fov / (dist + this.z);
        return { x: this.x * f + w / 2, y: this.y * f + h / 2, z: this.z };
      }
    }

    const fov = 100;
    const dist = 100;
    const side = 36;
    const spacing = 220;
    const maxAmp = 1200;
    const points: Vec3[] = [];
    let rotX = 0;
    let rotY = 0;
    let counter = 0;
    let raf = 0;

    function resize() {
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }

    for (let z = 0; z < side; z++) {
      for (let x = 0; x < side; x++) {
        const start = -(side * spacing) / 2;
        points.push(new Vec3(start + x * spacing, 0, start + z * spacing));
      }
    }

    function loop() {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.fillStyle = "rgba(7, 8, 12, 0.35)";
      ctx.fillRect(0, 0, w, h);

      for (let i = 0; i < points.length; i++) {
        const x = i % side;
        const z = Math.floor(i / side);
        const xf = Math.sin((x / side) * 4 * Math.PI + counter);
        const zf = Math.cos((z / side) * 4 * Math.PI + counter);
        const amp = maxAmp - maxAmp * 0.3;
        points[i]!.y = maxAmp + xf * zf * amp;

        const p = points[i]!
          .rotateX(rotX)
          .rotateY(rotY)
          .project(fov, dist, w, h);
        const frac = points[i]!.y / maxAmp;
        const r = Math.floor(frac * 80 + 40);
        const g = Math.floor(180 + frac * 60);
        const b = Math.floor(255 - frac * 80);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(p.x, p.y, 2, 2);
      }
      counter += 0.025;
      rotX += 0.0008;
      rotY += 0.0012;
      raf = requestAnimationFrame(loop);
    }

    resize();
    loop();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="fx-wave" aria-hidden />;
}
