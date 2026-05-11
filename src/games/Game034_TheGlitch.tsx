import { useEffect, useMemo, useRef, useState } from "react";

// Latin-square puzzle with a single corrupted cell. Procedural difficulty.

type Cell = { value: number; given: boolean };
type GlitchMode = "swap" | "reject" | "echo" | "shift";
type Difficulty = "easy" | "normal" | "hard";

const BEST_KEY = "game034_best_v2";

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

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!audioCtx) {
		try {
			audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
		} catch {
			return null;
		}
	}
	return audioCtx;
}
function blip(freq: number, dur = 0.06, type: OscillatorType = "sine", gain = 0.06) {
	const ctx = getCtx();
	if (!ctx) return;
	const o = ctx.createOscillator();
	const g = ctx.createGain();
	o.type = type;
	o.frequency.value = freq;
	g.gain.value = 0;
	g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.005);
	g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
	o.connect(g).connect(ctx.destination);
	o.start();
	o.stop(ctx.currentTime + dur + 0.02);
}
function glitchSound() {
	const ctx = getCtx();
	if (!ctx) return;
	const o = ctx.createOscillator();
	const g = ctx.createGain();
	o.type = "square";
	o.frequency.setValueAtTime(200, ctx.currentTime);
	o.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.04);
	o.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.12);
	g.gain.value = 0;
	g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.005);
	g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
	o.connect(g).connect(ctx.destination);
	o.start();
	o.stop(ctx.currentTime + 0.16);
}

function diffN(d: Difficulty): number {
	return d === "easy" ? 4 : d === "hard" ? 6 : 5;
}

