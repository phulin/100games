import { useEffect, useMemo, useRef, useState } from "react";

// Migration — lead a flock across a continent. Fully seeded: weather, edge
// closures, stops and name pool are derived from a single seed via mulberry32.
// New: forecast preview, scouting, audio, route highlight, deterministic
// weather (no Math.random per move).

type Stop = {
	id: number;
	x: number;
	y: number;
	food: number;
	safety: number;
	name: string;
};

type Edge = { a: number; b: number; risk: number; closed?: boolean };

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const SYL = ["reed", "pine", "fen", "marsh", "cliff", "bay", "glade", "mire", "heath", "vale", "cape", "crag", "moor", "tarn", "ridge", "wold", "holt", "shaw"];
function genName(rng: () => number): string {
	const a = SYL[Math.floor(rng() * SYL.length)];
	if (rng() < 0.5) return a.charAt(0).toUpperCase() + a.slice(1);
	const b = SYL[Math.floor(rng() * SYL.length)];
	return a.charAt(0).toUpperCase() + a.slice(1) + b;
}

function genWorld(seed: number) {
	const rng = mulberry32(seed);
	const stops: Stop[] = [];
	const cols = 5;
	const rows = 3;
	const used = new Set<string>();
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			const x = 60 + c * 130 + (rng() - 0.5) * 30;
			const y = 60 + r * 140 + (rng() - 0.5) * 30;
			let name = genName(rng);
			let guard = 0;
			while (used.has(name) && guard < 20) { name = genName(rng); guard++; }
			used.add(name);
			stops.push({
				id: r * cols + c, x, y,
				food: Math.floor(rng() * 4),
				safety: Math.floor(rng() * 4),
				name,
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
	let start = 0, goal = 0, bestSx = Infinity, bestGx = -Infinity;
	for (const s of stops) {
		if (s.x < bestSx) { bestSx = s.x; start = s.id; }
		if (s.x > bestGx) { bestGx = s.x; goal = s.id; }
	}
	return { stops, edges, start, goal };
}

function genForecast(seed: number, edgeCount: number, days: number): number[] {
	const rng = mulberry32(seed ^ 0xfeedbeef);
	const out: number[] = [];
	for (let d = 0; d < days; d++) out.push(Math.floor(rng() * edgeCount));
	return out;
}

function useAudio() {
	const ctxRef = useRef<AudioContext | null>(null);
	const ensure = () => {
		if (ctxRef.current) return ctxRef.current;
		const Ctor =
			(window as unknown as { AudioContext: typeof AudioContext }).AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		ctxRef.current = new Ctor();
		return ctxRef.current;
	};
	useEffect(() => () => { ctxRef.current?.close(); }, []);
	const play = (freq: number, dur = 0.18, type: OscillatorType = "sine", vol = 0.12) => {
		const ctx = ensure();
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type; o.frequency.value = freq;
		o.connect(g); g.connect(ctx.destination);
		const t = ctx.currentTime;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		o.start(t); o.stop(t + dur + 0.02);
	};
	return play;
}

export default function Migration() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const world = useMemo(() => genWorld(seed), [seed]);
	const MAX_DAYS = 8;
	const forecast = useMemo(() => genForecast(seed, world.edges.length, MAX_DAYS), [seed, world.edges.length]);

	const [current, setCurrent] = useState(world.start);
	const [flock, setFlock] = useState(20);
	const [days, setDays] = useState(0);
	const [visited, setVisited] = useState<number[]>([world.start]);
	const [path, setPath] = useState<Array<[number, number]>>([]);
	const [edges, setEdges] = useState<Edge[]>(world.edges);
	const [scouts, setScouts] = useState(2);
	const [scouted, setScouted] = useState<Set<number>>(new Set());
	const [msg, setMsg] = useState("Pick a connected rest stop. Shift-click to scout.");
	const [done, setDone] = useState<"win" | "lose" | "">("");
	const [hoverEdge, setHoverEdge] = useState<string | null>(null);
	const play = useAudio();

	const reset = () => {
		const s = Math.floor(Math.random() * 1e9);
		setSeed(s);
		const w = genWorld(s);
		setCurrent(w.start); setFlock(20); setDays(0);
		setVisited([w.start]); setPath([]); setEdges(w.edges);
		setScouts(2); setScouted(new Set());
		setMsg("New continent. Scout to peek.");
		setDone("");
	};

	const moveTo = (id: number) => {
		if (done) return;
		const edge = edges.find(
			(e) => !e.closed && ((e.a === current && e.b === id) || (e.b === current && e.a === id))
		);
		if (!edge) { setMsg("No open route there."); play(180, 0.12, "square"); return; }
		const stop = world.stops[id];
		const loss = Math.max(0, edge.risk + (3 - stop.safety) - stop.food);
		const newFlock = Math.max(0, flock - loss);
		const newDays = days + 1;
		setFlock(newFlock); setDays(newDays); setCurrent(id);
		setVisited((v) => [...v, id]);
		setPath((p) => [...p, [current, id]]);
		const idx = forecast[days];
		const newEdges = edges.map((e, i) => (i === idx && !e.closed ? { ...e, closed: true } : e));
		setEdges(newEdges);
		play(loss > 0 ? 260 - loss * 30 : 520, 0.18, loss > 1 ? "sawtooth" : "sine");
		if (id === world.goal) {
			if (newFlock > 0) {
				setDone("win");
				setMsg(`Arrived at ${stop.name}! ${newFlock} birds remain.`);
				play(660, 0.4, "sine", 0.18);
			} else {
				setDone("lose"); setMsg("Flock perished on arrival.");
			}
		} else if (newFlock === 0) {
			setDone("lose"); setMsg("The flock is gone.");
		} else if (newDays >= MAX_DAYS) {
			setDone("lose"); setMsg("Winter caught you.");
		} else {
			setMsg(`Rested at ${stop.name}. Lost ${loss} birds (risk ${edge.risk}).`);
		}
	};

	const scout = (id: number) => {
		if (done || scouts <= 0 || scouted.has(id)) return;
		setScouts((s) => s - 1);
		setScouted((s) => new Set([...s, id]));
		const stop = world.stops[id];
		setMsg(`Scout reports ${stop.name}: food ${stop.food}, safety ${stop.safety}.`);
		play(440, 0.1, "triangle", 0.08);
	};

	const W = 760, H = 460;
	const score = done === "win" ? flock * 10 + (MAX_DAYS - days) * 5 : 0;

	const upcoming = new Set(forecast.slice(days, days + 3));

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
				Lead the flock east in {MAX_DAYS} days. Shift-click a stop to scout. Seed {seed}.
			</div>
			<svg
				width={W} height={H}
				style={{
					marginTop: 6,
					background: "#1d2a1c",
					borderRadius: 8,
					boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)",
				}}
			>
				{path.map(([a, b], i) => {
					const A = world.stops[a], B = world.stops[b];
					return (
						<line
							key={`path-${i}-${a}-${b}`}
							x1={A.x} y1={A.y} x2={B.x} y2={B.y}
							stroke="#ffd250" strokeWidth={4} opacity={0.4}
						/>
					);
				})}
				{edges.map((e, i) => {
					const a = world.stops[e.a]; const b = world.stops[e.b];
					const key = `${e.a}-${e.b}`;
					const upcomingHere = upcoming.has(i);
					return (
						<line
							key={key}
							x1={a.x} y1={a.y} x2={b.x} y2={b.y}
							stroke={
								e.closed ? "rgba(120,80,80,0.3)" :
								upcomingHere ? "#aa66cc" :
								["#6a8a6a", "#a8a86a", "#c08a5a", "#c05a5a"][e.risk]
							}
							strokeDasharray={e.closed ? "4 4" : upcomingHere ? "6 3" : undefined}
							strokeWidth={hoverEdge === key ? 4 : 2}
							onMouseEnter={() => setHoverEdge(key)}
							onMouseLeave={() => setHoverEdge(null)}
						>
							<title>
								{e.closed ? "Closed" : `Risk ${e.risk}${upcomingHere ? " · storm incoming" : ""}`}
							</title>
						</line>
					);
				})}
				{world.stops.map((s) => {
					const isCur = s.id === current;
					const isGoal = s.id === world.goal;
					const isVis = visited.includes(s.id);
					const isScouted = scouted.has(s.id) || isVis || isCur;
					return (
						<g
							key={s.id}
							onClick={(e) => { if (e.shiftKey) scout(s.id); else moveTo(s.id); }}
							style={{ cursor: "pointer" }}
						>
							<circle
								cx={s.x} cy={s.y}
								r={isCur ? 20 : 15}
								fill={isGoal ? "#ffd250" : isCur ? "#9bcc70" : isVis ? "#5a7a4a" : "#3a4a3a"}
								stroke={isScouted ? "#ffeeaa" : "#0a1a0a"}
								strokeWidth={2}
							/>
							<text x={s.x} y={s.y - 22} textAnchor="middle" fontSize={11} fill="#e0f0d6">
								{s.name}
							</text>
							<text x={s.x} y={s.y + 4} textAnchor="middle" fontSize={10} fill="#0a1a0a">
								{isScouted ? `F${s.food} S${s.safety}` : "?"}
							</text>
						</g>
					);
				})}
			</svg>
			<div style={{ marginTop: 8, display: "flex", gap: 18, fontSize: 14, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
				<div>Flock: {flock}</div>
				<div>Day: {days}/{MAX_DAYS}</div>
				<div>Scouts: {scouts}</div>
				<div style={{ fontStyle: "italic", maxWidth: 320 }}>{msg}</div>
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
			<div style={{ marginTop: 4, fontSize: 11, opacity: 0.6 }}>
				Purple dashed = storm closing in 3 days · Shift-click to scout (2 free)
			</div>
		</div>
	);
}
