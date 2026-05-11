import { useEffect, useRef, useState } from "react";

// Frostline: skate across freezing river. Ice thickens over time; thin spots break.

const W = 900;
const H = 480;
const GRID_W = 60;
const GRID_H = 32;
const CELL_W = W / GRID_W;
const CELL_H = H / GRID_H;

type Cell = { thickness: number; isLand: boolean; isObstacle: boolean };

function genRiver(): Cell[][] {
  const c: Cell[][] = [];
  for (let y = 0; y < GRID_H; y++) {
    const row: Cell[] = [];
    for (let x = 0; x < GRID_W; x++) {
      // banks on top/bottom
      const isLand = y < 2 || y >= GRID_H - 2;
      // Safe baseline thickness; thin hazards are carved below.
      const t = isLand ? 1 : 0.25 + Math.random() * 0.45;
      row.push({ thickness: t, isLand, isObstacle: false });
    }
    c.push(row);
  }
  // islands
  for (let i = 0; i < 5; i++) {
    const ix = 8 + Math.floor(Math.random() * (GRID_W - 16));
    const iy = 5 + Math.floor(Math.random() * (GRID_H - 10));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) + Math.abs(dy) <= 2) {
          const nx = ix + dx,
            ny = iy + dy;
          if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) c[ny][nx].isObstacle = true;
        }
      }
    }
  }
  // Carve thin-ice hazard patches.
  for (let i = 0; i < 14; i++) {
    const tx = 4 + Math.floor(Math.random() * (GRID_W - 8));
    const ty = 3 + Math.floor(Math.random() * (GRID_H - 6));
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = tx + dx,
          ny = ty + dy;
        if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
          const cell = c[ny][nx];
          if (!cell.isLand && !cell.isObstacle) cell.thickness = Math.random() * 0.16;
        }
      }
    }
  }
  return c;
}

export default function Game009_Frostline() {
  const [grid] = useState<Cell[][]>(() => genRiver());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef({ x: 20, y: H / 2, vx: 0, vy: 0 });
  const stateRef = useRef({ done: false, won: false, message: "" });
  const [, force] = useState(0);
  const keysRef = useRef<Record<string, boolean>>({});

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
    let elapsed = 0;
    const trail: { x: number; y: number }[] = [];
    const loop = (t: number) => {
      const dt = (t - last) / 1000;
      last = t;
      if (!stateRef.current.done) {
        elapsed += dt;
        // freeze process: thickness grows over time
        for (let y = 2; y < GRID_H - 2; y++) {
          for (let x = 0; x < GRID_W; x++) {
            const c = grid[y][x];
            if (!c.isLand && !c.isObstacle) {
              c.thickness = Math.min(1, c.thickness + dt * 0.018);
            }
          }
        }
        // player input
        const p = playerRef.current;
        const k = keysRef.current;
        const ax =
          (k.arrowright || k.d ? 1 : 0) - (k.arrowleft || k.a ? 1 : 0);
        const ay = (k.arrowdown || k.s ? 1 : 0) - (k.arrowup || k.w ? 1 : 0);
        const accel = 600;
        p.vx += ax * accel * dt;
        p.vy += ay * accel * dt;
        // friction
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.x < 0) p.x = 0;
        if (p.x > W) p.x = W;
        if (p.y < 0) p.y = 0;
        if (p.y > H) p.y = H;
        trail.push({ x: p.x, y: p.y });
        if (trail.length > 200) trail.shift();
        // check current cell (clamp index so right-edge win still fires)
        const gx = Math.max(0, Math.min(GRID_W - 1, Math.floor(p.x / CELL_W)));
        const gy = Math.max(0, Math.min(GRID_H - 1, Math.floor(p.y / CELL_H)));
        const c = grid[gy][gx];
        if (c.isObstacle) {
          stateRef.current.done = true;
          stateRef.current.message = "Crashed into obstacle.";
        } else if (!c.isLand && c.thickness < 0.18) {
          stateRef.current.done = true;
          stateRef.current.message = "Fell through thin ice!";
        }
        if (p.x >= W - 8) {
          stateRef.current.done = true;
          stateRef.current.won = true;
          stateRef.current.message = `Made it across in ${elapsed.toFixed(1)}s.`;
        }
      }
      // draw
      const cv = canvasRef.current;
      if (cv) {
        const ctx = cv.getContext("2d")!;
        ctx.fillStyle = "#0a1a2a";
        ctx.fillRect(0, 0, W, H);
        for (let y = 0; y < GRID_H; y++) {
          for (let x = 0; x < GRID_W; x++) {
            const c = grid[y][x];
            if (c.isLand) ctx.fillStyle = "#3a2b1e";
            else if (c.isObstacle) ctx.fillStyle = "#222";
            else {
              const th = c.thickness;
              if (th < 0.18)
                ctx.fillStyle = `rgba(40,80,140,${0.7 + th})`; // open water
              else {
                const v = Math.min(1, th);
                ctx.fillStyle = `rgb(${180 + v * 60}, ${210 + v * 40}, ${230 + v * 25})`;
              }
            }
            ctx.fillRect(x * CELL_W, y * CELL_H, CELL_W + 1, CELL_H + 1);
          }
        }
        // goal line
        ctx.fillStyle = "rgba(120,255,150,0.4)";
        ctx.fillRect(W - 12, 0, 12, H);
        // trail
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath();
        for (let i = 0; i < trail.length; i++) {
          const t = trail[i];
          if (i === 0) ctx.moveTo(t.x, t.y);
          else ctx.lineTo(t.x, t.y);
        }
        ctx.stroke();
        const p = playerRef.current;
        ctx.fillStyle = "#f33";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      force((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [grid]);

  const reset = () => {
    // re-randomize: safe baseline + sparse thin-ice hazards (mirrors initial gen)
    for (let y = 2; y < GRID_H - 2; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const c = grid[y][x];
        if (!c.isObstacle && !c.isLand) c.thickness = 0.25 + Math.random() * 0.45;
      }
    }
    for (let i = 0; i < 14; i++) {
      const tx = 4 + Math.floor(Math.random() * (GRID_W - 8));
      const ty = 3 + Math.floor(Math.random() * (GRID_H - 6));
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = tx + dx,
            ny = ty + dy;
          if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H) {
            const cell = grid[ny][nx];
            if (!cell.isLand && !cell.isObstacle) cell.thickness = Math.random() * 0.16;
          }
        }
      }
    }
    playerRef.current = { x: 20, y: H / 2, vx: 0, vy: 0 };
    stateRef.current = { done: false, won: false, message: "" };
  };

  return (
    <div style={{ color: "#cef", fontFamily: "system-ui", padding: 8 }}>
      <h2 style={{ margin: "4px 0" }}>Frostline</h2>
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        Arrows/WASD to skate. Ice thickens over time. Avoid thin (dark) patches and obstacles. Reach the right side.
      </div>
      <div style={{ marginTop: 6 }}>
        {stateRef.current.done && (
          <span>
            {stateRef.current.message}{" "}
            <button type="button" onClick={reset}>
              try again
            </button>
          </span>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ display: "block", marginTop: 6, border: "1px solid #234" }}
      />
    </div>
  );
}
