import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Game 55: Ink Spill
// Click cells to spill ink. Ink spreads to neighbors but stops at walls. Fill target % to win.
// Improvements:
//   1. Seeded mulberry32 RNG for walls (daily seed) — same puzzle for all players today
//   2. Multiple ink colors that mix on overlap (each spill is a different hue)
//   3. Undo last spill (Z) and persistent best score
//   4. WebAudio plip on spill (pitch by fill ratio gained) + win chord
//   5. Hint dot showing best estimated splash center each round

const COLS = 18;
const ROWS = 12;
const CELL = 40;

type Cell = { wall: boolean; ink: number; hue: number };

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function todayUTCSeed(): number {
	const d = new Date();
	return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function genBoard(level: number, seedNum: number): Cell[][] {
	const rng = mulberry32((seedNum ^ (level * 0x9e3779b1)) >>> 0);
	const b: Cell[][] = [];
	for (let y = 0; y < ROWS; y++) {
		const row: Cell[] = [];
		for (let x = 0; x < COLS; x++) {
			row.push({ wall: rng() < 0.18 + level * 0.02, ink: 0, hue: 0 });
		}
		b.push(row);
	}
	if (b.every((r) => r.every((c) => c.wall))) b[0][0].wall = false;
	return b;
}

const HUES = [260, 20, 130, 200, 320, 50];

export default function InkSpill() {
	const [seed, setSeed] = useState<number>(() => todayUTCSeed());
	const [level, setLevel] = useState(1);
	const [board, setBoard] = useState<Cell[][]>(() => genBoard(1, seed));
	const [history, setHistory] = useState<Cell[][][]>([]);
	const [spills, setSpills] = useState(5);
	const [score, setScore] = useState(0);
	const [msg, setMsg] = useState("");
	const [best, setBest] = useState(() => parseInt(localStorage.getItem("g55_best") || "0", 10));
	const audioRef = useRef<AudioContext | null>(null);

	const target = 0.55;
	const range = 5;

	function ensureAudio() {
		if (!audioRef.current) {
			try {
				audioRef.current = new (window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
			} catch {
				/* ignore */
			}
		}
	}
	function blip(freq: number, dur = 0.15, vol = 0.16) {
		const ac = audioRef.current;
		if (!ac) return;
		const o = ac.createOscillator();
		const g = ac.createGain();
		o.type = "sine";
		o.frequency.value = freq;
		o.connect(g);
		g.connect(ac.destination);
		g.gain.setValueAtTime(0.0001, ac.currentTime);
		g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
		o.start();
		o.stop(ac.currentTime + dur + 0.05);
	}
	function winChord() {
		[392, 494, 587, 784].forEach((f, i) => setTimeout(() => blip(f, 0.3, 0.12), i * 80));
	}

	const fillPct = useCallback(() => {
		let inked = 0;
		let total = 0;
		for (const row of board) {
			for (const c of row) {
				if (!c.wall) {
					total++;
					if (c.ink > 0) inked++;
				}
			}
		}
		return total ? inked / total : 0;
	}, [board]);

	const hint = useMemo(() => {
		let bestXY = { x: 0, y: 0, reach: 0 };
		for (let y = 0; y < ROWS; y += 2) {
			for (let x = 0; x < COLS; x += 2) {
				if (board[y][x].wall || board[y][x].ink > 0.5) continue;
				let reach = 0;
				const seen = new Set<string>();
				const queue: { x: number; y: number; d: number }[] = [{ x, y, d: 0 }];
				while (queue.length) {
					const cur = queue.shift();
					if (!cur) break;
					const k = `${cur.x},${cur.y}`;
					if (seen.has(k)) continue;
					seen.add(k);
					if (cur.d > range) continue;
					if (board[cur.y][cur.x].ink === 0) reach++;
					for (const [dx, dy] of [
						[1, 0],
						[-1, 0],
						[0, 1],
						[0, -1],
					]) {
						const nx = cur.x + dx;
						const ny = cur.y + dy;
						if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
						if (board[ny][nx].wall) continue;
						queue.push({ x: nx, y: ny, d: cur.d + 1 });
					}
				}
				if (reach > bestXY.reach) bestXY = { x, y, reach };
			}
		}
		return bestXY;
	}, [board]);

	function spillAt(sx: number, sy: number) {
		if (spills <= 0) return;
		if (board[sy][sx].wall) return;
		ensureAudio();
		const hue = HUES[(5 - spills) % HUES.length];
		const next = board.map((r) => r.map((c) => ({ ...c })));
		const queue: { x: number; y: number; d: number }[] = [{ x: sx, y: sy, d: 0 }];
		const visited = new Set<string>();
		let beforeInk = 0;
		let beforeTotal = 0;
		for (const row of board) {
			for (const c of row) {
				if (!c.wall) {
					beforeTotal++;
					if (c.ink > 0) beforeInk++;
				}
			}
		}
		const before = beforeTotal ? beforeInk / beforeTotal : 0;
		while (queue.length) {
			const cur = queue.shift();
			if (!cur) break;
			const k = `${cur.x},${cur.y}`;
			if (visited.has(k)) continue;
			visited.add(k);
			if (cur.d > range) continue;
			const newInk = 1 - cur.d / (range + 1);
			const cell = next[cur.y][cur.x];
			if (newInk > cell.ink) {
				if (cell.ink === 0) cell.hue = hue;
				else cell.hue = (cell.hue + hue) / 2;
				cell.ink = newInk;
			}
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1],
			]) {
				const nx = cur.x + dx;
				const ny = cur.y + dy;
				if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
				if (next[ny][nx].wall) continue;
				queue.push({ x: nx, y: ny, d: cur.d + 1 });
			}
		}
		setHistory((h) => [...h, board]);
		setBoard(next);
		setSpills((s) => s - 1);
		let inked = 0;
		let total = 0;
		for (const row of next) {
			for (const c of row) {
				if (!c.wall) {
					total++;
					if (c.ink > 0) inked++;
				}
			}
		}
		const after = total ? inked / total : 0;
		blip(280 + (after - before) * 600, 0.18, 0.14);
	}

	function undo() {
		setHistory((h) => {
			if (h.length === 0) return h;
			const prev = h[h.length - 1];
			setBoard(prev);
			setSpills((s) => s + 1);
			return h.slice(0, -1);
		});
	}

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key.toLowerCase() === "z") undo();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const pct = fillPct();

	useEffect(() => {
		if (pct >= target) {
			const gained = Math.round(spills * 10 + level * 20);
			setScore((s) => {
				const ns = s + gained;
				setBest((b) => {
					const nb = Math.max(b, ns);
					localStorage.setItem("g55_best", String(nb));
					return nb;
				});
				return ns;
			});
			setMsg(`Level ${level} clear! +${gained}`);
			winChord();
		} else if (spills === 0) {
			setMsg("Out of spills. Click 'Reset' to retry.");
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pct, spills, level]);

	function next() {
		const lv = pct >= target ? level + 1 : level;
		setLevel(lv);
		setBoard(genBoard(lv, seed));
		setHistory([]);
		setSpills(5);
		setMsg("");
	}

	function newDaily() {
		const ns = todayUTCSeed();
		setSeed(ns);
		setLevel(1);
		setBoard(genBoard(1, ns));
		setHistory([]);
		setSpills(5);
		setMsg("");
		setScore(0);
	}

	function newRandom() {
		const ns = Math.floor(Math.random() * 0x7fffffff);
		setSeed(ns);
		setLevel(1);
		setBoard(genBoard(1, ns));
		setHistory([]);
		setSpills(5);
		setMsg("");
		setScore(0);
	}

	return (
		<div style={{ background: "#f3eee3", color: "#222", padding: 16, fontFamily: "Georgia, serif" }}>
			<h2 style={{ margin: 0 }}>Ink Spill</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Click open cells to spill ink. Ink stops at walls and mixes colors. Press Z to undo. Fill {(target * 100) | 0}% to clear.
			</div>
			<div style={{ display: "flex", gap: 14, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
				<div>Level: {level}</div>
				<div>Spills left: {spills}</div>
				<div>Filled: {(pct * 100).toFixed(0)}%</div>
				<div>Score: {score}</div>
				<div>Best: {best}</div>
				<div style={{ opacity: 0.7 }}>Seed {seed}</div>
				<button type="button" onClick={next} style={{ background: "#2b2b2b", color: "#fff", border: 0, padding: "4px 12px", borderRadius: 4 }}>
					{pct >= target ? "Next Level" : "Reset Level"}
				</button>
				<button type="button" onClick={undo} disabled={history.length === 0} style={{ background: "#776a5a", color: "#fff", border: 0, padding: "4px 12px", borderRadius: 4, opacity: history.length === 0 ? 0.4 : 1 }}>
					Undo (Z)
				</button>
				<button type="button" onClick={newDaily} style={{ background: "#5a8a4a", color: "#fff", border: 0, padding: "4px 12px", borderRadius: 4 }}>
					Daily
				</button>
				<button type="button" onClick={newRandom} style={{ background: "#7a3a8a", color: "#fff", border: 0, padding: "4px 12px", borderRadius: 4 }}>
					New Seed
				</button>
				<div style={{ color: "#7a3a8a" }}>{msg}</div>
			</div>
			<svg width={COLS * CELL} height={ROWS * CELL} style={{ marginTop: 10, background: "#fff", boxShadow: "0 2px 16px #0002" }} onClick={ensureAudio}>
				{board.map((row, y) =>
					row.map((c, x) => {
						const cx = x * CELL;
						const cy = y * CELL;
						const inkColor = c.ink > 0 ? `hsl(${c.hue},65%,28%)` : "transparent";
						return (
							<g key={`${x},${y}`} onClick={() => spillAt(x, y)} style={{ cursor: c.wall ? "default" : "pointer" }}>
								<rect x={cx} y={cy} width={CELL} height={CELL} fill={c.wall ? "#3d2f24" : "#f7f2e8"} stroke="#e0d4bf" />
								{c.ink > 0 && (
									<circle cx={cx + CELL / 2} cy={cy + CELL / 2} r={CELL * 0.45 * c.ink} fill={inkColor} opacity={0.85} />
								)}
							</g>
						);
					}),
				)}
				{spills > 0 && pct < target && hint.reach > 0 && (
					<circle
						cx={hint.x * CELL + CELL / 2}
						cy={hint.y * CELL + CELL / 2}
						r={6}
						fill="none"
						stroke="#c84a8a"
						strokeWidth={2}
						strokeDasharray="3 3"
					>
						<animate attributeName="r" values="6;12;6" dur="1.4s" repeatCount="indefinite" />
					</circle>
				)}
			</svg>
		</div>
	);
}
