import { useEffect, useRef, useState } from "react";

// Game 69 - Gravity Painter
// A ball at top. Rotate the world to roll it through floating rings.
// The ball leaves a paint trail. Score from rings.

type Ring = { x: number; y: number; r: number; hit: boolean };

const W = 800;
const H = 540;

export default function Game069_GravityPainter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    bx: W / 2,
    by: 40,
    vx: 0,
    vy: 0,
    angle: 0, // world rotation
    targetAngle: 0,
    rings: [] as Ring[],
    trail: [] as { x: number; y: number; hue: number }[],
    hue: 200,
    finished: false,
  });
  const [score, setScore] = useState(0);
  const [seed, setSeed] = useState(1);

  function initRings(s: number) {
    let r = s >>> 0;
    const rand = () => {
      r = (r * 1664525 + 1013904223) >>> 0;
      return r / 0xffffffff;
    };
    const rings: Ring[] = [];
    for (let i = 0; i < 7; i++) {
      rings.push({ x: 80 + rand() * (W - 160), y: 120 + i * 55 + rand() * 30, r: 22, hit: false });
    }
    return rings;
  }

  useEffect(() => {
    stateRef.current.rings = initRings(seed);
    stateRef.current.bx = W / 2;
    stateRef.current.by = 40;
    stateRef.current.vx = 0;
    stateRef.current.vy = 0;
    stateRef.current.trail = [];
    stateRef.current.angle = 0;
    stateRef.current.targetAngle = 0;
    stateRef.current.finished = false;
    setScore(0);
  }, [seed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") stateRef.current.targetAngle -= 0.15;
      if (e.key === "ArrowRight" || e.key === "d") stateRef.current.targetAngle += 0.15;
      if (e.key === "r") setSeed((s) => s + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let raf: number;
    const ctx = canvasRef.current!.getContext("2d")!;
    const loop = () => {
      const st = stateRef.current;
      // ease angle
      st.angle += (st.targetAngle - st.angle) * 0.08;
      // gravity rotated
      const g = 0.32;
      const gx = Math.sin(st.angle) * g;
      const gy = Math.cos(st.angle) * g;
      st.vx += gx;
      st.vy += gy;
      st.vx *= 0.995;
      st.vy *= 0.995;
      st.bx += st.vx;
      st.by += st.vy;
      // bounds
      if (st.bx < 10) {
        st.bx = 10;
        st.vx *= -0.5;
      }
      if (st.bx > W - 10) {
        st.bx = W - 10;
        st.vx *= -0.5;
      }
      if (st.by < 10) {
        st.by = 10;
        st.vy *= -0.5;
      }
      if (st.by > H - 10) {
        st.by = H - 10;
        st.vy *= -0.5;
        if (!st.finished) {
          st.finished = true;
        }
      }
      // trail
      st.hue = (st.hue + 0.6) % 360;
      st.trail.push({ x: st.bx, y: st.by, hue: st.hue });
      if (st.trail.length > 1200) st.trail.shift();
      // ring check
      for (const r of st.rings) {
        if (r.hit) continue;
        const d = Math.hypot(r.x - st.bx, r.y - st.by);
        if (d < r.r) {
          r.hit = true;
          setScore((s) => s + 1);
        }
      }
      // draw
      ctx.fillStyle = "#0d1320";
      ctx.fillRect(0, 0, W, H);
      // trail
      ctx.lineWidth = 4;
      for (let i = 1; i < st.trail.length; i++) {
        const a = st.trail[i - 1];
        const b = st.trail[i];
        ctx.strokeStyle = `hsl(${b.hue}, 80%, 60%)`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // rings
      for (const r of st.rings) {
        ctx.strokeStyle = r.hit ? "#7df1c5" : "#f4c542";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      // ball
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(st.bx, st.by, 8, 0, Math.PI * 2);
      ctx.fill();
      // gravity arrow (visual cue)
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.moveTo(40, 40);
      ctx.lineTo(40 + Math.sin(st.angle) * 30, 40 + Math.cos(st.angle) * 30);
      ctx.stroke();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function saveArt() {
    const url = canvasRef.current!.toDataURL("image/png");
    const w = window.open();
    if (w) w.document.write(`<img src="${url}" />`);
  }

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>Gravity Painter</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Arrow keys (←/→) rotate the world. Roll the ball through golden rings. Your trail is the painting. R = new course.
      </div>
      <canvas ref={canvasRef} width={W} height={H} style={{ borderRadius: 8, width: "100%", maxWidth: W }} />
      <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
        <span>Score: {score} rings</span>
        <button onClick={() => setSeed((s) => s + 1)}>New Course</button>
        <button onClick={saveArt}>Open Painting</button>
      </div>
    </div>
  );
}
