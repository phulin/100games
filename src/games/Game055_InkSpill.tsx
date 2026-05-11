import { useCallback, useEffect, useState } from "react";

// Game 55: Ink Spill
// Click cells to spill ink. Ink spreads to neighbors but stops at walls. Fill the target % to win.

const COLS = 18;
const ROWS = 12;
const CELL = 40;

type Cell = { wall: boolean; ink: number };

function genBoard(level: number): Cell[][] {
	const b: Cell[][] = [];
	for (let y = 0; y < ROWS; y++) {
		const row: Cell[] = [];
		for (let x = 0; x < COLS; x++) {
			row.push({ wall: Math.random() < 0.18 + level * 0.02, ink: 0 });
		}
		b.push(row);
	}
	return b;
}

export default function InkSpill() {
	const [level, setLevel] = useState(1);
	const [board, setBoard] = useState<Cell[][]>(() => genBoard(1));
	const [spills, setSpills] = useState(5);
	const [score, setScore] = useState(0);
	const [msg, setMsg] = useState("");

	const target = 0.55;

	const fillPct = useCallback(() => {
		let inked = 0;
		let total = 0;
		for (const row of board) for (const c of row) {
			if (!c.wall) {
				total++;
				if (c.ink > 0) inked++;
			}
		}
		return total ? inked / total : 0;
	}, [board]);

	function spillAt(sx: number, sy: number) {
		if (spills <= 0) return;
		if (board[sy][sx].wall) return;
		// BFS flood with diminishing range
		const range = 5;
		const next = board.map((r) => r.map((c) => ({ ...c })));
		const queue: { x: number; y: number; d: number }[] = [{ x: sx, y: sy, d: 0 }];
		const visited = new Set<string>();
		while (queue.length) {
			const { x, y, d } = queue.shift()!;
			const k = `${x},${y}`;
			if (visited.has(k)) continue;
			visited.add(k);
			if (d > range) continue;
			next[y][x].ink = Math.max(next[y][x].ink, 1 - d / (range + 1));
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1],
			]) {
				const nx = x + dx;
				const ny = y + dy;
				if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
				if (next[ny][nx].wall) continue;
				queue.push({ x: nx, y: ny, d: d + 1 });
			}
		}
		setBoard(next);
		setSpills((s) => s - 1);
	}

	useEffect(() => {
		const pct = fillPct();
		if (pct >= target) {
			setScore((s) => s + Math.round(spills * 10 + level * 20));
			setMsg(`Level ${level} clear! +${spills * 10 + level * 20}`);
		} else if (spills === 0) {
			setMsg("Out of spills. Click 'Next' to retry.");
		}
	}, [board, spills, fillPct, level]);

	function next() {
		const lv = fillPct() >= target ? level + 1 : level;
		setLevel(lv);
		setBoard(genBoard(lv));
		setSpills(5);
		setMsg("");
	}

	const pct = fillPct();
	return (
		<div style={{ background: "#f3eee3", color: "#222", padding: 16, fontFamily: "Georgia, serif" }}>
			<h2 style={{ margin: 0 }}>Ink Spill</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Click empty cells to spill ink. Ink spreads through open spaces but stops at walls. Fill {(target * 100) | 0}% to clear the level.
			</div>
			<div style={{ display: "flex", gap: 14, marginTop: 6, alignItems: "center" }}>
				<div>Level: {level}</div>
				<div>Spills left: {spills}</div>
				<div>Filled: {(pct * 100).toFixed(0)}%</div>
				<div>Score: {score}</div>
				<button type="button" onClick={next} style={{ background: "#2b2b2b", color: "#fff", border: 0, padding: "4px 12px", borderRadius: 4 }}>
					{pct >= target ? "Next Level" : "Reset Level"}
				</button>
				<div style={{ color: "#7a3a8a" }}>{msg}</div>
			</div>
			<svg width={COLS * CELL} height={ROWS * CELL} style={{ marginTop: 10, background: "#fff", boxShadow: "0 2px 16px #0002" }}>
				{board.map((row, y) =>
					row.map((c, x) => {
						const cx = x * CELL;
						const cy = y * CELL;
						return (
							<g key={`${x},${y}`} onClick={() => spillAt(x, y)} style={{ cursor: c.wall ? "default" : "pointer" }}>
								<rect x={cx} y={cy} width={CELL} height={CELL} fill={c.wall ? "#3d2f24" : "#f7f2e8"} stroke="#e0d4bf" />
								{c.ink > 0 && (
									<circle cx={cx + CELL / 2} cy={cy + CELL / 2} r={CELL * 0.45 * c.ink} fill="#1a1226" opacity={0.85} />
								)}
							</g>
						);
					}),
				)}
			</svg>
		</div>
	);
}
