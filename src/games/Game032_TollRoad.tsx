import { useEffect, useMemo, useRef, useState } from "react";

const COLS = 10;
const ROWS = 8;
const CELL = 56;

type Road = { toll: number };
type Grid = Map<string, Road>;
const k = (x: number, y: number) => `${x},${y}`;

type Car = {
	id: number;
	from: [number, number];
	to: [number, number];
	path: [number, number][];
	progress: number;
	speed: number;
	paid: number;
};

type Demand = {
	from: [number, number];
	to: [number, number];
	willingness: number;
	patience: number;
};

const BEST_KEY = "game032_best_v2";

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

function findPath(grid: Grid, from: [number, number], to: [number, number]) {
	if (!grid.has(k(from[0], from[1])) || !grid.has(k(to[0], to[1]))) return null;
	const dist = new Map<string, number>();
	const prev = new Map<string, string>();
	const q: { key: string; d: number; x: number; y: number }[] = [];
	const startKey = k(from[0], from[1]);
	dist.set(startKey, grid.get(startKey)!.toll);
	q.push({ key: startKey, d: grid.get(startKey)!.toll, x: from[0], y: from[1] });
	while (q.length) {
		q.sort((a, b) => a.d - b.d);
		const cur = q.shift()!;
		if (cur.x === to[0] && cur.y === to[1]) {
			const path: [number, number][] = [];
			let key = cur.key;
			while (key) {
				const [x, y] = key.split(",").map(Number);
				path.unshift([x, y]);
				const p = prev.get(key);
				if (!p) break;
				key = p;
			}
			return { path, cost: cur.d };
		}
		if (cur.d > (dist.get(cur.key) ?? Infinity)) continue;
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		]) {
			const nx = cur.x + dx;
			const ny = cur.y + dy;
			const nk = k(nx, ny);
			if (!grid.has(nk)) continue;
			const nd = cur.d + grid.get(nk)!.toll;
			if (nd < (dist.get(nk) ?? Infinity)) {
				dist.set(nk, nd);
				prev.set(nk, cur.key);
				q.push({ key: nk, d: nd, x: nx, y: ny });
			}
		}
	}
	return null;
}

function genDemand(rng: () => number): Demand {
	const from: [number, number] = [Math.floor(rng() * 3), Math.floor(rng() * ROWS)];
	const to: [number, number] = [
		COLS - 1 - Math.floor(rng() * 3),
		Math.floor(rng() * ROWS),
	];
	const dist = Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]);
	const willingness = Math.max(6, dist + Math.floor(rng() * 10) + 4);
	const patience = Math.floor(willingness * (0.6 + rng() * 0.4));
	return { from, to, willingness, patience };
}

const TURN_LIMIT = 30;
const PLACE_COST = 1;

