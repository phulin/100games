import { useRef, useState } from "react";

// Reverberation: circular timeline, place tone-pegs with delayed echoes to match a target melody.

const STEPS = 16;
const PITCHES = ["C4", "D4", "E4", "G4", "A4", "C5"];
const PITCH_HZ: Record<string, number> = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
};

type Peg = { step: number; pitch: string; echoDelay: number };

// Generate a target melody (5-7 notes at specific steps)
function makeTarget(seed: number): { step: number; pitch: string }[] {
  let s = seed;
  const rnd = () => {
    s = (s * 1103515245 + 12345) >>> 0;
    return (s % 1000) / 1000;
  };
  const n = 5 + Math.floor(rnd() * 3);
  const out: { step: number; pitch: string }[] = [];
  const usedSteps = new Set<number>();
  while (out.length < n) {
    const st = Math.floor(rnd() * STEPS);
    if (usedSteps.has(st)) continue;
    usedSteps.add(st);
    out.push({ step: st, pitch: PITCHES[Math.floor(rnd() * PITCHES.length)] });
  }
  return out.sort((a, b) => a.step - b.step);
}

export default function Game007_Reverberation() {
  const [target] = useState(() => makeTarget(Math.floor(Math.random() * 1e6)));
  const [pegs, setPegs] = useState<Peg[]>([]);
  const [pitch, setPitch] = useState("C4");
  const [echo, setEcho] = useState(0);
  const [playStep, setPlayStep] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const acRef = useRef<AudioContext | null>(null);

  const getAC = () => {
    if (!acRef.current) {
      acRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return acRef.current;
  };

  const playNote = (p: string, when = 0, vol = 0.3) => {
    const ac = getAC();
    const t = ac.currentTime + when;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.value = PITCH_HZ[p];
    o.connect(g);
    g.connect(ac.destination);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    o.start(t);
    o.stop(t + 0.5);
  };

  const addPeg = (step: number) => {
    setPegs((p) => {
      const existing = p.find((x) => x.step === step && x.pitch === pitch);
      if (existing) {
        // If echo differs from current slider, update the echo; otherwise toggle off.
        if (existing.echoDelay !== echo) {
          return p.map((x) =>
            x.step === step && x.pitch === pitch ? { ...x, echoDelay: echo } : x,
          );
        }
        return p.filter((x) => !(x.step === step && x.pitch === pitch));
      }
      return [...p, { step, pitch, echoDelay: echo }];
    });
  };

  const play = (mode: "target" | "yours") => {
    if (playing) return;
    setPlaying(true);
    const stepDur = 0.18;
    if (mode === "target") {
      for (const t of target) playNote(t.pitch, t.step * stepDur, 0.35);
    } else {
      for (const p of pegs) {
        playNote(p.pitch, p.step * stepDur, 0.35);
        if (p.echoDelay > 0) {
          // Echo wraps in scoring, so wrap during playback too — otherwise audio
          // and scoring disagree about where echoes land.
          const es = (p.step + p.echoDelay) % STEPS;
          playNote(p.pitch, es * stepDur, 0.22);
        }
      }
    }
    // visual step indicator
    let i = 0;
    const id = setInterval(() => {
      setPlayStep(i);
      i++;
      if (i >= STEPS + 4) {
        clearInterval(id);
        setPlayStep(-1);
        setPlaying(false);
      }
    }, stepDur * 1000);
  };

  // Compute resulting "tones at each step" for scoring
  const resulting = new Map<number, Set<string>>();
  for (const p of pegs) {
    if (!resulting.has(p.step)) resulting.set(p.step, new Set());
    resulting.get(p.step)!.add(p.pitch);
    if (p.echoDelay > 0) {
      const es = (p.step + p.echoDelay) % STEPS;
      if (!resulting.has(es)) resulting.set(es, new Set());
      resulting.get(es)!.add(p.pitch);
    }
  }
  const score = target.filter((t) => resulting.get(t.step)?.has(t.pitch)).length;
  const extras = Array.from(resulting.entries()).reduce(
    (acc, [s, set]) =>
      acc +
      Array.from(set).filter((p) => !target.find((t) => t.step === s && t.pitch === p)).length,
    0,
  );

  const cx = 220;
  const cy = 220;
  const radius = 170;

  return (
    <div style={{ color: "#eef", fontFamily: "system-ui", padding: 8, background: "#1b1b25" }}>
      <h2 style={{ margin: "4px 0" }}>Reverberation</h2>
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        Place pegs around the loop. Echo delay re-plays the note N steps later. Match the target with few pegs.
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        <svg width={440} height={440} style={{ background: "#11111a", borderRadius: 8 }}>
          <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#334" strokeWidth={2} />
          {Array.from({ length: STEPS }, (_, i) => {
            const ang = (i / STEPS) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(ang) * radius;
            const y = cy + Math.sin(ang) * radius;
            const isActive = playStep === i;
            const tgt = target.find((t) => t.step === i);
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 14 : 10}
                  fill={tgt ? "#553" : "#223"}
                  stroke={isActive ? "#ff8" : "#445"}
                  strokeWidth={2}
                  onClick={() => addPeg(i)}
                  style={{ cursor: "pointer" }}
                />
                {tgt && (
                  <text x={x} y={y + 4} textAnchor="middle" fontSize={9} fill="#ffd">
                    {tgt.pitch}
                  </text>
                )}
              </g>
            );
          })}
          {pegs.map((p, idx) => {
            const ang = (p.step / STEPS) * Math.PI * 2 - Math.PI / 2;
            const x = cx + Math.cos(ang) * (radius - 26);
            const y = cy + Math.sin(ang) * (radius - 26);
            const ec = (p.step + p.echoDelay) % STEPS;
            const eAng = (ec / STEPS) * Math.PI * 2 - Math.PI / 2;
            const ex = cx + Math.cos(eAng) * (radius - 26);
            const ey = cy + Math.sin(eAng) * (radius - 26);
            return (
              <g key={idx}>
                {p.echoDelay > 0 && (
                  <line x1={x} y1={y} x2={ex} y2={ey} stroke="#5af" strokeOpacity={0.4} />
                )}
                <circle cx={x} cy={y} r={8} fill="#5af" />
                <text x={x} y={y + 3} fontSize={8} textAnchor="middle" fill="#012">
                  {p.pitch[0]}
                </text>
                {p.echoDelay > 0 && <circle cx={ex} cy={ey} r={6} fill="#5af" fillOpacity={0.5} />}
              </g>
            );
          })}
        </svg>
        <div style={{ flex: 1 }}>
          <div>
            Pitch:{" "}
            {PITCHES.map((p) => (
              <button
                type="button"
                key={p}
                onClick={() => setPitch(p)}
                style={{
                  margin: 2,
                  padding: "3px 8px",
                  background: pitch === p ? "#5af" : "#334",
                  color: "#fff",
                  border: 0,
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 6 }}>
            Echo delay:{" "}
            <input
              type="range"
              min={0}
              max={6}
              value={echo}
              onChange={(e) => setEcho(Number(e.target.value))}
            />{" "}
            {echo} steps
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={() => play("target")}>
              Play target
            </button>{" "}
            <button type="button" onClick={() => play("yours")}>
              Play yours
            </button>{" "}
            <button type="button" onClick={() => setPegs([])}>
              Clear
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: 14 }}>
            Matched: {score}/{target.length}
            <br />
            Pegs used: {pegs.length} | Extra tones: {extras}
            {score === target.length && extras === 0 && (
              <div style={{ color: "#9f9", marginTop: 4 }}>
                Perfect! Used {pegs.length} pegs for {target.length} notes.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
