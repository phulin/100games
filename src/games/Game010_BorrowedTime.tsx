import { useEffect, useRef, useState } from "react";

// Borrowed Time: small platformer-puzzle campaign. Each level has a tight time budget;
// you may borrow time from any future level. Finish without unpaid debt.

const W = 720;
const H = 380;
const GRAVITY = 1600;
const MOVE = 240;
const JUMP = -540;

type Platform = { x: number; y: number; w: number; h: number };
type Level = {
  budget: number;
  start: { x: number; y: number };
  goal: { x: number; y: number; w: number; h: number };
  platforms: Platform[];
};

const LEVELS: Level[] = [
  {
    budget: 8,
    start: { x: 30, y: 320 },
    goal: { x: 660, y: 300, w: 30, h: 40 },
    platforms: [
      { x: 0, y: 360, w: 720, h: 20 },
      { x: 200, y: 280, w: 80, h: 16 },
      { x: 360, y: 230, w: 80, h: 16 },
      { x: 520, y: 280, w: 80, h: 16 },
    ],
  },
  {
    budget: 7,
    start: { x: 30, y: 320 },
    goal: { x: 660, y: 60, w: 30, h: 40 },
    platforms: [
      { x: 0, y: 360, w: 250, h: 20 },
      { x: 320, y: 360, w: 400, h: 20 },
      { x: 160, y: 270, w: 60, h: 14 },
      { x: 280, y: 200, w: 60, h: 14 },
      { x: 420, y: 150, w: 60, h: 14 },
      { x: 560, y: 100, w: 140, h: 14 },
    ],
  },
  {
    budget: 6,
    start: { x: 30, y: 320 },
    goal: { x: 30, y: 60, w: 30, h: 40 },
    platforms: [
      { x: 0, y: 360, w: 720, h: 20 },
      { x: 600, y: 290, w: 100, h: 14 },
      { x: 460, y: 230, w: 100, h: 14 },
      { x: 320, y: 180, w: 100, h: 14 },
      { x: 180, y: 130, w: 100, h: 14 },
      { x: 20, y: 100, w: 120, h: 14 },
    ],
  },
  {
    budget: 10,
    start: { x: 30, y: 320 },
    goal: { x: 660, y: 60, w: 30, h: 40 },
    platforms: [
      { x: 0, y: 360, w: 720, h: 20 },
      { x: 120, y: 290, w: 60, h: 14 },
      { x: 230, y: 240, w: 60, h: 14 },
      { x: 340, y: 190, w: 60, h: 14 },
      { x: 450, y: 140, w: 60, h: 14 },
      { x: 560, y: 100, w: 160, h: 14 },
    ],
  },
];