function genSolution(N: number, rng: () => number): number[][] {
	const base = Array.from({ length: N }, (_, r) =>
		Array.from({ length: N }, (_, c) => ((r + c) % N) + 1),
	);
	const shuffle = <T,>(arr: T[]): T[] => {
		const a = [...arr];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(rng() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	};
	const rows = shuffle(base);
	const cols: number[][] = Array.from({ length: N }, (_, c) => rows.map((r) => r[c]));
	const colsShuffled = shuffle(cols);
	return Array.from({ length: N }, (_, r) =>
		Array.from({ length: N }, (_, c) => colsShuffled[c][r]),
	);
}

function genGivens(solution: number[][], rng: () => number, fillRate: number): Cell[][] {
	const N = solution.length;
	return Array.from({ length: N }, (_, r) =>
		Array.from({ length: N }, (_, c) => {
			const given = rng() < fillRate;
			return { value: given ? solution[r][c] : 0, given };
		}),
	);
}

const MODES: GlitchMode[] = ["swap", "reject", "echo", "shift"];

export default function TheGlitch() {
	const [difficulty, setDifficulty] = useState<Difficulty>("normal");
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const N = diffN(difficulty);
	const fillRate = difficulty === "easy" ? 0.55 : difficulty === "hard" ? 0.4 : 0.5;

	const { solution, glitchCell, glitchMode } = useMemo(() => {
		const rng = mulberry32(seed);
		const sol = genSolution(N, rng);
		const gc: [number, number] = [Math.floor(rng() * N), Math.floor(rng() * N)];
		const gm = MODES[Math.floor(rng() * MODES.length)];
		return { solution: sol, glitchCell: gc, glitchMode: gm };
	}, [seed, N]);

	const [cells, setCells] = useState<Cell[][]>(() => {
		const rng = mulberry32(seed ^ 0x9E3779B9);
		let cs = genGivens(solution, rng, fillRate);
		if (cs[glitchCell[0]][glitchCell[1]].given) {
			cs = cs.map((row) => row.map((x) => ({ ...x })));
			cs[glitchCell[0]][glitchCell[1]] = { value: 0, given: false };
		}
		return cs;
	});
	const [accusing, setAccusing] = useState(false);
	const [verdict, setVerdict] = useState<string | null>(null);
	const [accuseUsed, setAccuseUsed] = useState(false);
	const [hintsRemaining, setHintsRemaining] = useState(2);
	const [hintCell, setHintCell] = useState<[number, number] | null>(null);
	const [score, setScore] = useState(0);
	const startRef = useRef(performance.now());
	const [best, setBest] = useState<number>(() => {
		const v = typeof localStorage !== "undefined" ? localStorage.getItem(BEST_KEY) : null;
		return v ? Number(v) : 0;
	});

	useEffect(() => {
		const rng = mulberry32(seed ^ 0x9E3779B9);
		let cs = genGivens(solution, rng, fillRate);
		if (cs[glitchCell[0]][glitchCell[1]].given) {
			cs = cs.map((row) => row.map((x) => ({ ...x })));
			cs[glitchCell[0]][glitchCell[1]] = { value: 0, given: false };
		}
		setCells(cs);
		setVerdict(null);
		setAccusing(false);
		setAccuseUsed(false);
		setHintsRemaining(difficulty === "easy" ? 3 : difficulty === "hard" ? 1 : 2);
		setHintCell(null);
		setScore(0);
		startRef.current = performance.now();
	}, [seed, solution, glitchCell, fillRate, difficulty]);

	const setVal = (r: number, c: number, v: number) => {
		setCells((cs) => {
			const ng = cs.map((row) => row.map((x) => ({ ...x })));
			if (ng[r][c].given) return cs;
			if (r === glitchCell[0] && c === glitchCell[1]) {
				if (glitchMode === "swap" && v === solution[r][c]) {
					ng[r][c].value = (v % N) + 1;
					glitchSound();
					return ng;
				}
				if (glitchMode === "reject" && v === solution[r][c]) {
					ng[r][c].value = 0;
					glitchSound();
					return ng;
				}
				if (glitchMode === "echo" && v !== 0 && v !== solution[r][c]) {
					const nb = ng[r][(c + 1) % N].value || ng[(r + 1) % N][c].value;
					if (nb) {
						ng[r][c].value = nb;
						glitchSound();
						return ng;
					}
				}
				if (glitchMode === "shift" && v !== 0) {
					ng[r][c].value = (v % N) + 1;
					glitchSound();
					return ng;
				}
			}
			ng[r][c].value = v;
			blip(440 + v * 60, 0.04, "sine", 0.04);
			return ng;
		});
	};

	const handleCellClick = (r: number, c: number) => {
		if (accusing && !accuseUsed) {
			setAccuseUsed(true);
			if (r === glitchCell[0] && c === glitchCell[1]) {
				const timeBonus = Math.max(0, 600 - Math.floor((performance.now() - startRef.current) / 100));
				const diffMult = difficulty === "easy" ? 1 : difficulty === "hard" ? 3 : 2;
				const points = (500 + timeBonus) * diffMult - (2 - hintsRemaining) * 80;
				setScore(points);
				setVerdict(`CORRECT! Glitch at (${r + 1}, ${c + 1}), mode: ${glitchMode}. +${points}`);
				blip(660, 0.1, "triangle", 0.08);
				blip(990, 0.14, "sine", 0.06);
				if (points > best) {
					setBest(points);
					try {
						localStorage.setItem(BEST_KEY, String(points));
					} catch {
						/* ignore */
					}
				}
			} else {
				setVerdict(`Wrong. Glitch was at (${glitchCell[0] + 1}, ${glitchCell[1] + 1}).`);
				blip(180, 0.18, "sawtooth", 0.06);
			}
			setAccusing(false);
		}
	};

	const useHint = () => {
		if (hintsRemaining <= 0 || accuseUsed) return;
		const candidates: [number, number][] = [];
		for (let r = 0; r < N; r++) {
			for (let c = 0; c < N; c++) {
				if (!cells[r][c].given && !(r === glitchCell[0] && c === glitchCell[1])) {
					candidates.push([r, c]);
				}
			}
		}
		if (candidates.length === 0) return;
		const pick = candidates[Math.floor(Math.random() * candidates.length)];
		setHintCell(pick);
		setHintsRemaining((h) => h - 1);
		blip(720, 0.08, "triangle", 0.05);
	};

	const isSolved = useMemo(() => {
		for (let r = 0; r < N; r++) {
			const row = new Set(cells[r].map((x) => x.value));
			if (row.has(0) || row.size !== N) return false;
		}
		for (let c = 0; c < N; c++) {
			const col = new Set(cells.map((row) => row[c].value));
			if (col.has(0) || col.size !== N) return false;
		}
		return true;
	}, [cells, N]);

	const options = Array.from({ length: N }, (_, i) => i + 1);

	return (
		<div style={{ background: "#0f0f1a", color: "#eee", padding: 16, fontFamily: "monospace" }}>
			<h2 style={{ margin: "0 0 4px" }}>The Glitch</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Solve the latin-square (1-{N} each row/col). One cell silently misbehaves. Spot the saboteur.
			</div>
			<div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
				<select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
					<option value="easy">Easy 4×4</option>
					<option value="normal">Normal 5×5</option>
					<option value="hard">Hard 6×6</option>
				</select>
				<button type="button" onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>New</button>
				<button type="button" onClick={() => setAccusing((a) => !a)} disabled={accuseUsed}>
					{accusing ? "Cancel accuse" : accuseUsed ? "Accusal used" : "Accuse cell"}
				</button>
				<button type="button" onClick={useHint} disabled={hintsRemaining <= 0 || accuseUsed}>
					Hint ({hintsRemaining})
				</button>
				<div style={{ opacity: 0.7 }}>Score: {score} · Best: {best}</div>
				{verdict && <div style={{ color: verdict.startsWith("CORRECT") ? "#7f7" : "#f77" }}>{verdict}</div>}
			</div>
			<div style={{ display: "inline-block", border: "2px solid #555" }}>
				{cells.map((row, r) => (
					<div key={r} style={{ display: "flex" }}>
						{row.map((cell, c) => {
							const isHint = hintCell && hintCell[0] === r && hintCell[1] === c;
							return (
								<div
									key={c}
									onClick={() => handleCellClick(r, c)}
									style={{
										width: 60,
										height: 60,
										border: "1px solid #333",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										background: isHint
											? "#1d3a1d"
											: cell.given
												? "#222"
												: accusing
													? "#321a1a"
													: "#1a1a2a",
										cursor: accusing && !accuseUsed ? "pointer" : "default",
									}}
								>
									{cell.given ? (
										<span style={{ fontSize: 22, color: "#aaa" }}>{cell.value}</span>
									) : (
										<select
											value={cell.value}
											onChange={(e) => setVal(r, c, Number(e.target.value))}
											style={{
												background: "transparent",
												color: isHint ? "#7f7" : "#fff",
												border: "none",
												fontSize: 22,
												textAlign: "center",
												fontFamily: "monospace",
											}}
										>
											<option value={0}>·</option>
											{options.map((v) => (
												<option key={v} value={v}>{v}</option>
											))}
										</select>
									)}
								</div>
							);
						})}
					</div>
				))}
			</div>
			<div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
				{isSolved ? "Latin square complete." : `Fill all cells; rows/cols must be 1-${N}.`} Hint cells are not the glitch.
			</div>
		</div>
	);
}
