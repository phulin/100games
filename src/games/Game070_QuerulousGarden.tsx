import { useEffect, useMemo, useRef, useState } from "react";

// Game 70 - The Querulous Garden
// Plants ask questions. Visible conditions give an objective answer.
// Each plant has a hidden personality affecting how their question maps
// to their true need. Diagnose what each ACTUALLY needs.

type Personality = "honest" | "paranoid" | "contrarian" | "stoic";
type Need = "more sun" | "less sun" | "more water" | "less water" | "fine";

type Plant = {
  id: number;
  name: string;
  hiddenPersonality: Personality;
  hiddenTrueNeed: Need;
  sun: number;
  water: number;
  emoji: string;
  question: string;
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

const NAME_A = ["Fer", "Bas", "Rose", "Ir", "Sa", "Mari", "Lil", "This", "Wil", "Lin", "Cam", "Hes", "Bram", "Cor", "Yar"];
const NAME_B = ["n", "il", "mary", "is", "ge", "gold", "y", "tle", "low", "den", "phor", "per", "ble", "ona", "row"];
const EMOJIS = ["🌱", "🌿", "🌵", "🌾", "🌻", "🪴", "🍀", "🌷"];

const Q_TEMPLATES: Record<Personality, Partial<Record<Need, string[]>> & { generic?: string[] }> = {
  honest: {
    "more sun": ["Am I getting enough sun?", "It feels dim — should I move?", "Could I use a little more light?"],
    "less sun": ["Is it too bright here?", "The glare is harsh, isn't it?", "Am I being scorched?"],
    "more water": ["I feel parched — no?", "Are my roots dry?", "Could you spare some water?"],
    "less water": ["Am I drowning?", "These roots feel soggy.", "Is the soil too wet?"],
    fine: ["Is everything alright?", "Seems fine to me, right?", "Just checking in."],
  },
  paranoid: {
    generic: [
      "I'm definitely dying of thirst!",
      "The sun is burning me alive!",
      "I'm sure I'm getting too much water!",
      "Something is terribly wrong, isn't it?",
      "Why is everyone else doing better than me?",
      "I feel myself withering!",
      "The light here is murderous!",
    ],
  },
  contrarian: {
    "more sun": ["Isn't this too sunny?", "The glare is unbearable."],
    "less sun": ["Could use more light, no?", "It's so dark in here."],
    "more water": ["I'm absolutely waterlogged.", "Drowning, actually."],
    "less water": ["Why so dry around here?", "Parched, really."],
    fine: ["Something must be off, right?", "Surely we have a problem."],
  },
  stoic: {
    generic: ["...", "I require nothing.", "I am as I am.", "It is what it is."],
  },
};

function genPlants(seed: number): Plant[] {
  const r = mulberry32(seed);
  const personalities: Personality[] = ["honest", "paranoid", "contrarian", "stoic"];
  const needs: Need[] = ["more sun", "less sun", "more water", "less water", "fine"];
  const usedNames = new Set<string>();
  const plants: Plant[] = [];
  while (plants.length < 6) {
    const nm = NAME_A[Math.floor(r() * NAME_A.length)] + NAME_B[Math.floor(r() * NAME_B.length)];
    if (usedNames.has(nm)) continue;
    usedNames.add(nm);
    const sun = Math.floor(r() * 11);
    const water = Math.floor(r() * 11);
    let trueNeed: Need = "fine";
    if (sun < 3) trueNeed = "more sun";
    else if (sun > 7) trueNeed = "less sun";
    else if (water < 3) trueNeed = "more water";
    else if (water > 7) trueNeed = "less water";
    if (r() < 0.25) trueNeed = needs[Math.floor(r() * needs.length)];
    const personality = personalities[Math.floor(r() * personalities.length)];
    const emoji = EMOJIS[Math.floor(r() * EMOJIS.length)];
    const tpls = Q_TEMPLATES[personality];
    let pool: string[] | undefined;
    if (personality === "paranoid" || personality === "stoic") pool = tpls.generic;
    else pool = tpls[trueNeed] ?? tpls.generic;
    const q = pool && pool.length > 0 ? pool[Math.floor(r() * pool.length)] : "Hmm.";
    plants.push({
      id: plants.length,
      name: nm,
      hiddenPersonality: personality,
      hiddenTrueNeed: trueNeed,
      sun,
      water,
      emoji,
      question: q,
    });
  }
  return plants;
}

const ACTIONS: Need[] = ["more sun", "less sun", "more water", "less water", "fine"];

type Leader = { player: string; score: number; seed: number; created_at: number };

export default function Game070_QuerulousGarden() {
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const plants = useMemo(() => genPlants(seed), [seed]);
  const [diagnoses, setDiagnoses] = useState<Record<number, Need>>({});
  const [submitted, setSubmitted] = useState(false);
  const [player, setPlayer] = useState(() => {
    try {
      return localStorage.getItem("g70_player") || "";
    } catch {
      return "";
    }
  });
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [posting, setPosting] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  function ensureCtx() {
    if (!audioRef.current) {
      try {
        audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch {}
    }
    return audioRef.current;
  }

  function chime(freq: number) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.18, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  let correct = 0;
  if (submitted) for (const p of plants) if (diagnoses[p.id] === p.hiddenTrueNeed) correct++;

  function set(id: number, n: Need) {
    setDiagnoses((d) => ({ ...d, [id]: n }));
    chime(440 + ACTIONS.indexOf(n) * 60);
  }

  async function refreshLeaders() {
    try {
      const res = await fetch("/api/querulous-garden/leaders");
      if (!res.ok) return;
      const data = (await res.json()) as { leaders?: Leader[] };
      if (Array.isArray(data.leaders)) setLeaders(data.leaders);
    } catch {}
  }

  useEffect(() => {
    refreshLeaders();
  }, []);

  async function postScore() {
    if (!player.trim() || !submitted || posting) return;
    setPosting(true);
    try {
      localStorage.setItem("g70_player", player.trim());
    } catch {}
    try {
      const res = await fetch("/api/querulous-garden/leaders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ player: player.trim(), score: correct, seed }),
      });
      if (res.ok) refreshLeaders();
    } catch {}
    setPosting(false);
  }

  function submit() {
    setSubmitted(true);
    chime(880);
  }

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>The Querulous Garden</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Each plant asks something. You see its visible sun and water levels (0–10). Diagnose what it actually needs — some plants are honest, paranoid, contrarian, or stoic.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 8 }}>
        {plants.map((p) => (
          <div key={p.id} style={{ background: "#1f2c3a", padding: 12, borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 28 }}>{p.emoji}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Sun {p.sun}/10 · Water {p.water}/10</div>
              </div>
            </div>
            <div style={{ fontStyle: "italic", margin: "8px 0", padding: 6, background: "#0d1320", borderRadius: 4 }}>
              "{p.question}"
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {ACTIONS.map((a) => (
                <button
                  key={a}
                  onClick={() => set(p.id, a)}
                  disabled={submitted}
                  style={{ background: diagnoses[p.id] === a ? "#345" : "#223", fontSize: 11, padding: "4px 8px" }}
                >
                  {a}
                </button>
              ))}
            </div>
            {submitted && (
              <div style={{ marginTop: 6, fontSize: 12, color: diagnoses[p.id] === p.hiddenTrueNeed ? "#7df1c5" : "#ff7d8f" }}>
                {p.hiddenPersonality} · truly needs: {p.hiddenTrueNeed}
              </div>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={submit} disabled={submitted || Object.keys(diagnoses).length < plants.length}>
          Submit Diagnoses
        </button>
        <button
          onClick={() => {
            setDiagnoses({});
            setSubmitted(false);
            setSeed(Math.floor(Math.random() * 1e9));
          }}
        >
          New Garden
        </button>
        {submitted && <span>Correct: {correct}/{plants.length}</span>}
        {submitted && (
          <>
            <input
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
              placeholder="your name"
              style={{ padding: 4, background: "#0d1320", color: "#eee", border: "1px solid #345", borderRadius: 4 }}
            />
            <button onClick={postScore} disabled={!player.trim() || posting}>
              {posting ? "Posting…" : "Post Score"}
            </button>
          </>
        )}
      </div>
      <div style={{ marginTop: 14, fontSize: 12 }}>
        <div style={{ opacity: 0.8, fontWeight: 700, marginBottom: 4 }}>Leaderboard</div>
        {leaders.length === 0 && <div style={{ opacity: 0.5 }}>No scores yet. Submit yours!</div>}
        {leaders.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 12, padding: "2px 0", opacity: 0.9 }}>
            <span style={{ width: 24 }}>#{i + 1}</span>
            <span style={{ flex: 1 }}>{l.player}</span>
            <span>{l.score}/6</span>
            <span style={{ opacity: 0.5 }}>seed {l.seed}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