export default function Game010_BorrowedTime() {
  const [levelIdx, setLevelIdx] = useState(0);
  const [budgets, setBudgets] = useState(LEVELS.map((l) => l.budget));
  const [debt, setDebt] = useState(0); // borrowed but not paid; only future-level borrowing allowed
  const [borrowAmt, setBorrowAmt] = useState(0); // how much taken FROM future for this level
  const [borrowFrom, setBorrowFrom] = useState(1);
  const [status, setStatus] = useState<"play" | "win" | "loseTime" | "fell" | "done">("play");
  const playerRef = useRef({ x: 0, y: 0, vx: 0, vy: 0, onGround: false });
  const keysRef = useRef<Record<string, boolean>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const [, setTick] = useState(0);

  const level = LEVELS[levelIdx];
  const effectiveBudget = budgets[levelIdx] + borrowAmt;

  useEffect(() => {
    const p = playerRef.current;
    p.x = level.start.x;
    p.y = level.start.y;
    p.vx = 0;
    p.vy = 0;
    timeRef.current = 0;
    setStatus("play");
    // Point borrow selector at first valid future level so the <select> isn't stale.
    const firstFuture = LEVELS.findIndex((_, i) => i > levelIdx);
    if (firstFuture !== -1) setBorrowFrom(firstFuture);
  }, [levelIdx]);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = true;
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", dn);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      if (status === "play") {
        timeRef.current += dt;
        const p = playerRef.current;
        const k = keysRef.current;
        const ax = (k.arrowright || k.d ? 1 : 0) - (k.arrowleft || k.a ? 1 : 0);
        p.vx = ax * MOVE;
        if ((k.arrowup || k.w || k[" "]) && p.onGround) {
          p.vy = JUMP;
          p.onGround = false;
        }
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.onGround = false;
        // collide platforms (simple)
        for (const pl of level.platforms) {
          if (p.x + 8 > pl.x && p.x - 8 < pl.x + pl.w) {
            // landing from above
            if (p.y + 12 > pl.y && p.y + 12 < pl.y + pl.h + 12 && p.vy >= 0) {
              p.y = pl.y - 12;
              p.vy = 0;
              p.onGround = true;
            }
          }
        }
        if (p.x < 8) p.x = 8;
        if (p.x > W - 8) p.x = W - 8;
        if (p.y > H + 40) setStatus("fell");
        // goal
        const g = level.goal;
        if (p.x > g.x && p.x < g.x + g.w && p.y > g.y - 12 && p.y < g.y + g.h) {
          setStatus("win");
        }
        if (timeRef.current > effectiveBudget) setStatus("loseTime");
      }
      // draw
      const cv = canvasRef.current;
      if (cv) {
        const ctx = cv.getContext("2d")!;
        ctx.fillStyle = "#0e1419";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#2c3a4a";
        for (const pl of level.platforms) ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        ctx.fillStyle = "#7e6";
        ctx.fillRect(level.goal.x, level.goal.y, level.goal.w, level.goal.h);
        const p = playerRef.current;
        ctx.fillStyle = "#fa6";
        ctx.fillRect(p.x - 8, p.y - 12, 16, 24);
        // time bar
        const frac = Math.min(1, timeRef.current / effectiveBudget);
        ctx.fillStyle = "#234";
        ctx.fillRect(10, 10, 200, 10);
        ctx.fillStyle = frac > 0.8 ? "#f55" : "#5cf";
        ctx.fillRect(10, 10, 200 * (1 - frac), 10);
      }
      setTick((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [level, effectiveBudget, status]);

  const borrow = () => {
    if (borrowFrom <= levelIdx) return;
    if (borrowFrom >= LEVELS.length) return;
    const take = 1;
    if (budgets[borrowFrom] - take < 2) return;
    const nb = [...budgets];
    nb[borrowFrom] -= take;
    setBudgets(nb);
    setBorrowAmt((b) => b + take);
    setDebt((d) => d + take);
  };

  const next = () => {
    if (levelIdx + 1 >= LEVELS.length) {
      setStatus("done");
    } else {
      setBorrowAmt(0);
      setLevelIdx(levelIdx + 1);
    }
  };

  const retry = () => {
    // Refund borrowed seconds back to source level so retry doesn't permanently
    // consume budget the player can no longer access.
    if (borrowAmt > 0) {
      const nb = [...budgets];
      nb[borrowFrom] += borrowAmt;
      setBudgets(nb);
      setDebt((d) => Math.max(0, d - borrowAmt));
      setBorrowAmt(0);
    }
    setStatus("play");
    const p = playerRef.current;
    p.x = level.start.x;
    p.y = level.start.y;
    p.vx = 0;
    p.vy = 0;
    timeRef.current = 0;
  };

  const reset = () => {
    setLevelIdx(0);
    setBudgets(LEVELS.map((l) => l.budget));
    setDebt(0);
    setBorrowAmt(0);
    setStatus("play");
  };

  return (
    <div style={{ color: "#dde", fontFamily: "system-ui", padding: 8 }}>
      <h2 style={{ margin: "4px 0" }}>Borrowed Time</h2>
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        Arrows/WASD to move, Up/Space to jump. Reach the green tile before time runs out. Borrow seconds from future levels; carry debt to the finale and you lose.
      </div>
      <div style={{ margin: "6px 0", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span>
          Level {levelIdx + 1}/{LEVELS.length}
        </span>
        <span>
          Time: {timeRef.current.toFixed(2)}s / {effectiveBudget}s
        </span>
        <span>Total debt: {debt}</span>
        <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
          Borrow 1s from level:
          <select value={borrowFrom} onChange={(e) => setBorrowFrom(Number(e.target.value))}>
            {LEVELS.map((_, i) =>
              i > levelIdx ? (
                <option key={i} value={i}>
                  L{i + 1} ({budgets[i]}s)
                </option>
              ) : null,
            )}
          </select>
          <button type="button" onClick={borrow} disabled={status !== "play"}>
            Borrow
          </button>
        </span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} style={{ background: "#111", border: "1px solid #234" }} />
      <div style={{ marginTop: 8 }}>
        {status === "win" && (
          <>
            Cleared! <button type="button" onClick={next}>Next</button>
          </>
        )}
        {status === "loseTime" && (
          <>
            Time ran out. <button type="button" onClick={retry}>Retry</button>
          </>
        )}
        {status === "fell" && (
          <>
            Fell. <button type="button" onClick={retry}>Retry</button>
          </>
        )}
        {status === "done" && (
          <>
            Campaign complete. Final debt: <b>{debt}</b>.{" "}
            {debt > 0 ? "You lose — debt unpaid." : "You win — clean ledger!"}{" "}
            <button type="button" onClick={reset}>Play again</button>
          </>
        )}
      </div>
    </div>
  );
}
