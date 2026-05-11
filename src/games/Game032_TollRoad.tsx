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
	progress: number; // 0..path.length
	speed: number;
	paid: number;
};

// Dijkstra over the grid: only cells with roads are traversable, cost = toll
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
			// reconstruct
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

export default function TollRoad() {
	const [grid, setGrid] = useState<Grid>(() => new Map());
	const [defaultToll, setDefaultToll] = useState(2);
	const [selected, setSelected] = useState<string | null>(null);
	const [revenue, setRevenue] = useState(0);
	const [turn, setTurn] = useState(0);
	const [cars, setCars] = useState<Car[]>([]);
	const [autoRun, setAutoRun] = useState(false);
	const [demand, setDemand] = useState<{ from: [number, number]; to: [number, number] } | null>(null);
	const idRef = useRef(0);

	// Pick a demand each turn from corner-ish to corner-ish
	useEffect(() => {
		const from: [number, number] = [Math.floor(Math.random() * 3), Math.floor(Math.random() * ROWS)];
		const to: [number, number] = [
			COLS - 1 - Math.floor(Math.random() * 3),
			Math.floor(Math.random() * ROWS),
		];
		setDemand({ from, to });
	}, [turn]);

	const tryDispatch = () => {
		if (!demand) return;
		const res = findPath(grid, demand.from, demand.to);
		if (!res) {
			setTurn((t) => t + 1);
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
				speed: 0.06,
				paid: res.cost,
			},
		]);
		setRevenue((r) => r + res.cost);
		setTurn((t) => t + 1);
	};

	// Animate cars
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

	// Autorun
	useEffect(() => {
		if (!autoRun) return;
		const id = setInterval(() => tryDispatch(), 1200);
		return () => clearInterval(id);
	}, [autoRun, demand, grid]);

	const onCellClick = (x: number, y: number, e: React.MouseEvent) => {
		const key = k(x, y);
		if (e.shiftKey) {
			setGrid((g) => {
				const ng = new Map(g);
				ng.delete(key);
				return ng;
			});
			setSelected(null);
			return;
		}
		if (!grid.has(key)) {
			setGrid((g) => {
				const ng = new Map(g);
				ng.set(key, { toll: defaultToll });
				return ng;
			});
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
	};

	const previewPath = useMemo(() => (demand ? findPath(grid, demand.from, demand.to) : null), [
		grid,
		demand,
	]);

	return (
		<div style={{ background: "#1a1f24", color: "#eee", padding: 16, fontFamily: "sans-serif" }}>
			<h2 style={{ margin: "0 0 4px" }}>Toll Road</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Click empty cells to place roads. Click a road to select, then +/- to set toll. Shift-click to remove.
			</div>
			<div style={{ display: "flex", gap: 12, marginBottom: 8, alignItems: "center" }}>
				<div>Turn: {turn}</div>
				<div>Revenue: ${revenue}</div>
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
						<div>
							Selected toll: ${grid.get(selected)?.toll ?? 0}
						</div>
						<button type="button" onClick={() => adjustToll(-1)}>
							-
						</button>
						<button type="button" onClick={() => adjustToll(1)}>
							+
						</button>
					</>
				)}
				<button type="button" onClick={tryDispatch}>
					Dispatch car
				</button>
				<button type="button" onClick={() => setAutoRun((a) => !a)}>
					{autoRun ? "Pause" : "Auto"}
				</button>
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
			<div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
				Demand: ({demand?.from.join(",")}) → ({demand?.to.join(",")}) ·{" "}
				{previewPath ? `route cost $${previewPath.cost}` : "no route!"}
			</div>
		</div>
	);
}
