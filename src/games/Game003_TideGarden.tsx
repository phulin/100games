import { useEffect, useMemo, useRef, useState } from "react";

// Tide Garden: plant seeds between waves; tide drifts. Grow over 30 cycles.
// Plant traits & weather are procedurally generated from a daily seed.

const W = 800;
const H = 480;

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

function dailySeed() {
  const d = new Date();
  return (
    d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
  );
}

type PlantType = {
  name: string;
  color: string;
  desc: string;
  optimal: number;
  tolerance: number;
};

function genPlantTypes(rng: () => number): PlantType[] {
  const prefixes = ["Sea", "Salt", "Wave", "Tide", "Sun", "Moss", "Reed", "Dune", "Cliff", "Pearl", "Star"];
  const suffixes = ["weed", "frond", "moss", "bloom", "vine", "stalk", "berry", "leaf", "spire", "fern"];
  const colors = ["#3aa", "#8c5", "#dc8", "#c6f", "#fa6", "#6cf"];
  const count = 3 + Math.floor(rng() * 2);
  const types: PlantType[] = [];
  const usedNames = new Set<string>();
  for (let i = 0; i < count; i++) {
    let name: string;
    do {
      name = prefixes[Math.floor(rng() * prefixes.length)] + suffixes[Math.floor(rng() * suffixes.length)];
    } while (usedNames.has(name));
    usedNames.add(name);
    const optimal = (i + 0.5) / count + (rng() - 0.5) * 0.1;
    const tolerance = 0.18 + rng() * 0.15;
    const color = colors[i % colors.length];
    const zone = optimal < 0.4 ? "low (wet)" : optimal < 0.7 ? "mid splash" : "high & dry";
    types.push({
      name,
      color,
      desc: `prefers ${zone} zone`,
      optimal: Math.max(0.15, Math.min(0.9, optimal)),
      tolerance,
    });
  }
  return types;
}

type Plant = { x: number; y: number; type: number; growth: number; dead: boolean };

let _audioCtx: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    if (!_audioCtx) {
      const AC =
        (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return null;
      _audioCtx = new AC();
    }
    return _audioCtx;
  } catch {
    return null;
  }
}
function noise(dur: number, vol = 0.05) {
  const ctx = audio();
  if (!ctx) return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = vol;
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = 800;
  src.connect(filt);
  filt.connect(g);
  g.connect(ctx.destination);
  src.start();
}

type Weather = "calm" | "storm" | "drought";

