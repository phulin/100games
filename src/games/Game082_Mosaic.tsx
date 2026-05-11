import { useEffect, useMemo, useState } from "react";

const GRID = 16;

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

function hsl(h: number, s: number, l: number) {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let r = 0, g = 0, b = 0;
	if (h < 60) [r, g, b] = [c, x, 0];
	else if (h < 120) [r, g, b] = [x, c, 0];
	else if (h < 180) [r, g, b] = [0, c, x];
	else if (h < 240) [r, g, b] = [0, x, c];
	else if (h < 300) [r, g, b] = [x, 0, c];
	else [r, g, b] = [c, 0, x];
	const to = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
	return `#${to(r)}${to(g)}${to(b)}`;
}

function makePalette(seed: number): string[] {
	const rng = mulberry32(seed ^ 0x533a771b);
	const baseH = rng() * 360;
	const out: string[] = [];
	const scheme = Math.floor(rng() * 3);
	const spread = scheme === 0 ? 30 : scheme === 1 ? 120 : 150;
	for (let i = 0; i < 8; i++) {
		const h = (baseH + (i - 3) * spread * (0.4 + rng() * 0.4)) % 360;
		const s = 0.45 + rng() * 0.4;
		const l = 0.18 + (i / 8) * 0.55 + (rng() - 0.5) * 0.08;
		out.push(hsl((h + 360) % 360, s, Math.max(0.08, Math.min(0.85, l))));
	}
	return out;
}

function makeTarget(seed: number, paletteLen: number): number[] {
	const rng = mulberry32(seed);
	const bg = Math.floor(rng() * paletteLen);
	const g = new Array<number>(GRID * GRID).fill(bg);
	const shapes = 2 + Math.floor(rng() * 4);
	for (let s = 0; s < shapes; s++) {
		const kind = Math.floor(rng() * 4);
		const col = (Math.floor(rng() * paletteLen) + 1) % paletteLen;
		if (kind === 0) {
			const cx = Math.floor(rng() * GRID);
			const cy = Math.floor(rng() * GRID);
			const rad = 2 + Math.floor(rng() * 4);
			for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) {
				const dx = x - cx; const dy = y - cy;
				if (dx * dx + dy * dy <= rad * rad) g[y * GRID + x] = col;
			}
		} else if (kind === 1) {
			const sy = Math.floor(rng() * GRID);
			const t = 1 + Math.floor(rng() * 2);
			for (let y = Math.max(0, sy - t); y <= Math.min(GRID - 1, sy + t); y++)
				for (let x = 0; x < GRID; x++) g[y * GRID + x] = col;
		} else if (kind === 2) {
			const sx = Math.floor(rng() * GRID);
			const t = 1 + Math.floor(rng() * 2);
			for (let x = Math.max(0, sx - t); x <= Math.min(GRID - 1, sx + t); x++)
				for (let y = 0; y < GRID; y++) g[y * GRID + x] = col;
		} else {
			const x0 = Math.floor(rng() * (GRID - 3));
			const y0 = Math.floor(rng() * (GRID - 3));
			const w = 2 + Math.floor(rng() * 6);
			const h = 2 + Math.floor(rng() * 6);
			for (let y = y0; y < Math.min(GRID, y0 + h); y++)
				for (let x = x0; x < Math.min(GRID, x0 + w); x++) g[y * GRID + x] = col;
		}
	}
	return g;
}

