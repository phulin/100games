import { useMemo, useState } from "react";

// Lead a flock across a continent. A graph of rest stops with food/safety;
// edges have weather risks. Fixed travel days. Survive to the goal.

type Stop = {
	id: number;
	x: number;
	y: number;
	food: number; // 0..3
	safety: number; // 0..3
	name: string;
};

type Edge = { a: number; b: number; risk: number; closed?: boolean };

const NAMES = [
	"Reed",
	"Pine",
	"Marsh",
	"Cliff",
	"Bay",
	"Fen",
	"Glade",
	"Mire",
	"Heath",
	"Vale",
	"Cape",
	"Crag",
];

function mulberry32(seed: number) {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function genWorld(seed: number) {
	const rng = mulberry32(seed);
	const stops: Stop[] = [];
	const cols = 5;
	const rows = 3;
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const x = 60 + c * 130 + (rng() - 0.5) * 30;
			const y = 60 + r * 140 + (rng() - 0.5) * 30;
			stops.push({
				id: r * cols + c,
				x,
				y,
				food: Math.floor(rng() * 4),
				safety: Math.floor(rng() * 4),
				name: NAMES[(r * cols + c) % NAMES.length],
			});
		}
	}
	const edges: Edge[] = [];
	for (let i = 0; i < stops.length; i++) {
		for (let j = i + 1; j < stops.length; j++) {
			const d = Math.hypot(stops[i].x - stops[j].x, stops[i].y - stops[j].y);
			if (d < 180) edges.push({ a: i, b: j, risk: Math.floor(rng() * 4) });
		}
	}
	// start: leftmost; goal: rightmost
	let start = 0;
	let goal = 0;
	let bestSx = Infinity;
	let bestGx = -Infinity;
	for (const s of stops) {
		if (s.x < bestSx) {
			bestSx = s.x;
			start = s.id;
		}
		if (s.x > bestGx) {
			bestGx = s.x;
			goal = s.id;
		}
	}
	return { stops, edges, start, goal };
}

export default function Migration() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
	const world = useMemo(() => genWorld(seed), [seed]);
	const [current, setCurrent] = useState(world.start);
	const [flock, setFlock] = useState(20);
	const [days, setDays] = useState(0);
	const [visited, setVisited] = useState<number[]>([world.start]);
	const [edges, setEdges] = useState<Edge[]>(world.edges);
	const [msg, setMsg] = useState(
		"Pick a connected rest stop. Storms close routes each day.",
	);
	const [done, setDone] = useState<"win" | "lose" | "">("");
	const MAX_DAYS = 8;

	const reset = () => {
		const s = Math.floor(Math.random() * 1e6);
		setSeed(s);
		const w = genWorld(s);
		setCurrent(w.start);
		setFlock(20);
		setDays(0);
		setVisited([w.start]);
		setEdges(w.edges);
		setMsg("Pick a connected rest stop. Storms close routes each day.");
		setDone("");
	};

	const moveTo = (id: number) => {
		if (done) return;
		const edge = edges.find(
			(e) =>
				!e.closed &&
				((e.a === current && e.b === id) || (e.b === current && e.a === id)),
		);
		if (!edge) {
			setMsg("No open route there.");
			return;
		}
		const stop = world.stops[id];
		const loss = Math.max(0, edge.risk + (3 - stop.safety) - stop.food);
		const newFlock = Math.max(0, flock - loss);
		const newDays = days + 1;
		setFlock(newFlock);
		setDays(newDays);
		setCurrent(id);
		setVisited((v) => [...v, id]);
		// close a random edge each day to simulate weather
		const open = edges.filter((e) => !e.closed);
		const toClose = open[Math.floor(Math.random() * open.length)];
		const newEdges = edges.map((e) =>
			e === toClose ? { ...e, closed: true } : e,
		);
		setEdges(newEdges);
		if (id === world.goal) {
			if (newFlock > 0) {
				setDone("win");
				setMsg(`Arrived at ${stop.name}! ${newFlock} birds remain.`);
			} else {
				setDone("lose");
				setMsg("Flock perished on arrival.");
			}
		} else if (newFlock === 0) {
			setDone("lose");
			setMsg("The flock is gone.");
		} else if (newDays >= MAX_DAYS) {
			setDone("lose");
			setMsg("Winter caught you. You didn't make it.");
		} else {
			setMsg(`Rested at ${stop.name}. Lost ${loss} birds (risk ${edge.risk}).`);
		}
	};

	const W = 760;
	const H = 460;
	const score = done === "win" ? flock * 10 + (MAX_DAYS - days) * 5 : 0;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "linear-gradient(180deg,#3a4a3a,#1a221a)",
				color: "#e0f0d6",
				fontFamily: "Georgia, serif",
				padding: 16,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
			}}
		>
			<h2 style={{ margin: 0 }}>Migration</h2>
			<div style={{ fontSize: 13, opacity: 0.7 }}>
				Lead the flock to the eastern shore in {MAX_DAYS} days. Click a
				connected stop.
			</div>
			<svg
				width={W}
				height={H}
				style={{
					marginTop: 8,
					background: "#1d2a1c",
					borderRadius: 8,
					boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)",
				}}
			>
				{/* edges */}
				{edges.map((e) => {
					const a = world.stops[e.a];
					const b = world.stops[e.b];
					return (
						<line
							key={`${e.a}-${e.b}`}
							x1={a.x}
							y1={a.y}
							x2={b.x}
							y2={b.y}
							stroke={
								e.closed
									? "rgba(120,80,80,0.3)"
									: ["#6a8a6a", "#a8a86a", "#c08a5a", "#c05a5a"][e.risk]
							}
							strokeDasharray={e.closed ? "4 4" : undefined}
							strokeWidth={2}
						/>
					);
				})}
				{/* stops */}
				{world.stops.map((s) => {
					const isCur = s.id === current;
					const isGoal = s.id === world.goal;
					const isVis = visited.includes(s.id);
					return (
						<g
							key={s.id}
							onClick={() => moveTo(s.id)}
							style={{ cursor: "pointer" }}
						>
							<circle
								cx={s.x}
								cy={s.y}
								r={isCur ? 20 : 15}
								fill={
									isGoal
										? "#ffd250"
										: isCur
											? "#9bcc70"
											: isVis
												? "#5a7a4a"
												: "#3a4a3a"
								}
								stroke="#0a1a0a"
								strokeWidth={2}
							/>
							<text
								x={s.x}
								y={s.y - 22}
								textAnchor="middle"
								fontSize={11}
								fill="#e0f0d6"
							>
								{s.name}
							</text>
							<text
								x={s.x}
								y={s.y + 4}
								textAnchor="middle"
								fontSize={10}
								fill="#0a1a0a"
							>
								F{s.food} S{s.safety}
							</text>
						</g>
					);
				})}
			</svg>
			<div
				style={{
					marginTop: 8,
					display: "flex",
					gap: 24,
					fontSize: 14,
					alignItems: "center",
				}}
			>
				<div>Flock: {flock}</div>
				<div>
					Day: {days}/{MAX_DAYS}
				</div>
				<div style={{ fontStyle: "italic", maxWidth: 360 }}>{msg}</div>
				{done && (
					<button
						type="button"
						onClick={reset}
						style={{
							padding: "6px 12px",
							background: done === "win" ? "#9bcc70" : "#cc7070",
							color: "#000",
							border: "none",
							borderRadius: 3,
							cursor: "pointer",
						}}
					>
						New seed
					</button>
				)}
				{done === "win" && <div>Score: {score}</div>}
			</div>
		</div>
	);
}
