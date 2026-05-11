import { useMemo, useState } from "react";

// Game 70 - The Querulous Garden
// Plants ask questions. Visible conditions give an objective answer.
// Each plant has a hidden personality affecting how their question maps
// to their true need. Diagnose what each ACTUALLY needs.

type Personality = "honest" | "paranoid" | "contrarian";
type Need = "more sun" | "less sun" | "more water" | "less water" | "fine";

type Plant = {
  id: number;
  name: string;
  hiddenPersonality: Personality;
  hiddenTrueNeed: Need;
  sun: number; // 0-10 visible
  water: number; // 0-10 visible
  // what they say:
  question: string;
};

const NAMES = ["Fern", "Basil", "Rosemary", "Iris", "Sage", "Marigold", "Lily", "Thistle"];

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function genPlants(seed: number): Plant[] {
  const r = seededRand(seed);
  const personalities: Personality[] = ["honest", "paranoid", "contrarian"];
  const needs: Need[] = ["more sun", "less sun", "more water", "less water", "fine"];
  return NAMES.slice(0, 6).map((n, i) => {
    const sun = Math.floor(r() * 11);
    const water = Math.floor(r() * 11);
    // pick true need based on actual conditions (mostly)
    let trueNeed: Need = "fine";
    if (sun < 3) trueNeed = "more sun";
    else if (sun > 7) trueNeed = "less sun";
    else if (water < 3) trueNeed = "more water";
    else if (water > 7) trueNeed = "less water";
    // 25% chance to flip to a different need
    if (r() < 0.25) trueNeed = needs[Math.floor(r() * needs.length)];
    const personality = personalities[Math.floor(r() * personalities.length)];
    let q = "";
    // generate the question based on personality
    if (personality === "honest") {
      q =
        trueNeed === "more sun"
          ? "Am I getting enough sun?"
          : trueNeed === "less sun"
          ? "Is it too bright here?"
          : trueNeed === "more water"
          ? "I feel parched, no?"
          : trueNeed === "less water"
          ? "Am I drowning?"
          : "Is everything alright?";
    } else if (personality === "paranoid") {
      // always claims something is wrong, often the OPPOSITE of truth
      const opts = [
        "I'm definitely dying of thirst!",
        "The sun is burning me!",
        "I'm sure I'm getting too much water!",
        "Something is wrong, isn't it?",
        "Why is everyone else doing better?",
      ];
      q = opts[Math.floor(r() * opts.length)];
    } else {
      // contrarian: complains about the opposite of true need
      q =
        trueNeed === "more sun"
          ? "Isn't this too sunny?"
          : trueNeed === "less sun"
          ? "Could use more light, no?"
          : trueNeed === "more water"
          ? "I'm absolutely waterlogged."
          : trueNeed === "less water"
          ? "Why so dry around here?"
          : "Something must be off, right?";
    }
    return { id: i, name: n, hiddenPersonality: personality, hiddenTrueNeed: trueNeed, sun, water, question: q };
  });
}

const ACTIONS: Need[] = ["more sun", "less sun", "more water", "less water", "fine"];

export default function Game070_QuerulousGarden() {
  const [seed, setSeed] = useState(7);
  const plants = useMemo(() => genPlants(seed), [seed]);
  const [diagnoses, setDiagnoses] = useState<Record<number, Need>>({});
  const [submitted, setSubmitted] = useState(false);

  function set(id: number, n: Need) {
    setDiagnoses((d) => ({ ...d, [id]: n }));
  }

  let correct = 0;
  if (submitted) {
    for (const p of plants) if (diagnoses[p.id] === p.hiddenTrueNeed) correct++;
  }

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui, sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <h2 style={{ margin: "8px 0" }}>The Querulous Garden</h2>
      <div style={{ fontSize: 13, opacity: 0.85 }}>
        Each plant asks something. You see its visible sun and water levels (0–10). Diagnose what it actually needs — but watch out: some plants are paranoid or contrarian.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, marginTop: 8 }}>
        {plants.map((p) => (
          <div key={p.id} style={{ background: "#1f2c3a", padding: 12, borderRadius: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 28 }}>🌱</div>
              <div>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>
                  Sun {p.sun}/10 · Water {p.water}/10
                </div>
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
                  style={{
                    background: diagnoses[p.id] === a ? "#345" : "#223",
                    fontSize: 11,
                    padding: "4px 8px",
                  }}
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
      <div style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
        <button onClick={() => setSubmitted(true)} disabled={submitted || Object.keys(diagnoses).length < plants.length}>
          Submit Diagnoses
        </button>
        <button
          onClick={() => {
            setDiagnoses({});
            setSubmitted(false);
            setSeed((s) => s + 1);
          }}
        >
          New Garden
        </button>
        {submitted && <span>Correct: {correct}/{plants.length}</span>}
      </div>
    </div>
  );
}
