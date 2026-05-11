import { useEffect, useMemo, useRef, useState } from "react";

// Anti-Match — reverse match-3. 3 in a row of any color = penalty.

const COLORS = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#b56576"];
const SYMBOLS = ["▲", "■", "●", "◆", "✚"];
const COLS = 5;
const ROWS = 8;

type Cell = number | null;

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeQueue(seed: number, len: number): number[] {
	const r = mulberry32(seed);
	return Array.from({ length: len }, () => Math.floor(r() * COLORS.length));
}

function todaySeed(): number {
	const d = new Date();
	return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function emptyGrid(): Cell[][] {
	return Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => null as Cell));
}

function useAudio() {
	const ctxRef = useRef<AudioContext | null>(null);
	const ensure = () => {
		if (!ctxRef.current) {
			try {
				ctxRef.current = new (window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
			} catch {
				/* no audio */
			}
		}
		return ctxRef.current;
	};
	const beep = (freq: number, dur = 0.08, type: OscillatorType = "triangle", gain = 0.12) => {
		const ctx = ensure();
		if (!ctx) return;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.value = freq;
		g.gain.setValueAtTime(0.0001, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + dur + 0.02);
	};
	return { ensure, beep };
}

type Mode = "daily" | "random";

export default function Game042_AntiMatch() {
	const [mode, setMode] = useState<Mode>("random");
	const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 1e9));
	const [grid, setGrid] = useState<Cell[][]>(emptyGrid);
	const queue = useMemo(() => makeQueue(seed, 60), [seed]);
	const [qIdx, setQIdx] = useState(0);
	const [score, setScore] = useState(0);
	const [penalty, setPenalty] = useState(0);
	const [over, setOver] = useState(false);
	const [flash, setFlash] = useState<string | null>(null);
	const [history, setHistory] = useState<{ grid: Cell[][]; qIdx: number; score: number; penalty: number }[]>([]);
	const [combo, setCombo] = useState(0);
	const [swapAvail, setSwapAvail] = useState(2);
	const [cb, setCb] = useState<boolean>(() => localStorage.getItem("antimatch_cb") === "1");
	const [, setBump] = useState(0);
	const flashTimer = useRef<number | null>(null);
	const audio = useAudio();

	const current = queue[qIdx];
	const next = queue[qIdx + 1];

	const showFlash = (msg: string) => {
		setFlash(msg);
		if (flashTimer.current) clearTimeout(flashTimer.current);
		flashTimer.current = window.setTimeout(() => setFlash(null), 800);
	};

	const place = (col: number) => {
		if (over) return;
		if (current === undefined) return;
		const column = grid[col];
		const firstEmpty = column.findIndex((c) => c === null);
		if (firstEmpty === -1) {
			showFlash("Column full!");
			audio.beep(180, 0.1, "square", 0.08);
			return;
		}
		setHistory((h) =>
			[
				...h,
				{ grid: grid.map((c) => c.slice()), qIdx, score, penalty },
			].slice(-10)
		);
		const newGrid = grid.map((c) => c.slice());
		newGrid[col][firstEmpty] = current;
		const c = current;
		const x = col;
		const y = firstEmpty;
		const dirs = [
			[1, 0],
			[0, 1],
			[1, 1],
			[1, -1],
		];
		let pen = 0;
		let maxRun = 0;
		const toClear = new Set<string>();
		for (const [dx, dy] of dirs) {
			let run = 1;
			const line = [`${x},${y}`];
			let nx = x + dx;
			let ny = y + dy;
			while (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && newGrid[nx][ny] === c) {
				run++;
				line.push(`${nx},${ny}`);
				nx += dx;
				ny += dy;
			}
			nx = x - dx;
			ny = y - dy;
			while (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS && newGrid[nx][ny] === c) {
				run++;
				line.push(`${nx},${ny}`);
				nx -= dx;
				ny -= dy;
			}
			if (run >= 3) {
				maxRun = Math.max(maxRun, run);
				pen += (run * (run - 1)) / 2;
				for (const k of line) toClear.add(k);
			}
		}
		if (toClear.size > 0) {
			setPenalty((p) => p + pen);
			setCombo(0);
			showFlash(`-${pen} penalty (run of ${maxRun})`);
			audio.beep(110, 0.25, "sawtooth", 0.18);
			for (const k of toClear) {
				const [cx, cy] = k.split(",").map(Number);
				newGrid[cx][cy] = null;
			}
			for (let cc = 0; cc < COLS; cc++) {
				const kept = newGrid[cc].filter((v): v is number => v !== null);
				const padded: Cell[] = [...kept];
				while (padded.length < ROWS) padded.push(null);
				newGrid[cc] = padded;
			}
		} else {
			setCombo((k) => {
				setScore((s) => s + 1 + Math.floor(k / 5));
				return k + 1;
			});
			audio.beep(440 + col * 70, 0.06, "triangle", 0.08);
		}
		setGrid(newGrid);
		setQIdx((i) => i + 1);
		if (qIdx + 1 >= queue.length) setOver(true);
	};

	const undo = () => {
		setHistory((h) => {
			if (h.length === 0) return h;
			const last = h[h.length - 1];
			setGrid(last.grid);
			setQIdx(last.qIdx);
			setScore(last.score);
			setPenalty(last.penalty);
			setOver(false);
			setCombo(0);
			audio.beep(300, 0.05, "sine", 0.07);
			return h.slice(0, -1);
		});
	};

	const swap = () => {
		if (swapAvail <= 0 || over) return;
		const tmp = queue[qIdx];
		queue[qIdx] = queue[qIdx + 1];
		queue[qIdx + 1] = tmp;
		setSwapAvail((s) => s - 1);
		audio.beep(660, 0.06, "triangle", 0.1);
		setBump((b) => b + 1);
	};

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const n = parseInt(e.key, 10);
			if (n >= 1 && n <= COLS) place(n - 1);
			if (e.key === "z" || e.key === "Z") undo();
			if (e.key === "s" || e.key === "S") swap();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const reset = (m: Mode = mode) => {
		const ns = m === "daily" ? todaySeed() : Math.floor(Math.random() * 1e9);
		setMode(m);
		setSeed(ns);
		setGrid(emptyGrid());
		setQIdx(0);
		setScore(0);
		setPenalty(0);
		setOver(false);
		setHistory([]);
		setCombo(0);
		setSwapAvail(2);
	};

	const toggleCB = () => {
		const nv = !cb;
		setCb(nv);
		localStorage.setItem("antimatch_cb", nv ? "1" : "0");
	};

	const cellSize = 60;

	const renderToken = (v: number, size: number) => (
		<div
			style={{
				width: size,
				height: size,
				borderRadius: "50%",
				background: COLORS[v],
				boxShadow: "inset -3px -4px 6px rgba(0,0,0,0.4)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				color: "#fff",
				fontSize: size * 0.5,
				fontWeight: 700,
			}}
		>
			{cb ? SYMBOLS[v] : ""}
		</div>
	);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#101418",
				color: "#eee",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<h2 style={{ margin: 4 }}>Anti-Match</h2>
			<div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>
				Click a column or press 1–5. Avoid 3-in-a-row. Z undo, S swap. Mode: {mode} · seed {seed}
			</div>
			<div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
				<div>
					<div style={{ display: "flex", gap: 0, marginBottom: 6, justifyContent: "center" }}>
						<div style={{ display: "flex", alignItems: "center" }}>
							{current !== undefined ? renderToken(current, 40) : null}
						</div>
						<div style={{ marginLeft: 12, marginTop: 5, opacity: 0.6 }}>
							{renderToken(next ?? 0, 30)}
						</div>
					</div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
							background: "#222",
							border: "2px solid #333",
						}}
					>
						{Array.from({ length: ROWS }).map((_, rRev) => {
							const r = ROWS - 1 - rRev;
							return Array.from({ length: COLS }).map((_, c) => {
								const v = grid[c][r];
								return (
									<div
										key={`${c}-${r}`}
										onClick={() => {
											audio.ensure();
											place(c);
										}}
										style={{
											width: cellSize,
											height: cellSize,
											borderRight: "1px solid #2a2e36",
											borderBottom: "1px solid #2a2e36",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											cursor: "pointer",
										}}
									>
										{v !== null && renderToken(v, cellSize - 14)}
									</div>
								);
							});
						})}
					</div>
				</div>
				<div style={{ minWidth: 200 }}>
					<div style={{ fontSize: 28 }}>{score - penalty}</div>
					<div style={{ opacity: 0.7, fontSize: 13 }}>
						placed: {score} · penalty: {penalty} · combo: {combo}
					</div>
					<div style={{ marginTop: 12, opacity: 0.7 }}>
						queue {qIdx}/{queue.length}
					</div>
					<div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6, maxWidth: 180 }}>
						{queue.slice(qIdx + 2, qIdx + 18).map((cIdx, i) => (
							<div
								key={i}
								style={{
									width: 16,
									height: 16,
									borderRadius: "50%",
									background: COLORS[cIdx],
									opacity: 0.6,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									color: "#fff",
									fontSize: 10,
								}}
							>
								{cb ? SYMBOLS[cIdx] : ""}
							</div>
						))}
					</div>
					<div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
						<button type="button" onClick={undo} style={btn} disabled={history.length === 0}>
							Undo (Z) · {history.length} left
						</button>
						<button type="button" onClick={swap} style={btn} disabled={swapAvail === 0}>
							Swap with next (S) · {swapAvail}
						</button>
						<button type="button" onClick={() => reset("random")} style={btn}>
							New random
						</button>
						<button type="button" onClick={() => reset("daily")} style={btn}>
							Daily seed
						</button>
						<label style={{ fontSize: 12, opacity: 0.8 }}>
							<input type="checkbox" checked={cb} onChange={toggleCB} /> Color-blind symbols
						</label>
					</div>
					{over && <div style={{ marginTop: 10, color: "#fc6" }}>Queue empty — finished.</div>}
					{flash && <div style={{ marginTop: 12, color: "#fc6" }}>{flash}</div>}
				</div>
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#2a3045",
	color: "#fff",
	border: "1px solid #445",
	padding: "6px 12px",
	borderRadius: 6,
	cursor: "pointer",
};
