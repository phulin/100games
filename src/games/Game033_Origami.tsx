import { useEffect, useMemo, useRef, useState } from "react";

// Polygon-based fold simulator with procedural targets.

type Pt = { x: number; y: number };
type Poly = { pts: Pt[]; color: string };

const SIZE = 380;
const ORIGIN = { x: 200, y: 200 };
const BEST_KEY = "game033_best_v2";

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
function paperFold() {
	const ctx = getCtx();
	if (!ctx) return;
	const o = ctx.createOscillator();
	const g = ctx.createGain();
	const n = ctx.createBiquadFilter();
	n.type = "bandpass";
	n.frequency.value = 1200;
	o.type = "sawtooth";
	o.frequency.setValueAtTime(280, ctx.currentTime);
	o.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.15);
	g.gain.value = 0;
	g.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.01);
	g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
	o.connect(n).connect(g).connect(ctx.destination);
	o.start();
	o.stop(ctx.currentTime + 0.25);
}
function blip(freq: number, dur = 0.08, type: OscillatorType = "sine", gain = 0.06) {
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

function reflect(p: Pt, a: Pt, b: Pt): Pt {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len2 = dx * dx + dy * dy;
	const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
	const projX = a.x + t * dx;
	const projY = a.y + t * dy;
	return { x: 2 * projX - p.x, y: 2 * projY - p.y };
}

function sideOf(p: Pt, a: Pt, b: Pt) {
	return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function splitPoly(poly: Pt[], a: Pt, b: Pt): { left: Pt[]; right: Pt[] } {
	const left: Pt[] = [];
	const right: Pt[] = [];
	for (let i = 0; i < poly.length; i++) {
		const cur = poly[i];
		const nxt = poly[(i + 1) % poly.length];
		const sCur = sideOf(cur, a, b);
		const sNxt = sideOf(nxt, a, b);
		if (sCur >= 0) left.push(cur);
		if (sCur <= 0) right.push(cur);
		if ((sCur > 0 && sNxt < 0) || (sCur < 0 && sNxt > 0)) {
			const t = sCur / (sCur - sNxt);
			const ix = cur.x + t * (nxt.x - cur.x);
			const iy = cur.y + t * (nxt.y - cur.y);
			left.push({ x: ix, y: iy });
			right.push({ x: ix, y: iy });
		}
	}
	return { left, right };
}

function foldPolygons(polys: Poly[], a: Pt, b: Pt, side: 1 | -1): Poly[] {
	const out: Poly[] = [];
	for (const poly of polys) {
		const { left, right } = splitPoly(poly.pts, a, b);
		const keep = side === 1 ? left : right;
		const flip = side === 1 ? right : left;
		if (keep.length >= 3) out.push({ pts: keep, color: poly.color });
		if (flip.length >= 3) {
			out.push({ pts: flip.map((p) => reflect(p, a, b)), color: poly.color });
		}
	}
	return out;
}

function polyArea(pts: Pt[]) {
	let s = 0;
	for (let i = 0; i < pts.length; i++) {
		const a = pts[i];
		const b = pts[(i + 1) % pts.length];
		s += a.x * b.y - b.x * a.y;
	}
	return Math.abs(s) / 2;
}

type Target = {
	name: string;
	minFolds: number;
	maxFolds: number;
	test: (polys: Poly[]) => boolean;
};

function genTargets(seed: number): Target[] {
	const r = mulberry32(seed);
	const startArea = SIZE * SIZE;
	const out: Target[] = [];
	out.push({
		name: "Halve the sheet",
		minFolds: 1,
		maxFolds: 3,
		test: (polys) => {
			const area = polys.reduce((s, p) => s + polyArea(p.pts), 0);
			return Math.abs(area - startArea / 2) < startArea * 0.06;
		},
	});
	out.push({
		name: "Quarter the sheet",
		minFolds: 2,
		maxFolds: 4,
		test: (polys) => {
			const area = polys.reduce((s, p) => s + polyArea(p.pts), 0);
			return Math.abs(area - startArea / 4) < startArea * 0.05;
		},
	});
	out.push({
		name: "Triangular silhouette",
		minFolds: 1,
		maxFolds: 4,
		test: (polys) => {
			const allPts = polys.flatMap((p) => p.pts);
			if (allPts.length === 0) return false;
			const ys = allPts.map((p) => p.y);
			const minY = Math.min(...ys);
			const maxY = Math.max(...ys);
			return maxY - minY < SIZE * 0.62 && maxY - minY > SIZE * 0.3;
		},
	});
	const ratio = 0.18 + r() * 0.22;
	out.push({
		name: `Reduce to ${Math.round(ratio * 100)}% area`,
		minFolds: 2,
		maxFolds: 5,
		test: (polys) => {
			const area = polys.reduce((s, p) => s + polyArea(p.pts), 0);
			return Math.abs(area - startArea * ratio) < startArea * 0.05;
		},
	});
	out.push({
		name: "Narrow strip (aspect > 3:1)",
		minFolds: 2,
		maxFolds: 5,
		test: (polys) => {
			const allPts = polys.flatMap((p) => p.pts);
			if (allPts.length === 0) return false;
			const xs = allPts.map((p) => p.x);
			const ys = allPts.map((p) => p.y);
			const w = Math.max(...xs) - Math.min(...xs);
			const h = Math.max(...ys) - Math.min(...ys);
			const longer = Math.max(w, h);
			const shorter = Math.max(1, Math.min(w, h));
			return longer / shorter >= 3 && longer > SIZE * 0.3;
		},
	});
	return out;
}

const square = (): Pt[] => [
	{ x: ORIGIN.x - SIZE / 2, y: ORIGIN.y - SIZE / 2 },
	{ x: ORIGIN.x + SIZE / 2, y: ORIGIN.y - SIZE / 2 },
	{ x: ORIGIN.x + SIZE / 2, y: ORIGIN.y + SIZE / 2 },
	{ x: ORIGIN.x - SIZE / 2, y: ORIGIN.y + SIZE / 2 },
];

export default function Origami() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const targets = useMemo(() => genTargets(seed), [seed]);
	const [target, setTarget] = useState(0);
	const [history, setHistory] = useState<Poly[][]>([[{ pts: square(), color: "#e8d8a8" }]]);
	const polys = history[history.length - 1];
	const folds = history.length - 1;
	const [drag, setDrag] = useState<{ a: Pt; b: Pt | null } | null>(null);
	const [solved, setSolved] = useState<Set<number>>(new Set());
	const [best, setBest] = useState<number>(() => {
		const v = typeof localStorage !== "undefined" ? localStorage.getItem(BEST_KEY) : null;
		return v ? Number(v) : 0;
	});
	const svgRef = useRef<SVGSVGElement>(null);

	const toLocal = (e: React.MouseEvent): Pt => {
		const r = svgRef.current!.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	};

	const onDown = (e: React.MouseEvent) => setDrag({ a: toLocal(e), b: null });
	const onMove = (e: React.MouseEvent) => {
		if (drag) setDrag({ a: drag.a, b: toLocal(e) });
	};
	const onUp = (e: React.MouseEvent) => {
		const b = toLocal(e);
		if (!drag) return;
		const dx = b.x - drag.a.x;
		const dy = b.y - drag.a.y;
		if (Math.hypot(dx, dy) < 20) {
			setDrag(null);
			return;
		}
		const side: 1 | -1 = e.shiftKey ? -1 : 1;
		const next = foldPolygons(polys, drag.a, b, side);
		setHistory((h) => [...h, next]);
		setDrag(null);
		paperFold();
	};

	const reset = () => {
		setHistory([[{ pts: square(), color: "#e8d8a8" }]]);
		setSolved(new Set());
		blip(300, 0.06, "sine", 0.05);
	};
	const undo = () => {
		if (history.length <= 1) return;
		setHistory((h) => h.slice(0, -1));
		blip(220, 0.05, "triangle", 0.05);
	};

	const t = targets[target];
	const matches = useMemo(() => t.test(polys), [polys, t]);
	const within = folds >= t.minFolds && folds <= t.maxFolds;
	const solvedNow = matches && within;

	useEffect(() => {
		if (solvedNow && !solved.has(target)) {
			const ns = new Set(solved);
			ns.add(target);
			setSolved(ns);
			blip(660, 0.12, "triangle", 0.07);
			blip(990, 0.16, "sine", 0.06);
			const score = ns.size;
			if (score > best) {
				setBest(score);
				try {
					localStorage.setItem(BEST_KEY, String(score));
				} catch {
					/* ignore */
				}
			}
		}
	}, [solvedNow, target, solved, best]);

	const newPuzzle = () => {
		setSeed(Math.floor(Math.random() * 1e9));
		setTarget(0);
		reset();
	};

	const totalArea = useMemo(() => polys.reduce((s, p) => s + polyArea(p.pts), 0), [polys]);

	return (
		<div style={{ background: "#222", color: "#eee", padding: 16, fontFamily: "sans-serif" }}>
			<h2 style={{ margin: "0 0 4px" }}>Origami</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Drag across the sheet to fold. Shift+drag flips the other side. Each target has a fold budget.
			</div>
			<div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
				<div>Folds: {folds} (range {t.minFolds}-{t.maxFolds})</div>
				<div style={{ opacity: 0.7 }}>Area: {(totalArea / (SIZE * SIZE) * 100).toFixed(1)}%</div>
				<div>
					Target:{" "}
					<select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
						{targets.map((tg, i) => (
							<option key={i} value={i}>
								{solved.has(i) ? "✓ " : ""}{tg.name}
							</option>
						))}
					</select>
				</div>
				<button type="button" onClick={undo} disabled={history.length <= 1}>Undo</button>
				<button type="button" onClick={reset}>Reset</button>
				<button type="button" onClick={newPuzzle}>New Set</button>
				<div style={{ opacity: 0.7 }}>Solved: {solved.size}/{targets.length} · Best: {best}</div>
				{solvedNow && <div style={{ color: "#7f7" }}>MATCHED in {folds} folds!</div>}
				{matches && !within && <div style={{ color: "#fc6" }}>shape matches but folds out of range</div>}
			</div>
			<svg
				ref={svgRef}
				width={400}
				height={400}
				style={{ background: "#333", cursor: "crosshair" }}
				onMouseDown={onDown}
				onMouseMove={onMove}
				onMouseUp={onUp}
				onMouseLeave={() => setDrag(null)}
			>
				{polys.map((p, i) => (
					<polygon
						key={i}
						points={p.pts.map((q) => `${q.x},${q.y}`).join(" ")}
						fill={p.color}
						fillOpacity={0.7}
						stroke="#5a4a20"
						strokeWidth={1}
					/>
				))}
				{drag?.b && (
					<line
						x1={drag.a.x}
						y1={drag.a.y}
						x2={drag.b.x}
						y2={drag.b.y}
						stroke="#f55"
						strokeWidth={2}
						strokeDasharray="4 3"
					/>
				)}
			</svg>
		</div>
	);
}
