import { useMemo, useState } from "react";

// Liar's Compass: 4 NPCs point a direction; exactly one is honest. 10 rounds.
// Each NPC has a public bias.

const GRID = 7;
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

// Seed by day (daily puzzle)
function dayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1000000) / 1000000;
  };
}

type Bias =
  | { kind: "alwaysLies" }
  | { kind: "alwaysTruth" }
  | { kind: "liesRounds"; parity: 0 | 1 }
  | { kind: "liesAbout"; dir: string };

const NAMES = ["Aria", "Bram", "Cora", "Dane"];

function biasText(b: Bias): string {
  if (b.kind === "alwaysLies") return "always lies";
  if (b.kind === "alwaysTruth") return "always tells the truth";
  if (b.kind === "liesRounds") return `lies on ${b.parity === 0 ? "even" : "odd"} rounds`;
  return `lies whenever the truth is ${b.dir}`;
}

function tellsTruth(b: Bias, round: number, truth: string): boolean {
  if (b.kind === "alwaysLies") return false;
  if (b.kind === "alwaysTruth") return true;
  if (b.kind === "liesRounds") return round % 2 !== b.parity;
  return truth !== b.dir;
}

export default function Game004_LiarsCompass() {
  const rng = useMemo(() => seeded(dayKey()), []);
  const treasure = useMemo(() => {
    return { x: Math.floor(rng() * GRID), y: Math.floor(rng() * GRID) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const npcs = useMemo<{ name: string; pos: { x: number; y: number }; bias: Bias }[]>(() => {
    const r = rng;
    // pick honest npc
    const honest = Math.floor(r() * 4);
    const list = NAMES.map((n, i) => {
      let bias: Bias;
      if (i === honest) bias = { kind: "alwaysTruth" };
      else {
        const t = Math.floor(r() * 3);
        if (t === 0) bias = { kind: "alwaysLies" };
        else if (t === 1) bias = { kind: "liesRounds", parity: Math.random() < 0.5 ? 0 : 1 };
        else bias = { kind: "liesAbout", dir: DIRS[Math.floor(r() * 8)].name };
      }
      return {
        name: n,
        pos: { x: Math.floor(r() * GRID), y: Math.floor(r() * GRID) },
        bias,
      };
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [round, setRound] = useState(1);
  const [guess, setGuess] = useState<{ x: number; y: number } | null>(null);
  const [resolved, setResolved] = useState(false);

  const rounds = useMemo(() => {
    // For each round, each NPC claims a direction toward treasure (from their position).
    // Compute true direction (nearest of 8), then alter if lying.
    const r2 = seeded(dayKey() + "rounds");
    const arr: { claims: string[] }[] = [];
    for (let R = 1; R <= 10; R++) {
      const claims: string[] = [];
      for (const npc of npcs) {
        const dx = treasure.x - npc.pos.x;
        const dy = treasure.y - npc.pos.y;
        const ang = Math.atan2(dy, dx);
        // map to 8 dirs
        const idx = ((Math.round((ang / Math.PI) * 4) + 8) % 8);
        const truthDir = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"][idx];
        if (tellsTruth(npc.bias, R, truthDir)) claims.push(truthDir);
        else {
          // pick a random wrong dir
          const others = DIRS.map((d) => d.name).filter((d) => d !== truthDir);
          claims.push(others[Math.floor(r2() * others.length)]);
        }
      }
      arr.push({ claims });
    }
    return arr;
  }, [npcs, treasure]);

  const submit = () => {
    if (!guess) return;
    setResolved(true);
  };

  const distance = guess
    ? Math.abs(guess.x - treasure.x) + Math.abs(guess.y - treasure.y)
    : null;

  return (
    <div style={{ color: "#eee", fontFamily: "system-ui", padding: 8, background: "#1a1a2a" }}>
      <h2 style={{ margin: "4px 0" }}>Liar's Compass</h2>
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        One NPC is honest. Use bias info + their daily directions to pinpoint the treasure cell.
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
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
                  <td style={td}>{rounds[round - 1].claims[i]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div>Click a cell to guess:</div>
          <div
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
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => !resolved && setGuess({ x, y })}
                  style={{
                    width: 40,
                    height: 40,
                    background: isTreasure
                      ? "#ffd766"
                      : isGuess
                        ? "#56b"
                        : isNpc >= 0
                          ? "#444"
                          : "#222",
                    color: "#fff",
                    border: "1px solid #333",
                    fontSize: 12,
                  }}
                >
                  {isNpc >= 0 ? NAMES[isNpc][0] : isTreasure ? "★" : ""}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={!guess || resolved}
            style={{ marginTop: 8 }}
          >
            Lock in guess
          </button>
          {resolved && (
            <div style={{ marginTop: 8 }}>
              Treasure at ({treasure.x},{treasure.y}). Distance: {distance}.{" "}
              {distance === 0 ? "Perfect!" : ""}
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
