import { useEffect, useMemo, useRef, useState } from "react";

// Game 61 - Bus Route
// Plan a single bus route with bus capacity, traffic, and time-of-day surges.
// All data procedurally generated from a seed.

type Stop = {
  id: number;
  x: number;
  y: number;
  passengers: number;
  base: number;
  dest: number;
  surge: number;
};

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

function todaySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function generateCity(seed: number, timeOfDay: number) {
  const rand = mulberry32(seed);
  const n = 10;
  const stops: Stop[] = [];
  for (let i = 0; i < n; i++) {
    const base = 1 + Math.floor(rand() * 6);
    stops.push({
      id: i,
      x: 60 + rand() * 780,
      y: 60 + rand() * 480,
      base,
      passengers: base,
      dest: 0,
      surge: 1,
    });
  }
  for (let i = 0; i < n; i++) {
    let d = Math.floor(rand() * n);
    if (d === i) d = (d + 1) % n;
    stops[i].dest = d;
  }
  for (let i = 0; i < n; i++) {
    const peak = Math.floor(rand() * 24);
    const dh = Math.min(Math.abs(timeOfDay - peak), 24 - Math.abs(timeOfDay - peak));
    const m = dh < 3 ? 2 - dh * 0.4 : 1;
    stops[i].surge = m;
    stops[i].passengers = Math.max(0, Math.round(stops[i].base * m));
  }
  const traffic: number[][] = Array.from({ length: n }, () => Array(n).fill(1));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const r = rand();
      const m = r < 0.15 ? 1.6 + rand() * 0.8 : 1;
      traffic[i][j] = m;
      traffic[j][i] = m;
    }
  }
  return { stops, traffic };
}

function dist(a: Stop, b: Stop) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      audioCtx = new AC();
    } catch {
      return null;
    }
  }
  return audioCtx;
}
function blip(freq: number, dur = 0.08, type: OscillatorType = "sine", gain = 0.06) {
  const ctx = getCtx();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur);
}

const CAPACITY = 12;

