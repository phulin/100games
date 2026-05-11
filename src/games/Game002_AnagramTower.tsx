import { useEffect, useMemo, useRef, useState } from "react";

// Anagram Tower: letters fall; type "english-like" sequences to dissolve them.
// Word validity is judged procedurally via an English bigram-frequency model
// (no fixed dictionary). Plausible letter sequences score; gibberish doesn't.

const COLS = 8;
const ROWS = 14;
const CELL = 38;

const FREQ: Record<string, number> = {
  A: 8, B: 2, C: 3, D: 4, E: 12, F: 2, G: 2, H: 4, I: 7, J: 1, K: 1, L: 4,
  M: 3, N: 7, O: 8, P: 2, Q: 1, R: 6, S: 6, T: 9, U: 3, V: 1, W: 2, X: 1, Y: 2, Z: 1,
};
const LETTER_SCORE: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1,
  M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
};

// English bigram log-likelihood table (compact; derived from letter+pair freq).
const COMMON_BIGRAMS: Record<string, number> = {
  TH: 5, HE: 5, IN: 5, ER: 5, AN: 5, RE: 5, ON: 5, AT: 5, EN: 5, ND: 5,
  TI: 5, ES: 5, OR: 5, TE: 5, OF: 4, ED: 5, IS: 5, IT: 5, AL: 4, AR: 5,
  ST: 5, TO: 5, NT: 5, NG: 5, SE: 4, HA: 4, AS: 4, OU: 4, IO: 4, LE: 4,
  VE: 4, CO: 4, ME: 4, DE: 4, HI: 4, RI: 4, RO: 4, IC: 4, NE: 4, EA: 4,
  RA: 4, CE: 4, LI: 4, CH: 4, LL: 4, BE: 4, MA: 4, SI: 4, OM: 4, UR: 4,
  CA: 4, EL: 4, TA: 4, LA: 4, NS: 3, DI: 4, LO: 3, DO: 4, NO: 3, EC: 3,
  PE: 3, PR: 3, NI: 3, MO: 3, AC: 3, SH: 3, PA: 3, TR: 3, GE: 3, SS: 3,
  IL: 3, MI: 3, FO: 3, US: 3, PO: 3, LY: 3, FI: 3, WI: 3, BO: 3, OL: 3,
  WA: 3, GR: 3, BL: 2, BR: 2, DR: 2, FL: 2, FR: 2, GL: 2, GH: 2, PL: 2,
  SL: 2, SP: 2, SW: 2, TW: 2, WH: 3, WR: 2, CK: 3, GN: 2, KN: 2, PH: 2,
  QU: 4, SC: 2, SK: 2, SM: 2, SN: 2, SQ: 2, EE: 3, OO: 3, AI: 3, OA: 3,
  OI: 2, EI: 2, AU: 2, AY: 3, EY: 2, OY: 2, OW: 3, EW: 2, AW: 2,
};

function bigramScore(word: string): number {
  if (word.length < 3) return 0;
  let total = 0;
  let pairs = 0;
  const w = word.toUpperCase();
  for (let i = 0; i < w.length - 1; i++) {
    const bg = w.slice(i, i + 2);
    total += COMMON_BIGRAMS[bg] ?? 0;
    pairs++;
  }
  const vowels = (w.match(/[AEIOUY]/g) || []).length;
  const ratio = vowels / w.length;
  let penalty = 0;
  if (ratio < 0.15) penalty += 1.5;
  if (/[BCDFGHJKLMNPQRSTVWXZ]{4,}/.test(w)) penalty += 2;
  if (/(.)\1\1/.test(w)) penalty += 2;
  return total / Math.max(1, pairs) - penalty;
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

function pickLetter(rng: () => number) {
  const total = Object.values(FREQ).reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (const [l, w] of Object.entries(FREQ)) {
    r -= w;
    if (r <= 0) return l;
  }
  return "E";
}

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
function beep(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.06) {
  const ctx = audio();
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime);
  g.gain.setValueAtTime(0, ctx.currentTime);
  g.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  o.connect(g);
  g.connect(ctx.destination);
  o.start();
  o.stop(ctx.currentTime + dur + 0.02);
}

