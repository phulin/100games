import { useEffect, useMemo, useRef, useState } from "react";

const COLS = 30;
const ROWS = 20;
const CELL = 22;
const TICK_MS = 220;

type Cell = "empty" | "spore" | "burning" | "firebreak" | "target" | "burnt" | "water";

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function dailySeed() {
	const d = new Date();
	return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

type Level = {
	grid: Cell[];
	wind: { dx: number; dy: number; strength: number };
	breaks: number;
	water: number;
	totalTargets: number;
};

function buildLevel(seed: number): Level {
	const rng = mulberry32(seed);
	const g: Cell[] = new Array(COLS * ROWS).fill("empty");
	const sources = 1 + Math.floor(rng() * 3);
	for (let i = 0; i < sources; i++) {
		const x = Math.floor(rng() * 4);
		const y = Math.floor(rng() * ROWS);
		g[y * COLS + x] = "burning";
	}
	const targetCount = 4 + Math.floor(rng() * 5);
	let placed = 0;
	let tries = 0;
	while (placed < targetCount && tries < 200) {
		tries++;
		const x = Math.floor(COLS / 2 + rng() * (COLS / 2 - 2)) + 1;
		const y = Math.floor(rng() * ROWS);
		const i = y * COLS + x;
		if (g[i] === "empty") {
			g[i] = "target";
			placed++;
		}
	}
	const stones = Math.floor(rng() * 30);
	for (let i = 0; i < stones; i++) {
		const x = Math.floor(rng() * COLS);
		const y = Math.floor(rng() * ROWS);
		const idx = y * COLS + x;
		if (g[idx] === "empty") g[idx] = "firebreak";
	}
	const dx = 1;
	const dy = Math.floor(rng() * 3) - 1;
	const strength = 0.3 + rng() * 0.5;
	const breaks = 18 + Math.floor(rng() * 14);
	const water = 2 + Math.floor(rng() * 4);
	return { grid: g, wind: { dx, dy, strength }, breaks, water, totalTargets: placed };
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
function blip(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.05) {
	const ctx = getCtx();
	if (!ctx) return;
	const o = ctx.createOscillator();
	const g = ctx.createGain();
	o.type = type;
	o.frequency.value = freq;
	g.gain.value = gain;
	g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
	o.connect(g).connect(ctx.destination);
	o.start();
	o.stop(ctx.currentTime + dur);
}
function crackle() {
	const ctx = getCtx();
	if (!ctx) return;
	const buf = ctx.createBuffer(1, 800, ctx.sampleRate);
	const d = buf.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) * 0.4;
	const src = ctx.createBufferSource();
	src.buffer = buf;
	const g = ctx.createGain();
	g.gain.value = 0.08;
	src.connect(g).connect(ctx.destination);
	src.start();
}

type Tool = "firebreak" | "water";

export default function Game081_Spores() {
	const [seed, setSeed] = useState(() => dailySeed());
	const initial = useMemo(() => buildLevel(seed), [seed]);
	const [grid, setGrid] = useState<Cell[]>(() => initial.grid.slice());
	const [breaks, setBreaks] = useState(initial.breaks);
	const [water, setWater] = useState(initial.water);
	const [tool, setTool] = useState<Tool>("firebreak");
	const [tick, setTick] = useState(0);
	const [running, setRunning] = useState(false);
	const [ended, setEnded] = useState<null | { saved: number; total: number; score: number }>(null);
	const gridRef = useRef(grid);
	gridRef.current = grid;
	const breaksRef = useRef(breaks);
	breaksRef.current = breaks;
	const waterRef = useRef(water);
	waterRef.current = water;
	const rngRef = useRef(mulberry32(seed ^ 0x9e3779b9));

	const totalTargets = initial.totalTargets;
	const wind = initial.wind;

	useEffect(() => {
		setGrid(initial.grid.slice());
		setBreaks(initial.breaks);
		setWater(initial.water);
		setTick(0);
		setRunning(false);
		setEnded(null);
		rngRef.current = mulberry32(seed ^ 0x9e3779b9);
	}, [seed, initial]);

	useEffect(() => {
		if (!running) return;
		const id = setInterval(() => {
			const rng = rngRef.current;
			const g = gridRef.current.slice();
			let anyBurning = false;
			const newBurns: number[] = [];
			for (let y = 0; y < ROWS; y++) {
				for (let x = 0; x < COLS; x++) {
					const i = y * COLS + x;
					if (g[i] !== "burning") continue;
					anyBurning = true;
					const neigh = [[1, 0], [-1, 0], [0, 1], [0, -1]];
					for (const [dx, dy] of neigh) {
						const nx = x + dx;
						const ny = y + dy;
						if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
						const ni = ny * COLS + nx;
						const c = g[ni];
						if (c !== "empty" && c !== "target") continue;
						let p = 0.45;
						const dot = dx * wind.dx + dy * wind.dy;
						p += dot * wind.strength * 0.4;
						p = Math.max(0.05, Math.min(0.95, p));
						if (rng() < p) newBurns.push(ni);
					}
				}
			}
			for (let i = 0; i < g.length; i++) {
				if (g[i] === "burning") g[i] = "burnt";
			}
			for (const i of newBurns) g[i] = "burning";
			if (newBurns.length > 0) crackle();
			setGrid(g);
			setTick((t) => t + 1);
			if (!anyBurning || newBurns.length === 0) {
				const saved = g.filter((c) => c === "target").length;
				const score = saved * 100 + breaksRef.current * 5 + waterRef.current * 8;
				setRunning(false);
				setEnded({ saved, total: totalTargets, score });
				blip(saved === totalTargets ? 660 : 220, 0.4, "triangle", 0.08);
			}
		}, TICK_MS);
		return () => clearInterval(id);
	}, [running, totalTargets, wind.dx, wind.dy, wind.strength]);

	const useTool = (i: number) => {
		if (ended) return;
		const c = grid[i];
		if (tool === "firebreak") {
			if (running) return;
			if (c === "empty") {
				if (breaks <= 0) return;
				const g = grid.slice();
				g[i] = "firebreak";
				setGrid(g);
				setBreaks(breaks - 1);
				blip(420, 0.05, "square", 0.04);
			} else if (c === "firebreak") {
				const g = grid.slice();
				g[i] = "empty";
				setGrid(g);
				setBreaks(breaks + 1);
			}
		} else if (tool === "water") {
			if (water <= 0) return;
			const base = gridRef.current;
			const cc = base[i];
			if (cc === "burning" || cc === "empty" || cc === "target") {
				const g = base.slice();
				const x = i % COLS;
				const y = (i / COLS) | 0;
				for (let dy = -1; dy <= 1; dy++) {
					for (let dx = -1; dx <= 1; dx++) {
						const nx = x + dx;
						const ny = y + dy;
						if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
						const ni = ny * COLS + nx;
						if (g[ni] === "burning" || g[ni] === "empty") g[ni] = "water";
					}
				}
				setGrid(g);
				setWater(water - 1);
				blip(180, 0.18, "sine", 0.07);
			}
		}
	};

	const restartSame = () => {
		setGrid(initial.grid.slice());
		setBreaks(initial.breaks);
		setWater(initial.water);
		setTick(0);
		setRunning(false);
		setEnded(null);
		rngRef.current = mulberry32(seed ^ 0x9e3779b9);
	};
	const newSeed = () => setSeed(Math.floor(Math.random() * 1e9));
	const daily = () => setSeed(dailySeed());

	const colorFor = (c: Cell) => {
		switch (c) {
			case "empty": return "#1f2a1a";
			case "spore": return "#5a8a3a";
			case "burning": return "#d04a2e";
			case "burnt": return "#3a2a22";
			case "firebreak": return "#cfa45a";
			case "target": return "#3ec1c8";
			case "water": return "#3a78c8";
		}
	};

	const windLabel = wind.dy === 0 ? "E" : wind.dy < 0 ? "NE" : "SE";

	return (
		<div style={{ fontFamily: "system-ui, sans-serif", color: "#e6e6e6", background: "#0c130a", padding: 16, minHeight: 600 }}>
			<h2 style={{ margin: 0 }}>81. Spores</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Place firebreaks (gold) and douse cells with water before releasing the fungus. Wind blows {windLabel} at strength {wind.strength.toFixed(2)}.
			</div>
			<div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
				<div>Seed #{seed}</div>
				<div>Breaks: {breaks}</div>
				<div>Water: {water}</div>
				<div>Tick: {tick}</div>
				<button type="button" onClick={() => setTool("firebreak")} style={{ ...btn, background: tool === "firebreak" ? "#8a6a30" : "#234" }}>Firebreak</button>
				<button type="button" onClick={() => setTool("water")} style={{ ...btn, background: tool === "water" ? "#2a5a8a" : "#234" }}>Water (3x3)</button>
				<button type="button" onClick={() => setRunning(true)} disabled={running || !!ended} style={btn}>Start</button>
				<button type="button" onClick={restartSame} style={btn}>Restart seed</button>
				<button type="button" onClick={daily} style={btn}>Daily</button>
				<button type="button" onClick={newSeed} style={btn}>New seed</button>
				{ended && (<strong>Saved {ended.saved}/{ended.total} · Score {ended.score}</strong>)}
			</div>
			<div style={{ display: "grid", gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gap: 1, background: "#000", width: "fit-content" }}>
				{grid.map((c, i) => (
					<div key={i} onClick={() => useTool(i)} style={{ width: CELL, height: CELL, background: colorFor(c), cursor: ended ? "default" : "pointer" }} />
				))}
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "6px 12px",
	background: "#234",
	color: "#fff",
	border: "1px solid #456",
	borderRadius: 4,
	cursor: "pointer",
};
