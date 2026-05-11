import { useMemo, useState } from "react";

// Liar's Compass: NPCs point a direction; exactly one is honest.
// 10 rounds. Each NPC has a public bias.

const DIRS = [
  { name: "N", dx: 0, dy: -1 },
  { name: "NE", dx: 1, dy: -1 },
  { name: "E", dx: 1, dy: 0 },
  { name: "SE", dx: 1, dy: 1 },
  { name: "S", dx: 0, dy: 1 },
  { name: "SW", dx: -1, dy: 1 },
  { name: "W", dx: -1, dy: 0 },
  { name: "NW", dx: -1, dy: -1 },
];

function dayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}
function fnv(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
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

const SYLLABLES_HARD = ["br", "tr", "kr", "dr", "fl", "gr", "kl", "pr", "sn", "vl", "th", "ph", "sh", "zh", "qu"];
const SYLLABLES_SOFT = ["a", "e", "i", "o", "u", "ai", "ea", "ou", "an", "en", "in", "on", "ar", "er", "or"];
const SYLLABLES_END = ["n", "m", "l", "r", "s", "x", "k", "th", "ne", "ra", "la", "no"];
function genName(rng: () => number): string {
  const s1 = SYLLABLES_HARD[Math.floor(rng() * SYLLABLES_HARD.length)];
  const s2 = SYLLABLES_SOFT[Math.floor(rng() * SYLLABLES_SOFT.length)];
  const s3 = SYLLABLES_END[Math.floor(rng() * SYLLABLES_END.length)];
  const name = s1 + s2 + s3;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

type Bias =
  | { kind: "alwaysLies" }
  | { kind: "alwaysTruth" }
  | { kind: "liesRounds"; parity: 0 | 1 }
  | { kind: "liesAbout"; dir: string }
  | { kind: "liesEveryN"; n: number }
  | { kind: "liesIfFar"; threshold: number };

function biasText(b: Bias): string {
  if (b.kind === "alwaysLies") return "always lies";
  if (b.kind === "alwaysTruth") return "always tells the truth";
  if (b.kind === "liesRounds") return `lies on ${b.parity === 0 ? "even" : "odd"} rounds`;
  if (b.kind === "liesAbout") return `lies whenever the truth is ${b.dir}`;
  if (b.kind === "liesEveryN") return `lies every ${b.n}${b.n === 3 ? "rd" : "th"} round`;
  if (b.kind === "liesIfFar") return `lies when treasure is far (Δ>${b.threshold})`;
  return "?";
}

function tellsTruth(b: Bias, round: number, truth: string, dist: number): boolean {
  if (b.kind === "alwaysLies") return false;
  if (b.kind === "alwaysTruth") return true;
  if (b.kind === "liesRounds") return round % 2 !== b.parity;
  if (b.kind === "liesAbout") return truth !== b.dir;
  if (b.kind === "liesEveryN") return round % b.n !== 0;
  if (b.kind === "liesIfFar") return dist <= b.threshold;
  return true;
}

export default function Game004_LiarsCompass() {
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const npcCount = difficulty === "easy" ? 3 : difficulty === "hard" ? 6 : 4;
  const GRID = difficulty === "hard" ? 9 : 7;

  // BUG FIX: original seed was locked to (date, difficulty), so "New mystery"
  // never actually produced a new puzzle. A salt rerolls the seed on demand.
  const [salt, setSalt] = useState(0);
  const seed = useMemo(() => fnv(dayKey() + difficulty + ":" + salt), [difficulty, salt]);
  const rng = useMemo(() => mulberry32(seed), [seed]);
  const treasure = useMemo(() => {
    return { x: Math.floor(rng() * GRID), y: Math.floor(rng() * GRID) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, GRID]);
  const npcs = useMemo<{ name: string; pos: { x: number; y: number }; bias: Bias }[]>(() => {
    const r = rng;
    const honest = Math.floor(r() * npcCount);
    const list: { name: string; pos: { x: number; y: number }; bias: Bias }[] = [];
    for (let i = 0; i < npcCount; i++) {
      let bias: Bias;
      if (i === honest) bias = { kind: "alwaysTruth" };
      else {
        const t = Math.floor(r() * 5);
        if (t === 0) bias = { kind: "alwaysLies" };
        else if (t === 1) bias = { kind: "liesRounds", parity: r() < 0.5 ? 0 : 1 };
        else if (t === 2) bias = { kind: "liesAbout", dir: DIRS[Math.floor(r() * 8)].name };
        else if (t === 3) bias = { kind: "liesEveryN", n: 3 + Math.floor(r() * 3) };
        else bias = { kind: "liesIfFar", threshold: 3 + Math.floor(r() * 3) };
      }
      list.push({
        name: genName(r),
        pos: { x: Math.floor(r() * GRID), y: Math.floor(r() * GRID) },
        bias,
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, npcCount, GRID]);

  const [round, setRound] = useState(1);
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null);
  const [resolved, setResolved] = useState(false);
  const [warmer, setWarmer] = useState<number | null>(null);
  const [ruledOut, setRuledOut] = useState<Set<string>>(new Set());

  const rounds = useMemo(() => {
    const r2 = mulberry32(seed ^ 0xdeadbeef);
    const arr: { claims: string[] }[] = [];
    for (let R = 1; R <= 10; R++) {
      const claims: string[] = [];
      for (const npc of npcs) {
        const dx = treasure.x - npc.pos.x;
        const dy = treasure.y - npc.pos.y;
        const dist = Math.abs(dx) + Math.abs(dy);
        const ang = Math.atan2(dy, dx);
        const idx = (Math.round((ang / Math.PI) * 4) + 8) % 8;
        const truthDir = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"][idx];
        if (tellsTruth(npc.bias, R, truthDir, dist)) claims.push(truthDir);
        else {
          const others = DIRS.map((d) => d.name).filter((d) => d !== truthDir);
          claims.push(others[Math.floor(r2() * others.length)]);
        }
      }
      arr.push({ claims });
    }
    return arr;
  }, [npcs, treasure, seed]);

  const submit = () => {
    if (!guess) return;
    setResolved(true);
  };

  const checkWarmer = () => {
    if (!guess || resolved) return;
    const d = Math.abs(guess.x - treasure.x) + Math.abs(guess.y - treasure.y);
    setWarmer(d);
  };

  const distance = guess
    ? Math.abs(guess.x - treasure.x) + Math.abs(guess.y - treasure.y)
    : null;
  const maxDist = (GRID - 1) * 2;
  const score = distance !== null && resolved ? Math.max(0, 100 - Math.round((distance / maxDist) * 100)) : null;

  const toggleRuledOut = (x: number, y: number, ev: React.MouseEvent) => {
    if (resolved) return;
    if (ev.shiftKey || ev.button === 2) {
      const key = `${x},${y}`;
      setRuledOut((s) => {
        const ns = new Set(s);
        if (ns.has(key)) ns.delete(key);
        else ns.add(key);
        return ns;
      });
    } else {
      setGuess({ x, y });
      setWarmer(null);
    }
  };

  const reset = () => {
    setGuess(null);
    setRuledOut(new Set());
    setResolved(false);
    setRound(1);
    setWarmer(null);
    setSalt((s) => s + 1);
  };

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui", padding: 8, background: "#1a1a2a" }}>
      <h2 style={{ margin: "4px 0" }}>Liar's Compass</h2>
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        One NPC is honest. Use their biases + daily directions to pinpoint the treasure.
        Click a cell to guess. Shift+click (or right-click) to mark a cell as ruled-out.
      </div>
      <div style={{ margin: "6px 0", display: "flex", gap: 12, alignItems: "center" }}>
        <label style={{ fontSize: 13 }}>
          Difficulty:{" "}
          <select
            value={difficulty}
            onChange={(e) => {
              setDifficulty(e.target.value as typeof difficulty);
              reset();
            }}
          >
            <option value="easy">easy (3 NPCs, 7×7)</option>
            <option value="normal">normal (4 NPCs, 7×7)</option>
            <option value="hard">hard (6 NPCs, 9×9)</option>
          </select>
        </label>
        <button type="button" onClick={reset}>
          reset
        </button>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
        <div>
          <div style={{ marginBottom: 4 }}>
            Round{" "}
            <select value={round} onChange={(e) => setRound(Number(e.target.value))}>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>
          </div>
          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>NPC</th>
                <th style={th}>Bias</th>
                <th style={th}>Pos</th>
                <th style={th}>Claim</th>
              </tr>
            </thead>
            <tbody>
              {npcs.map((n, i) => (
                <tr key={n.name}>
                  <td style={td}>{n.name}</td>
                  <td style={td}>{biasText(n.bias)}</td>
                  <td style={td}>
                    ({n.pos.x},{n.pos.y})
                  </td>
                  <td style={{ ...td, fontWeight: 700, color: "#fc8" }}>{rounds[round - 1].claims[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div>Click a cell to guess. Shift-click to mark ruled-out.</div>
          <div
            onContextMenu={(e) => e.preventDefault()}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${GRID}, 40px)`,
              gap: 2,
              marginTop: 4,
            }}
          >
            {Array.from({ length: GRID * GRID }, (_, i) => {
              const x = i % GRID;
              const y = Math.floor(i / GRID);
              const isNpc = npcs.findIndex((n) => n.pos.x === x && n.pos.y === y);
              const isGuess = guess && guess.x === x && guess.y === y;
              const isTreasure = resolved && treasure.x === x && treasure.y === y;
              const isRuled = ruledOut.has(`${x},${y}`);
              return (
                <button
                  type="button"
                  key={i}
                  onClick={(e) => toggleRuledOut(x, y, e)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    toggleRuledOut(x, y, e);
                  }}
                  style={{
                    width: 40,
                    height: 40,
                    background: isTreasure
                      ? "#ffd766"
                      : isGuess
                        ? "#56b"
                        : isNpc >= 0
                          ? "#444"
                          : isRuled
                            ? "#502020"
                            : "#222",
                    color: "#fff",
                    border: "1px solid #333",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                  aria-label={`Cell ${x},${y}`}
                >
                  {isNpc >= 0 ? npcs[isNpc].name[0] : isTreasure ? "★" : isRuled ? "✕" : ""}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={checkWarmer} disabled={!guess || resolved}>
              Warmer/colder hint
            </button>{" "}
            <button type="button" onClick={submit} disabled={!guess || resolved} style={{ marginLeft: 4 }}>
              Lock in guess
            </button>
          </div>
          {warmer !== null && !resolved && (
            <div style={{ marginTop: 6, color: "#fc8" }}>
              That guess is {warmer === 0 ? "ON IT" : warmer <= 2 ? "hot" : warmer <= 4 ? "warm" : warmer <= 6 ? "cool" : "cold"} (Manhattan distance {warmer}).
            </div>
          )}
          {resolved && (
            <div style={{ marginTop: 8 }}>
              Treasure at ({treasure.x},{treasure.y}). Distance: {distance}. Score: <b>{score}</b>{" "}
              {distance === 0 ? "— Perfect!" : ""}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "2px 8px",
  borderBottom: "1px solid #444",
  textAlign: "left",
};
const td: React.CSSProperties = { padding: "2px 8px", borderBottom: "1px solid #2a2a3a" };