let audioCtx: AudioContext | null = null;
function blip(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.04) {
	if (typeof window === "undefined") return;
	try {
		if (!audioCtx)
			audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
	} catch { return; }
	const ctx = audioCtx; if (!ctx) return;
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

type Tool = "brush" | "fill" | "eyedrop";

export default function Game082_Mosaic() {
	const [seed, setSeed] = useState(() => dailySeed());
	const palette = useMemo(() => makePalette(seed), [seed]);
	const target = useMemo(() => makeTarget(seed, palette.length), [seed, palette.length]);
	const [board, setBoard] = useState<(number | null)[]>(() => new Array(GRID * GRID).fill(null));
	const [color, setColor] = useState(0);
	const [budget, setBudget] = useState(GRID * GRID - 30);
	const [tool, setTool] = useState<Tool>("brush");
	const [history, setHistory] = useState<(number | null)[][]>([]);
	const [showHeat, setShowHeat] = useState(false);

	useEffect(() => {
		setBoard(new Array(GRID * GRID).fill(null));
		setBudget(GRID * GRID - 30);
		setHistory([]);
	}, [seed]);

	const pushHistory = (b: (number | null)[]) => setHistory((h) => [...h.slice(-49), b]);

	const place = (i: number) => {
		if (tool === "eyedrop") {
			if (board[i] !== null) {
				setColor(board[i] as number);
				blip(800, 0.05, "sine", 0.03);
			} else {
				setColor(target[i]);
				blip(1000, 0.05, "sine", 0.03);
			}
			return;
		}
		if (tool === "fill") {
			const ref = board[i];
			const visited = new Set<number>();
			const stack = [i];
			const b = board.slice();
			let spent = 0;
			while (stack.length) {
				const p = stack.pop() as number;
				if (visited.has(p)) continue;
				visited.add(p);
				if (b[p] !== ref) continue;
				if (b[p] === null) {
					if (budget - spent <= 0) continue;
					spent++;
				}
				b[p] = color;
				const x = p % GRID; const y = (p / GRID) | 0;
				if (x > 0) stack.push(p - 1);
				if (x < GRID - 1) stack.push(p + 1);
				if (y > 0) stack.push(p - GRID);
				if (y < GRID - 1) stack.push(p + GRID);
			}
			pushHistory(board);
			setBoard(b);
			setBudget(budget - spent);
			blip(440, 0.08, "triangle", 0.05);
			return;
		}
		if (board[i] === color) return;
		const b = board.slice();
		if (b[i] === null) {
			if (budget <= 0) return;
			setBudget(budget - 1);
		}
		b[i] = color;
		pushHistory(board);
		setBoard(b);
		blip(520 + color * 30, 0.03, "square", 0.025);
	};
	const erase = (i: number) => {
		if (board[i] === null) return;
		pushHistory(board);
		const b = board.slice();
		b[i] = null;
		setBoard(b);
		setBudget(budget + 1);
	};
	const undo = () => {
		if (history.length === 0) return;
		const last = history[history.length - 1];
		const used = last.filter((v) => v !== null).length;
		setBoard(last);
		setBudget(GRID * GRID - 30 - used);
		setHistory(history.slice(0, -1));
	};

	const score = useMemo(() => {
		let match = 0; let placed = 0;
		for (let i = 0; i < board.length; i++) {
			if (board[i] !== null) {
				placed++;
				if (board[i] === target[i]) match++;
			}
		}
		const total = GRID * GRID;
		return { match, placed, pct: ((match / total) * 100) | 0 };
	}, [board, target]);

	const newPuzzle = () => setSeed(Math.floor(Math.random() * 1e9));
	const daily = () => setSeed(dailySeed());

	const cell = 22;

	return (
		<div style={{ fontFamily: "system-ui, sans-serif", color: "#eee", background: "#15151c", padding: 16, minHeight: 600 }}>
			<h2 style={{ margin: 0 }}>82. Mosaic</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Brush/Fill/Eyedrop to approximate the target. Right-click erases.
			</div>
			<div style={{ display: "flex", gap: 24 }}>
				<div>
					<div style={{ fontSize: 12, marginBottom: 4 }}>Target · seed #{seed}</div>
					<div style={{ display: "grid", gridTemplateColumns: `repeat(${GRID}, ${cell}px)` }}>
						{target.map((c, i) => (
							<div key={i} style={{ width: cell, height: cell, background: palette[c] }} />
						))}
					</div>
				</div>
				<div>
					<div style={{ fontSize: 12, marginBottom: 4 }}>
						Your mosaic — budget {budget} — match {score.pct}%
					</div>
					<div style={{ display: "grid", gridTemplateColumns: `repeat(${GRID}, ${cell}px)`, position: "relative" }}>
						{board.map((c, i) => {
							const bg = c === null ? "#222" : palette[c];
							const heat = showHeat && c !== null
								? c === target[i]
									? "inset 0 0 0 2px rgba(80,255,80,0.55)"
									: "inset 0 0 0 2px rgba(255,80,80,0.55)"
								: undefined;
							return (
								<div
									key={i}
									onClick={() => place(i)}
									onContextMenu={(e) => { e.preventDefault(); erase(i); }}
									style={{ width: cell, height: cell, background: bg, border: "1px solid #111", cursor: "pointer", boxShadow: heat }}
								/>
							);
						})}
					</div>
				</div>
			</div>
			<div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
				{palette.map((p, i) => (
					<button
						key={i}
						type="button"
						onClick={() => setColor(i)}
						style={{ width: 28, height: 28, background: p, border: i === color ? "2px solid #fff" : "2px solid transparent", cursor: "pointer" }}
					/>
				))}
				<span style={{ width: 1, height: 24, background: "#444" }} />
				<button type="button" onClick={() => setTool("brush")} style={{ ...btn, background: tool === "brush" ? "#557" : "#234" }}>Brush</button>
				<button type="button" onClick={() => setTool("fill")} style={{ ...btn, background: tool === "fill" ? "#557" : "#234" }}>Fill</button>
				<button type="button" onClick={() => setTool("eyedrop")} style={{ ...btn, background: tool === "eyedrop" ? "#557" : "#234" }}>Eyedrop</button>
				<button type="button" onClick={undo} style={btn} disabled={!history.length}>Undo</button>
				<button type="button" onClick={() => setShowHeat((s) => !s)} style={btn}>{showHeat ? "Hide" : "Show"} heat</button>
				<button type="button" onClick={daily} style={btn}>Daily</button>
				<button type="button" onClick={newPuzzle} style={btn}>New puzzle</button>
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
