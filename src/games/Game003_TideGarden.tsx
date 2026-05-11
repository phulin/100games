import { useEffect, useRef, useState } from "react";

// Tide Garden: plant seeds between waves; tide drifts. Grow over 30 cycles.

const W = 800;
const H = 480;
const PLANT_TYPES = [
  { name: "Kelp", color: "#3aa", desc: "loves wet (low tide line)", optimal: 0.8 },
  { name: "Reed", color: "#8c5", desc: "mid splash zone", optimal: 0.55 },
  { name: "Dune", color: "#dc8", desc: "high & dry", optimal: 0.25 },
] as const;

type Plant = { x: number; y: number; type: number; growth: number; dead: boolean };

export default function Game003_TideGarden() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [cycle, setCycle] = useState(0);
  const [phase, setPhase] = useState<"plant" | "wave">("plant");
  const [, setPhaseTime] = useState(0);
  const [tideLine, setTideLine] = useState(0.55); // 0=top (sea), 1=bottom (dry land)
  const [waveProgress, setWaveProgress] = useState(0); // 0..1
  const [tool, setTool] = useState(0);
  const [score, setScore] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ plants, tideLine });
  stateRef.current = { plants, tideLine };

  // tide drift each cycle
  useEffect(() => {
    if (phase === "plant") {
      const drift = (Math.random() - 0.5) * 0.12;
      setTideLine((t) => Math.max(0.2, Math.min(0.85, t + drift)));
    }
  }, [cycle, phase]);

  // phase timer
  useEffect(() => {
    if (cycle >= 30) return;
    const dur = phase === "plant" ? 5 : 2.2;
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      setPhaseTime((pt) => {
        const np = pt + dt;
        if (np >= dur) {
          if (phase === "plant") {
            setPhase("wave");
            setWaveProgress(0);
          } else {
            // resolve wave
            const tl = stateRef.current.tideLine;
            setPlants((ps) =>
              ps
                .map((p) => {
                  const pNorm = (p.y - 80) / (H - 120);
                  const inSurf = pNorm > tl - 0.1 && pNorm < tl + 0.05;
                  // washed away if covered and not kelp
                  const covered = pNorm > tl;
                  const opt = PLANT_TYPES[p.type].optimal;
                  const fit = 1 - Math.min(1, Math.abs(pNorm - opt) * 3);
                  let g = p.growth;
                  let dead = p.dead;
                  if (covered && p.type !== 0 && fit < 0.5) {
                    // washed away
                    return null as unknown as Plant;
                  }
                  if (inSurf || covered) g += fit * 0.35;
                  else g += fit * 0.05;
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
  }, [phase, cycle]);

  // draw
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#f3e6c4";
    ctx.fillRect(0, 0, W, H);
    // sea gradient
    const seaY = 80 + (H - 120) * tideLine;
    const grad = ctx.createLinearGradient(0, 0, 0, seaY);
    grad.addColorStop(0, "#1b3a5a");
    grad.addColorStop(1, "#3a78a8");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, seaY);
    // wet sand
    ctx.fillStyle = "rgba(140,110,70,0.5)";
    ctx.fillRect(0, seaY, W, 18);
    // wave during wave phase
    if (phase === "wave") {
      const reach = waveProgress < 0.5 ? waveProgress * 2 : (1 - waveProgress) * 2;
      const waveY = seaY + reach * 80;
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
    // tide line marker
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, seaY);
    ctx.lineTo(W, seaY);
    ctx.stroke();
    ctx.setLineDash([]);
    // plants
    for (const p of plants) {
      const t = PLANT_TYPES[p.type];
      ctx.fillStyle = p.dead ? "#5a4030" : t.color;
      const h = 6 + p.growth * 30;
      ctx.fillRect(p.x - 3, p.y - h, 6, h);
      ctx.beginPath();
      ctx.arc(p.x, p.y - h, 4 + p.growth * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // score live
    const sc = plants.reduce((a, p) => a + (p.dead ? 0 : p.growth), 0);
    setScore(Math.round(sc * 10));
  }, [plants, tideLine, phase, waveProgress]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (phase !== "plant" || cycle >= 30) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    if (y < 80 + (H - 120) * tideLine - 4) return; // can't plant in sea
    setPlants((ps) => [...ps, { x, y, type: tool, growth: 0, dead: false }]);
  };

  return (
    <div style={{ color: "#222", fontFamily: "system-ui", padding: 8 }}>
      <h2 style={{ margin: "4px 0", color: "#234" }}>Tide Garden</h2>
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        Click sand to plant. Pick the right plant for the right tide zone. 30 wave cycles.
      </div>
      <div style={{ margin: "6px 0", display: "flex", gap: 8, alignItems: "center" }}>
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
            }}
          >
            {t.name}
          </button>
        ))}
        <span style={{ fontSize: 12 }}>{PLANT_TYPES[tool].desc}</span>
        <span style={{ marginLeft: "auto" }}>
          Cycle {cycle}/30 | {phase} | Garden score: <b>{score}</b>
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
        <div style={{ marginTop: 8 }}>
          Final garden score: <b>{score}</b>
        </div>
      )}
    </div>
  );
}
