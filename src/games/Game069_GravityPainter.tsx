import { useEffect, useRef, useState } from "react";

// Game 69 - Gravity Painter
// A ball at top. Rotate the world to roll it through floating rings.
// The ball leaves a paint trail. Score from rings.

type Ring = {
  x: number;
  y: number;
  r: number;
  hit: boolean;
  kind: "gold" | "ruby" | "azure";
  phase: number;
  drift: number;
  baseX: number;
};

const W = 800;
const H = 540;

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Particle = { x: number; y: number; vx: number; vy: number; life: number; hue: number };

export default function Game069_GravityPainter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    bx: W / 2,
    by: 40,
    vx: 0,
    vy: 0,
    angle: 0,
    targetAngle: 0,
    rings: [] as Ring[],
    trail: [] as { x: number; y: number; hue: number }[],
    hue: 200,
    finished: false,
    particles: [] as Particle[],
    t: 0,
  });
  const [score, setScore] = useState(0);
  const [points, setPoints] = useState(0);
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const [best, setBest] = useState(() => {
    if (typeof window === "undefined") return 0;
    const v = localStorage.getItem("g69_best");
    return v ? parseInt(v, 10) : 0;
  });
  const audioRef = useRef<AudioContext | null>(null);
  const rollGainRef = useRef<GainNode | null>(null);

  function ensureCtx() {
    if (!audioRef.current) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioRef.current = ctx;
        const buf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.3;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 600;
        const g = ctx.createGain();
        g.gain.value = 0;
        src.connect(filter).connect(g).connect(ctx.destination);
        src.start();
        rollGainRef.current = g;
      } catch {}
    }
    return audioRef.current;
  }

  function chime(freq: number) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "triangle";
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.55);
  }

  function initRings(s: number) {
    const r = mulberry32(s);
    const rings: Ring[] = [];
    const count = 7 + Math.floor(r() * 3);
    const kinds: Ring["kind"][] = ["gold", "ruby", "azure"];
    for (let i = 0; i < count; i++) {
      const x = 80 + r() * (W - 160);
      const kind = kinds[Math.floor(r() * kinds.length)];
      rings.push({
        baseX: x,
        x,
        y: 120 + i * 50 + r() * 25,
        r: 18 + r() * 10,
        hit: false,
        kind,
        phase: r() * Math.PI * 2,
        drift: kind === "gold" ? 0 : 20 + r() * 30,
      });
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
    stateRef.current.particles = [];
    stateRef.current.angle = 0;
    stateRef.current.targetAngle = 0;
    stateRef.current.finished = false;
    stateRef.current.t = 0;
    setScore(0);
    setPoints(0);
  }, [seed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "a") stateRef.current.targetAngle -= 0.15;
      if (e.key === "ArrowRight" || e.key === "d") stateRef.current.targetAngle += 0.15;
      if (e.key === "r") setSeed(Math.floor(Math.random() * 1e9));
      ensureCtx();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let raf: number;
    const ctx = canvasRef.current!.getContext("2d")!;
    const loop = () => {
      const st = stateRef.current;
      st.t += 1 / 60;
      st.angle += (st.targetAngle - st.angle) * 0.08;
      const g = 0.32;
      const gx = Math.sin(st.angle) * g;
      const gy = Math.cos(st.angle) * g;
      st.vx += gx;
      st.vy += gy;
      st.vx *= 0.995;
      st.vy *= 0.995;
      st.bx += st.vx;
      st.by += st.vy;
      const speed = Math.hypot(st.vx, st.vy);
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
        if (!st.finished) st.finished = true;
      }

      const vh = (Math.atan2(st.vy, st.vx) / Math.PI) * 180 + 180;
      st.hue = vh;
      if (speed > 0.2) st.trail.push({ x: st.bx, y: st.by, hue: vh });
      if (st.trail.length > 1500) st.trail.shift();

      for (const r of st.rings) r.x = r.baseX + Math.sin(st.t * 0.8 + r.phase) * r.drift;

      for (const r of st.rings) {
        if (r.hit) continue;
        const d = Math.hypot(r.x - st.bx, r.y - st.by);
        if (d < r.r) {
          r.hit = true;
          setScore((s) => s + 1);
          const value = r.kind === "ruby" ? 3 : r.kind === "azure" ? 2 : 1;
          setPoints((p) => {
            const np = p + value;
            if (np > best) {
              setBest(np);
              try {
                localStorage.setItem("g69_best", String(np));
              } catch {}
            }
            return np;
          });
          chime(r.kind === "ruby" ? 880 : r.kind === "azure" ? 660 : 520);
          for (let i = 0; i < 14; i++) {
            const a = Math.random() * Math.PI * 2;
            st.particles.push({
              x: r.x,
              y: r.y,
              vx: Math.cos(a) * (1 + Math.random() * 3),
              vy: Math.sin(a) * (1 + Math.random() * 3),
              life: 1,
              hue: r.kind === "ruby" ? 350 : r.kind === "azure" ? 210 : 45,
            });
          }
        }
      }

      for (const p of st.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.95;
        p.vy *= 0.95;
        p.life -= 0.025;
      }
      st.particles = st.particles.filter((p) => p.life > 0);

      if (rollGainRef.current && audioRef.current) {
        rollGainRef.current.gain.setTargetAtTime(Math.min(0.15, speed * 0.015), audioRef.current.currentTime, 0.05);
      }

      ctx.fillStyle = "#0d1320";
      ctx.fillRect(0, 0, W, H);

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

      for (const r of st.rings) {
        const c = r.kind === "ruby" ? "#ff5cae" : r.kind === "azure" ? "#5b8def" : "#f4c542";
        ctx.strokeStyle = r.hit ? "#7df1c5" : c;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const p of st.particles) {
        ctx.fillStyle = `hsla(${p.hue}, 90%, 60%, ${p.life})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 * p.life + 1, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(st.bx, st.by, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.moveTo(40, 40);
      ctx.lineTo(40 + Math.sin(st.angle) * 30, 40 + Math.cos(st.angle) * 30);
      ctx.stroke();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [best]);

  function saveArt() {
    const url = canvasRef.current!.toDataURL("image/png");
    const w = window.open();
    if (w) w.document.write(`<img src="${url}" />`);
  }

  const totalRings = stateRef.current.rings.length || 0;
  const medal = points >= totalRings * 2 ? "gold" : points >= totalRings ? "silver" : points >= Math.ceil(totalRings / 2) ? "bronze" : "—";

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>Gravity Painter</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Arrow keys (←/→) rotate the world. Gold ring = 1, azure = 2, ruby = 3. R = new course.
      </div>
      <canvas ref={canvasRef} width={W} height={H} style={{ borderRadius: 8, width: "100%", maxWidth: W }} />
      <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span>Rings: {score} · Points: {points} · Medal: {medal} · Best: {best}</span>
        <button style={{ marginLeft: "auto" }} onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>New Course</button>
        <button onClick={saveArt}>Open Painting</button>
      </div>
    </div>
  );
}