export default function Game061_BusRoute() {
  const [seed, setSeed] = useState(todaySeed());
  const [timeOfDay, setTimeOfDay] = useState(8);
  const { stops, traffic } = useMemo(() => generateCity(seed, timeOfDay), [seed, timeOfDay]);
  const [route, setRoute] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const everSeed = useRef(seed);
  useEffect(() => {
    if (everSeed.current !== seed) {
      setRoute([]);
      setSubmitted(false);
      everSeed.current = seed;
    }
  }, [seed]);

  const totalPassengers = stops.reduce((a, s) => a + s.passengers, 0);

  function toggle(id: number) {
    if (submitted) return;
    blip(420 + id * 30, 0.06, "triangle", 0.05);
    setRoute((r) => {
      if (r.includes(id)) return r.filter((x) => x !== id);
      return [...r, id];
    });
  }

  function score() {
    let time = 0;
    let carrying: { from: number; to: number; n: number }[] = [];
    let served = 0;
    let stranded = 0;
    const visited = new Set<number>();
    const perStop: Record<number, { picked: number; dropped: number }> = {};
    for (let i = 0; i < route.length; i++) {
      const id = route[i];
      perStop[id] = perStop[id] || { picked: 0, dropped: 0 };
      if (i > 0) {
        const prev = route[i - 1];
        const d = dist(stops[prev], stops[id]) * (traffic[prev][id] || 1);
        time += d / 60;
      }
      time += 4;
      const remaining: typeof carrying = [];
      for (const c of carrying) {
        if (c.to === id) {
          served += c.n;
          perStop[id].dropped += c.n;
        } else remaining.push(c);
      }
      carrying = remaining;
      if (!visited.has(id)) {
        const stop = stops[id];
        const space = CAPACITY - carrying.reduce((a, c) => a + c.n, 0);
        const take = Math.min(space, stop.passengers);
        if (take > 0) {
          carrying.push({ from: id, to: stop.dest, n: take });
          perStop[id].picked += take;
        }
        visited.add(id);
      }
    }
    for (const c of carrying) stranded += c.n;
    for (const s of stops) {
      if (!visited.has(s.id)) stranded += s.passengers;
    }
    const reputation = 100 - stranded * 5 - Math.floor(time / 3);
    return { time: Math.round(time), served, stranded, reputation, perStop };
  }

  const result = score();

  function submit() {
    if (route.length < 2) return;
    setSubmitted(true);
    blip(result.reputation > 60 ? 660 : 220, 0.25, "sawtooth", 0.08);
    setTimeout(() => blip(result.reputation > 60 ? 880 : 180, 0.18, "sawtooth", 0.07), 120);
  }

  function undo() {
    if (submitted) return;
    setRoute((r) => r.slice(0, -1));
    blip(300, 0.05, "square", 0.04);
  }

  return (
    <div style={{ width: "100%", maxWidth: 900, margin: "0 auto", color: "#eee", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ margin: "8px 0" }}>Bus Route</h2>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 6 }}>
        Click stops in pickup order. Bus capacity {CAPACITY}. Red edges = traffic. Bigger circles = more waiting (surged by time of day).
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 12 }}>
        <label>Hour:</label>
        <input
          type="range"
          min={0}
          max={23}
          value={timeOfDay}
          disabled={submitted}
          onChange={(e) => setTimeOfDay(parseInt(e.target.value, 10))}
        />
        <span>{timeOfDay.toString().padStart(2, "0")}:00</span>
      </div>
      <svg width="100%" viewBox="0 0 900 560" style={{ background: "#16202b", borderRadius: 8 }}>
        {route.map((id, i) => {
          if (i === 0) return null;
          const a = stops[route[i - 1]];
          const b = stops[id];
          const t = traffic[route[i - 1]][id] || 1;
          const color = t > 1.4 ? "#e85d5d" : "#f4c542";
          return <line key={`r-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={3 + (t - 1) * 2} />;
        })}
        {stops.map((s) => {
          const d = stops[s.dest];
          return (
            <line key={`l-${s.id}`} x1={s.x} y1={s.y} x2={d.x} y2={d.y} stroke="#314156" strokeWidth={1} strokeDasharray="3 4" />
          );
        })}
        {stops.map((s) => {
          const order = route.indexOf(s.id);
          const fill = order >= 0 ? "#f4c542" : "#5b8def";
          const r = 14 + Math.min(14, s.passengers * 1.4);
          return (
            <g key={s.id} onClick={() => toggle(s.id)} style={{ cursor: "pointer" }}>
              <circle cx={s.x} cy={s.y} r={r} fill={fill} stroke="#fff" strokeWidth={2} opacity={0.92} />
              <text x={s.x} y={s.y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fill="#000">
                {s.passengers}
              </text>
              {order >= 0 && (
                <text x={s.x + r + 4} y={s.y - r + 6} fontSize={11} fill="#f4c542">
                  #{order + 1}
                </text>
              )}
              <text x={s.x} y={s.y + r + 12} textAnchor="middle" fontSize={10} fill="#aab">
                {"->"}{s.dest}{s.surge > 1.2 ? " *" : ""}
              </text>
              {submitted && result.perStop[s.id] && (
                <text x={s.x} y={s.y - r - 4} textAnchor="middle" fontSize={10} fill="#7df1c5">
                  +{result.perStop[s.id].picked} / -{result.perStop[s.id].dropped}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={submit} disabled={submitted || route.length < 2} style={{ padding: "6px 14px" }}>
          Submit Route
        </button>
        <button onClick={() => { setSeed((s) => s + 1); }} style={{ padding: "6px 14px" }}>
          New City
        </button>
        <button onClick={() => setRoute([])} style={{ padding: "6px 14px" }} disabled={submitted}>
          Clear
        </button>
        <button onClick={undo} disabled={submitted || route.length === 0} style={{ padding: "6px 14px" }}>
          Undo
        </button>
        <span style={{ marginLeft: "auto" }}>
          Stops: {route.length} | Time: {result.time}m | Served: {result.served}/{totalPassengers}
        </span>
      </div>
      {submitted && (
        <div style={{ marginTop: 10, padding: 10, background: "#1f2c3a", borderRadius: 6 }}>
          <b>Reputation: {result.reputation}</b> - {result.served} delivered, {result.stranded} stranded, route {result.time} minutes.
        </div>
      )}
    </div>
  );
}