export default function TollRoad() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const rngRef = useRef<() => number>(mulberry32(seed));
	useEffect(() => {
		rngRef.current = mulberry32(seed);
	}, [seed]);

	const [grid, setGrid] = useState<Grid>(() => new Map());
	const [defaultToll, setDefaultToll] = useState(2);
	const [selected, setSelected] = useState<string | null>(null);
	const [revenue, setRevenue] = useState(0);
	const [budget, setBudget] = useState(20);
	const [turn, setTurn] = useState(0);
	const [cars, setCars] = useState<Car[]>([]);
	const [autoRun, setAutoRun] = useState(false);
	const [demand, setDemand] = useState<Demand | null>(null);
	const [lost, setLost] = useState<number>(0);
	const [log, setLog] = useState<string[]>([]);
	const [best, setBest] = useState<number>(() => {
		const v = typeof localStorage !== "undefined" ? localStorage.getItem(BEST_KEY) : null;
		return v ? Number(v) : 0;
	});
	const idRef = useRef(0);

	const reset = (s?: number) => {
		const ns = s ?? Math.floor(Math.random() * 1e9);
		setSeed(ns);
		rngRef.current = mulberry32(ns);
		setGrid(new Map());
		setSelected(null);
		setRevenue(0);
		setBudget(20);
		setTurn(0);
		setCars([]);
		setLost(0);
		setLog([]);
		setDemand(genDemand(rngRef.current));
		setAutoRun(false);
	};

	useEffect(() => {
		if (!demand) setDemand(genDemand(rngRef.current));
	}, [demand]);

	const tryDispatch = () => {
		if (!demand || turn >= TURN_LIMIT) return;
		const res = findPath(grid, demand.from, demand.to);
		const nextDemand = genDemand(rngRef.current);
		if (!res || res.cost > demand.willingness || res.cost > demand.patience) {
			setLost((l) => l + 1);
			setLog((L) => [
				(res
					? `Turn ${turn + 1}: route $${res.cost} > ${Math.min(demand.willingness, demand.patience)} (lost to competitor)`
					: `Turn ${turn + 1}: no route, customer lost`),
				...L,
			].slice(0, 8));
			blip(160, 0.15, "sawtooth", 0.05);
			setTurn((t) => t + 1);
			setDemand(nextDemand);
			return;
		}
		setCars((cs) => [
			...cs,
			{
				id: idRef.current++,
				from: demand.from,
				to: demand.to,
				path: res.path,
				progress: 0,
				speed: 0.08,
				paid: res.cost,
			},
		]);
		setRevenue((r) => r + res.cost);
		setLog((L) => [`Turn ${turn + 1}: +$${res.cost} (max $${demand.patience})`, ...L].slice(0, 8));
		blip(540, 0.08, "triangle", 0.07);
		blip(720, 0.06, "sine", 0.05);
		setTurn((t) => t + 1);
		setDemand(nextDemand);
	};

	useEffect(() => {
		let raf = 0;
		const tick = () => {
			setCars((cs) =>
				cs
					.map((c) => ({ ...c, progress: c.progress + c.speed }))
					.filter((c) => c.progress < c.path.length - 0.01),
			);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	useEffect(() => {
		if (!autoRun) return;
		const id = setInterval(() => tryDispatch(), 1100);
		return () => clearInterval(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [autoRun, demand, grid, turn]);

	const onCellClick = (x: number, y: number, e: React.MouseEvent) => {
		const key = k(x, y);
		if (e.shiftKey) {
			setGrid((g) => {
				const ng = new Map(g);
				if (ng.delete(key)) setBudget((b) => b + PLACE_COST);
				return ng;
			});
			setSelected(null);
			return;
		}
		if (!grid.has(key)) {
			if (budget < PLACE_COST) {
				blip(120, 0.12, "square", 0.05);
				return;
			}
			setGrid((g) => {
				const ng = new Map(g);
				ng.set(key, { toll: defaultToll });
				return ng;
			});
			setBudget((b) => b - PLACE_COST);
			blip(360, 0.05, "sine", 0.04);
		}
		setSelected(key);
	};

	const adjustToll = (delta: number) => {
		if (!selected) return;
		setGrid((g) => {
			const ng = new Map(g);
			const r = ng.get(selected);
			if (r) ng.set(selected, { toll: Math.max(0, r.toll + delta) });
			return ng;
		});
		blip(delta > 0 ? 520 : 380, 0.04, "sine", 0.04);
	};

	const previewPath = useMemo(
		() => (demand ? findPath(grid, demand.from, demand.to) : null),
		[grid, demand],
	);

	const gameOver = turn >= TURN_LIMIT;
	useEffect(() => {
		if (gameOver && revenue > best) {
			setBest(revenue);
			try {
				localStorage.setItem(BEST_KEY, String(revenue));
			} catch {
				/* ignore */
			}
		}
	}, [gameOver, revenue, best]);

	return (
		<div style={{ background: "#1a1f24", color: "#eee", padding: 16, fontFamily: "sans-serif" }}>
			<h2 style={{ margin: "0 0 4px" }}>Toll Road</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Place roads ($1 each from budget). Set tolls. Each turn a customer arrives with a max they'll pay;
				price too high and they take a competitor route. Maximize revenue in {TURN_LIMIT} turns.
			</div>
			<div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
				<div>Turn: {turn}/{TURN_LIMIT}</div>
				<div>Revenue: ${revenue}</div>
				<div>Budget: ${budget}</div>
				<div style={{ opacity: 0.7 }}>Lost: {lost}</div>
				<div style={{ opacity: 0.7 }}>Best: ${best}</div>
				<div>
					Default toll:{" "}
					<input
						type="number"
						value={defaultToll}
						min={0}
						onChange={(e) => setDefaultToll(Number(e.target.value))}
						style={{ width: 50 }}
					/>
				</div>
				{selected && (
					<>
						<div>Selected toll: ${grid.get(selected)?.toll ?? 0}</div>
						<button type="button" onClick={() => adjustToll(-1)}>-</button>
						<button type="button" onClick={() => adjustToll(1)}>+</button>
					</>
				)}
				<button type="button" onClick={tryDispatch} disabled={gameOver}>
					Dispatch customer
				</button>
				<button type="button" onClick={() => setAutoRun((a) => !a)} disabled={gameOver}>
					{autoRun ? "Pause" : "Auto"}
				</button>
				<button type="button" onClick={() => reset()}>
					New game
				</button>
				{gameOver && <span style={{ color: "#7f7" }}>GAME OVER · ${revenue}</span>}
			</div>
			<svg width={COLS * CELL} height={ROWS * CELL} style={{ background: "#0d1014" }}>
				{Array.from({ length: ROWS }, (_, y) =>
					Array.from({ length: COLS }, (_, x) => {
						const key = k(x, y);
						const r = grid.get(key);
						const isSel = selected === key;
						const isPreview = previewPath?.path.some(([px, py]) => px === x && py === y);
						return (
							<g key={key} onClick={(e) => onCellClick(x, y, e)} style={{ cursor: "pointer" }}>
								<rect
									x={x * CELL}
									y={y * CELL}
									width={CELL - 1}
									height={CELL - 1}
									fill={r ? "#555" : "#222"}
									stroke={isSel ? "#ff0" : isPreview ? "#6cf" : "#111"}
									strokeWidth={isSel || isPreview ? 2 : 1}
								/>
								{r && (
									<text
										x={x * CELL + CELL / 2}
										y={y * CELL + CELL / 2 + 4}
										fill="#fff"
										fontSize={14}
										textAnchor="middle"
									>
										${r.toll}
									</text>
								)}
							</g>
						);
					}),
				)}
				{demand && (
					<>
						<circle cx={demand.from[0] * CELL + CELL / 2} cy={demand.from[1] * CELL + CELL / 2} r={8} fill="#6f6" />
						<circle cx={demand.to[0] * CELL + CELL / 2} cy={demand.to[1] * CELL + CELL / 2} r={8} fill="#f66" />
					</>
				)}
				{cars.map((c) => {
					const i = Math.min(Math.floor(c.progress), c.path.length - 1);
					const frac = c.progress - i;
					const a = c.path[i];
					const b = c.path[Math.min(i + 1, c.path.length - 1)];
					const cx = (a[0] + (b[0] - a[0]) * frac) * CELL + CELL / 2;
					const cy = (a[1] + (b[1] - a[1]) * frac) * CELL + CELL / 2;
					return <circle key={c.id} cx={cx} cy={cy} r={6} fill="#fc6" />;
				})}
			</svg>
			<div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
				{demand && (
					<>
						Demand ({demand.from.join(",")}) → ({demand.to.join(",")}) · will pay up to <b>${demand.willingness}</b>{" "}
						· competitor route <b>${demand.patience}</b> ·{" "}
						{previewPath ? `your route $${previewPath.cost}` : "no route!"}
					</>
				)}
			</div>
			<div style={{ marginTop: 8, fontSize: 11, opacity: 0.7, fontFamily: "monospace", maxHeight: 110, overflow: "auto" }}>
				{log.map((l, i) => (
					<div key={i}>{l}</div>
				))}
			</div>
		</div>
	);
}