export default function Game003_TideGarden() {
  const [daily, setDaily] = useState(true);
  const [seed, setSeed] = useState(() => dailySeed());
  const PLANT_TYPES = useMemo(() => genPlantTypes(mulberry32(seed ^ 0xabcdef)), [seed]);
  const driftRngRef = useRef<() => number>(mulberry32(seed ^ 0x12345));
  const [plants, setPlants] = useState<Plant[]>([]);
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<"plant" | "wave">("plant");
  const [, setPhaseTime] = useState(0);
  const [tideLine, setTideLine] = useState(0.55);
  const [waveProgress, setWaveProgress] = useState(0);
  const [tool, setTool] = useState(0);
  const [score, setScore] = useState(0);
  const [weather, setWeather] = useState<Weather>("calm");
  const [showHelp, setShowHelp] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ plants, tideLine, weather });
  stateRef.current = { plants, tideLine, weather };

  useEffect(() => {
    if (phase === "plant" && cycle > 0) {
      const r = driftRngRef.current;
      const drift = (r() - 0.5) * 0.18;
      setTideLine((t) => Math.max(0.2, Math.min(0.85, t + drift)));
      const wr = r();
      if (wr < 0.12) setWeather("storm");
      else if (wr < 0.22) setWeather("drought");
      else setWeather("calm");
    }
  }, [cycle, phase]);

  useEffect(() => {
    if (cycle >= 30) return;
    const dur = phase === "plant" ? 5 : 2.2;
    let last = performance.now();
    let raf = 0;
    let playedSurf = false;
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setPhaseTime((pt) => {
        const np = pt + dt;
        if (phase === "wave" && np > 0.4 && !playedSurf) {
          playedSurf = true;
          noise(0.6, weather === "storm" ? 0.12 : 0.05);
        }
        if (np >= dur) {
          if (phase === "plant") {
            setPhase("wave");
            setWaveProgress(0);
          } else {
            const tl = stateRef.current.tideLine;
            const wx = stateRef.current.weather;
            const stormReach = wx === "storm" ? 0.12 : 0;
            const droughtMult = wx === "drought" ? 0.5 : 1;
            setPlants((ps) =>
              ps
                .map((p) => {
                  const pNorm = (p.y - 80) / (H - 120);
                  const inSurf = pNorm > tl - 0.1 - stormReach && pNorm < tl + 0.05;
                  const covered = pNorm > tl;
                  const type = PLANT_TYPES[p.type];
                  const opt = type.optimal;
                  const tol = type.tolerance;
                  const fit = Math.max(0, 1 - Math.abs(pNorm - opt) / tol);
                  let g = p.growth;
                  let dead = p.dead;
                  if (covered && fit < 0.4 && wx === "storm") return null as unknown as Plant;
                  if (covered && fit < 0.3) return null as unknown as Plant;
                  if (inSurf || covered) g += fit * 0.35 * droughtMult;
                  else g += fit * 0.05 * droughtMult;
                  if (fit < 0.05) dead = true;
                  return { ...p, growth: Math.min(1, g), dead };
                })
                .filter(Boolean) as Plant[],
            );
            setPhase("plant");
            setCycle((c) => c + 1);
          }
          return 0;
        }
        if (phase === "wave") setWaveProgress(np / dur);
        return np;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, cycle, PLANT_TYPES, weather]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = weather === "storm" ? "#7a7060" : weather === "drought" ? "#f8dfa0" : "#f3e6c4";
    ctx.fillRect(0, 0, W, H);
    const seaY = 80 + (H - 120) * tideLine;
    const grad = ctx.createLinearGradient(0, 0, 0, seaY);
    if (weather === "storm") {
      grad.addColorStop(0, "#0e1a2a");
      grad.addColorStop(1, "#2a4878");
    } else {
      grad.addColorStop(0, "#1b3a5a");
      grad.addColorStop(1, "#3a78a8");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, seaY);
    ctx.fillStyle = "rgba(140,110,70,0.5)";
    ctx.fillRect(0, seaY, W, 18);
    if (phase === "wave") {
      const stormBoost = weather === "storm" ? 30 : 0;
      const reach = waveProgress < 0.5 ? waveProgress * 2 : (1 - waveProgress) * 2;
      const waveY = seaY + reach * (80 + stormBoost);
      ctx.fillStyle = "rgba(100,170,210,0.55)";
      ctx.fillRect(0, seaY, W, waveY - seaY);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.beginPath();
      for (let x = 0; x < W; x += 6) {
        const yy = waveY + Math.sin(x / 30 + waveProgress * 8) * 4;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, seaY);
    ctx.lineTo(W, seaY);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const p of plants) {
      const t = PLANT_TYPES[p.type] ?? PLANT_TYPES[0];
      ctx.fillStyle = p.dead ? "#5a4030" : t.color;
      const h = 6 + p.growth * 30;
      ctx.fillRect(p.x - 3, p.y - h, 6, h);
      ctx.beginPath();
      ctx.arc(p.x, p.y - h, 4 + p.growth * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (weather !== "calm") {
      ctx.fillStyle = weather === "storm" ? "#ffdd55" : "#bb6600";
      ctx.font = "bold 14px system-ui";
      ctx.fillText(weather === "storm" ? "STORM" : "DROUGHT", 10, 20);
    }
    const sc = plants.reduce((a, p) => a + (p.dead ? 0 : p.growth), 0);
    setScore(Math.round(sc * 10));
  }, [plants, tideLine, phase, waveProgress, weather, PLANT_TYPES]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phase !== "plant" || cycle >= 30) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    if (y < 80 + (H - 120) * tideLine - 4) return;
    setPlants((ps) => [...ps, { x, y, type: tool, growth: 0, dead: false }]);
  };

  const restart = () => {
    const ns = daily ? dailySeed() : Math.floor(Math.random() * 1e9);
    setSeed(ns);
    driftRngRef.current = mulberry32(ns ^ 0x12345);
    setPlants([]);
    setCycle(0);
    setPhase("plant");
    setPhaseTime(0);
    setTideLine(0.55);
    setWaveProgress(0);
    setScore(0);
    setWeather("calm");
    setTool(0);
  };

  const alive = plants.filter((p) => !p.dead);
  const matureCount = alive.filter((p) => p.growth > 0.7).length;
  const speciesAlive = new Set(alive.map((p) => p.type)).size;
  const diversityBonus = speciesAlive * 5;
  const maturityBonus = matureCount * 3;

  return (
    <div style={{ color: "#222", fontFamily: "system-ui", padding: 8 }}>
      <h2 style={{ margin: "4px 0", color: "#234" }}>Tide Garden</h2>
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        Click sand to plant. Match each species to its preferred zone. 30 wave cycles.{" "}
        <button type="button" onClick={() => setShowHelp((s) => !s)} style={{ fontSize: 12 }}>
          {showHelp ? "hide" : "?"}
        </button>
      </div>
      {showHelp && (
        <div
          style={{
            background: "#fffbe6",
            padding: 8,
            margin: "6px 0",
            borderRadius: 4,
            fontSize: 13,
            border: "1px solid #aa8",
          }}
        >
          Tide line drifts each cycle (seeded). Plants must sit near their optimal zone. Storms drown weak roots and reach higher. Drought halves growth. Diversity scores bonus at the end.
        </div>
      )}
      <div style={{ margin: "6px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {PLANT_TYPES.map((t, i) => (
          <button
            type="button"
            key={t.name}
            onClick={() => setTool(i)}
            style={{
              background: tool === i ? t.color : "#ddd",
              border: "1px solid #444",
              padding: "4px 8px",
              fontWeight: 600,
              outline: tool === i ? "2px solid #234" : "none",
            }}
            aria-pressed={tool === i}
          >
            {t.name}
          </button>
        ))}
        <span style={{ fontSize: 12 }}>{PLANT_TYPES[tool]?.desc}</span>
        <label style={{ fontSize: 12, marginLeft: 8 }}>
          <input type="checkbox" checked={daily} onChange={(e) => setDaily(e.target.checked)} /> daily seed
        </label>
        <button type="button" onClick={restart} style={{ fontSize: 12 }}>
          restart
        </button>
        <span style={{ marginLeft: "auto" }}>
          Cycle {cycle}/30 | {phase} | weather: <b>{weather}</b> | Score: <b>{score}</b>
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        onClick={onClick}
        style={{ width: "100%", maxWidth: W, border: "1px solid #444", cursor: "crosshair" }}
      />
      {cycle >= 30 && (
        <div style={{ marginTop: 8, padding: 8, background: "#eef2f7", borderRadius: 4 }}>
          <b>Final score: {score + diversityBonus + maturityBonus}</b>
          <div style={{ fontSize: 13 }}>
            Growth: {score} + diversity ({speciesAlive} species × 5 = {diversityBonus}) + mature plants ({matureCount} × 3 = {maturityBonus})
          </div>
        </div>
      )}
    </div>
  );
}