export default function Game002_AnagramTower() {
  const [seed] = useState(() => Math.floor(Math.random() * 1e9));
  const rng = useMemo(() => mulberry32(seed), [seed]);
  const [board, setBoard] = useState<(string | null)[][]>(() =>
    Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null)),
  );
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [nextLetter, setNextLetter] = useState<string>(() => pickLetter(rng));
  const [gameOver, setGameOver] = useState(false);
  const [msg, setMsg] = useState("");
  const [flash, setFlash] = useState<"good" | "bad" | null>(null);
  const tickRef = useRef(0);
  const boardRef = useRef(board);
  boardRef.current = board;
  const startTimeRef = useRef(performance.now());

  const baseInterval = 350;
  const nextLetterRef = useRef(nextLetter);
  nextLetterRef.current = nextLetter;

  // BUG FIX: original computed `elapsed` and `interval` during render and put
  // both in the effect deps, so the spawn setInterval was torn down + rebuilt
  // on every render — the tick rarely fired predictably. Use chained setTimeout
  // with refs so the loop owns its timing.
  useEffect(() => {
    if (gameOver) return;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      tickRef.current++;
      const elapsedNow = (performance.now() - startTimeRef.current) / 1000;
      const spawnEvery = Math.max(2, 3 - Math.floor(elapsedNow / 30));
      setBoard((b) => {
        const nb = b.map((r) => r.slice());
        for (let y = ROWS - 2; y >= 0; y--) {
          for (let x = 0; x < COLS; x++) {
            if (nb[y][x] && !nb[y + 1][x]) {
              nb[y + 1][x] = nb[y][x];
              nb[y][x] = null;
            }
          }
        }
        if (tickRef.current % spawnEvery === 0) {
          const col = Math.floor(rng() * COLS);
          if (nb[0][col]) {
            setGameOver(true);
            beep(160, 0.4, "sawtooth", 0.15);
            setTimeout(() => beep(90, 0.5, "sawtooth", 0.15), 150);
          } else {
            nb[0][col] = nextLetterRef.current;
            setNextLetter(pickLetter(rng));
            beep(440 + Math.random() * 60, 0.04, "triangle", 0.03);
          }
        }
        return nb;
      });
      const elapsed2 = (performance.now() - startTimeRef.current) / 1000;
      const nextInterval = Math.max(150, baseInterval - Math.floor(elapsed2 / 8) * 20);
      id = setTimeout(tick, nextInterval);
    };
    id = setTimeout(tick, baseInterval);
    return () => clearTimeout(id);
  }, [gameOver, rng]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gameOver) {
        if (e.key === "Enter" || e.key === "r" || e.key === "R") reset();
        return;
      }
      if (e.key === "Backspace") {
        setInput((s) => s.slice(0, -1));
      } else if (e.key === "Escape") {
        setInput("");
      } else if (e.key === "Enter") {
        submit();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        setInput((s) => (s + e.key).toUpperCase().slice(0, 12));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // BUG FIX: include combo so submit() doesn't multiply by a stale combo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver, input, combo]);

  const flashFor = (kind: "good" | "bad") => {
    setFlash(kind);
    setTimeout(() => setFlash(null), 200);
  };

  const submit = () => {
    const word = input.toUpperCase();
    if (word.length < 3) {
      setMsg("too short (min 3)");
      setCombo(0);
      setInput("");
      flashFor("bad");
      beep(180, 0.1, "square", 0.05);
      return;
    }
    const plaus = bigramScore(word);
    if (plaus < 2.0) {
      setMsg(`'${word}' doesn't look like a word (${plaus.toFixed(1)})`);
      setCombo(0);
      setInput("");
      flashFor("bad");
      beep(180, 0.1, "square", 0.05);
      return;
    }
    const b = boardRef.current.map((r) => r.slice());
    const used: [number, number][] = [];
    let ok = true;
    for (const ch of word) {
      let found = false;
      for (let y = ROWS - 1; y >= 0 && !found; y--) {
        for (let x = 0; x < COLS && !found; x++) {
          if (b[y][x] === ch && !used.some(([uy, ux]) => uy === y && ux === x)) {
            used.push([y, x]);
            found = true;
          }
        }
      }
      if (!found) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      setMsg("letters not on board");
      setCombo(0);
      setInput("");
      flashFor("bad");
      beep(180, 0.1, "square", 0.05);
      return;
    }
    let gained = 0;
    for (const [y, x] of used) {
      gained += LETTER_SCORE[b[y][x] as string] || 1;
      b[y][x] = null;
    }
    const lengthMult = word.length >= 7 ? 4 : word.length >= 6 ? 3 : word.length >= 5 ? 2 : 1;
    const plausMult = 1 + Math.max(0, (plaus - 2) * 0.25);
    const newCombo = combo + 1;
    const comboMult = 1 + (newCombo - 1) * 0.15;
    gained = Math.round(gained * lengthMult * plausMult * comboMult);
    setScore((s) => s + gained);
    setCombo(newCombo);
    setMsg(`+${gained} (${word}) ×${comboMult.toFixed(2)} combo`);
    setInput("");
    setBoard(b);
    flashFor("good");
    beep(660, 0.08, "triangle", 0.07);
    setTimeout(() => beep(880, 0.08, "triangle", 0.07), 60);
    if (word.length >= 5) setTimeout(() => beep(1320, 0.1, "triangle", 0.07), 120);
  };

  const reset = () => {
    setBoard(Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null)));
    setInput("");
    setScore(0);
    setCombo(0);
    setMsg("");
    setGameOver(false);
    tickRef.current = 0;
    startTimeRef.current = performance.now();
  };

  let highest = ROWS;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) {
        highest = Math.min(highest, y);
      }
    }
  }
  const dangerPct = Math.max(0, Math.min(1, (ROWS - highest) / ROWS));

  return (
    <div
      style={{
        color: "#eee",
        fontFamily: "system-ui",
        padding: 8,
        background: flash === "good" ? "#0a3" : flash === "bad" ? "#a31515" : "transparent",
        transition: "background 0.15s",
      }}
    >
      <h2 style={{ margin: "4px 0" }}>Anagram Tower</h2>
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        Type any plausible word using letters on the board; Enter to submit. Longer & english-y words score more. Backspace edits, Esc clears, R restarts after game over.
      </div>
      <div style={{ margin: "6px 0" }}>
        Score: <b>{score}</b> | combo: <b>×{combo}</b> | typing:{" "}
        <b style={{ color: "#fc8" }}>{input || "—"}</b> | next:{" "}
        <b style={{ color: "#8cf" }}>{nextLetter}</b> | {msg}
        {gameOver && (
          <>
            {" — game over. "}
            <button type="button" onClick={reset}>
              again
            </button>
          </>
        )}
      </div>
      <div
        style={{
          height: 4,
          width: COLS * (CELL + 2),
          background: "#222",
          marginBottom: 4,
          borderRadius: 2,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${dangerPct * 100}%`,
            background:
              dangerPct > 0.75 ? "#e44" : dangerPct > 0.5 ? "#ea4" : "#4e4",
            borderRadius: 2,
            transition: "width 0.2s, background 0.2s",
          }}
        />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
          gridAutoRows: `${CELL}px`,
          gap: 2,
          background: "#222",
          padding: 4,
          width: "max-content",
        }}
      >
        {board.flatMap((row, y) =>
          row.map((c, x) => (
            <div
              key={`${y}-${x}`}
              style={{
                background: c ? "#3a4d6b" : "#111",
                color: c ? "#fff" : "transparent",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 20,
                borderRadius: 4,
                transition: "background 0.15s",
              }}
            >
              {c}
            </div>
          )),
        )}
      </div>
    </div>
  );
}
