import { useEffect, useMemo, useRef, useState } from "react";

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

let _ac: AudioContext | null = null;
function ac(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!_ac) {
		const W2 = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
		const Ctor = W2.AudioContext ?? W2.webkitAudioContext;
		if (!Ctor) return null;
		_ac = new Ctor();
	}
	return _ac;
}
function blip(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.1) {
	const a = ac();
	if (!a) return;
	const o = a.createOscillator();
	const g = a.createGain();
	o.type = type;
	o.frequency.value = freq;
	g.gain.value = vol;
	g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
	o.connect(g).connect(a.destination);
	o.start();
	o.stop(a.currentTime + dur);
}

let _rumbleNode: { osc: OscillatorNode; gain: GainNode } | null = null;
function startRumble() {
	const a = ac();
	if (!a || _rumbleNode) return;
	const o = a.createOscillator();
	const g = a.createGain();
	o.type = "sawtooth";
	o.frequency.value = 55;
	g.gain.value = 0.0;
	o.connect(g).connect(a.destination);
	o.start();
	g.gain.linearRampToValueAtTime(0.05, a.currentTime + 0.5);
	_rumbleNode = { osc: o, gain: g };
}
function stopRumble() {
	const a = ac();
	if (!a || !_rumbleNode) return;
	const { osc, gain } = _rumbleNode;
	gain.gain.linearRampToValueAtTime(0, a.currentTime + 0.3);
	osc.stop(a.currentTime + 0.4);
	_rumbleNode = null;
}

const W = 60;
const H = 40;
const CELL = 14;

type Terrain = "rock" | "village" | "barrier" | "lava" | "cooled";

type State = {
	terrain: Terrain[];
	lavaAmt: Float32Array;
	elev: Float32Array;
	peakIdx: number;
};

function makeState(seed: number): State {
	const rnd = mulberry32(seed);
	const t: Terrain[] = new Array(W * H).fill("rock");
	const lavaAmt = new Float32Array(W * H);
	const elev = new Float32Array(W * H);
	const phA = rnd() * 6.28;
	const phB = rnd() * 6.28;
	const phC = rnd() * 6.28;
	for (let y = 0; y < H; y++) {
		for (let x = 0; x < W; x++) {
			const baseE = (H - y) / H;
			const ridge =
				0.05 * Math.sin(x * 0.4 + phA) +
				0.04 * Math.cos(y * 0.3 + x * 0.1 + phB) +
				0.06 * Math.sin((x + y) * 0.2 + phC) +
				0.02 * Math.sin(x * 0.07 - y * 0.11 + phA * 2);
			elev[y * W + x] = baseE + ridge;
		}
	}
	const villageCount = 4 + Math.floor(rnd() * 3);
	const placed: { x: number; y: number }[] = [];
	for (let i = 0; i < villageCount; i++) {
		for (let tries = 0; tries < 20; tries++) {
			const vx = 6 + Math.floor(rnd() * (W - 14));
			const vy = H - 4 - Math.floor(rnd() * 6);
			if (placed.some((p) => Math.abs(p.x - vx) < 5 && Math.abs(p.y - vy) < 3)) continue;
			placed.push({ x: vx, y: vy });
			for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) t[(vy + dy) * W + (vx + dx)] = "village";
			break;
		}
	}
	const peakX = Math.floor(W / 4 + rnd() * (W / 2));
	const peakY = 1;
	const peakIdx = peakY * W + peakX;
	lavaAmt[peakIdx] = 5;
	t[peakIdx] = "lava";
	return { terrain: t, lavaAmt, elev, peakIdx };
}

const BEST_KEY = "game088_volcano_best";

export default function Game088_Volcano() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [state, setState] = useState<State>(() => makeState(seed));
	const initialVillagesRef = useRef(0);
	useEffect(() => {
		initialVillagesRef.current = state.terrain.filter((c) => c === "village").length;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [seed]);
	const [barriers, setBarriers] = useState(20);
	const barriersRef = useRef(20);
	barriersRef.current = barriers;
	const [tick, setTick] = useState(0);
	const tickRef = useRef(0);
	tickRef.current = tick;
	const [running, setRunning] = useState(false);
	const [speed, setSpeed] = useState(200);
	const stateRef = useRef(state);
	stateRef.current = state;
	const paintRef = useRef<"place" | "remove" | null>(null);
	const [best, setBest] = useState<number>(() => {
		if (typeof localStorage === "undefined") return -1;
		const v = localStorage.getItem(BEST_KEY);
		return v === null ? -1 : Number(v);
	});

	useEffect(() => {
		if (!running) { stopRumble(); return; }
		startRumble();
		const id = setInterval(() => {
			const s = stateRef.current;
			const t = s.terrain.slice();
			const a = new Float32Array(s.lavaAmt);
			// Eruption emits lava for the first ~80 ticks then stops, so flows
			// can drain and the "lava cleared" win condition is actually reachable.
			if (tickRef.current < 80) a[s.peakIdx] += 1.5;
			const next = new Float32Array(a);
			for (let y = 0; y < H; y++) {
				for (let x = 0; x < W; x++) {
					const i = y * W + x;
					if (a[i] < 0.05) continue;
					if (t[i] === "barrier" || t[i] === "cooled") continue;
					const myE = s.elev[i] + a[i] * 0.1;
					const cands: { idx: number; drop: number }[] = [];
					const neigh = [[1, 0], [-1, 0], [0, 1], [0, -1]];
					for (const [dx, dy] of neigh) {
						const nx = x + dx;
						const ny = y + dy;
						if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
						const ni = ny * W + nx;
						if (t[ni] === "barrier" || t[ni] === "cooled") continue;
						const ne = s.elev[ni] + a[ni] * 0.1;
						if (ne < myE) cands.push({ idx: ni, drop: myE - ne });
					}
					if (cands.length === 0) continue;
					const sum = cands.reduce((acc2, c) => acc2 + c.drop, 0);
					const flow = Math.min(a[i] * 0.5, a[i] - 0.1);
					if (flow <= 0) continue;
					for (const c of cands) next[c.idx] += (flow * c.drop) / sum;
					next[i] -= flow;
				}
			}
			let villagesHit = 0;
			for (let i = 0; i < next.length; i++) {
				next[i] *= 0.985;
				if (next[i] > 0.3 && t[i] !== "barrier") {
					if (t[i] === "village") { villagesHit++; t[i] = "lava"; }
					else if (t[i] !== "village") t[i] = "lava";
				} else if (next[i] < 0.05 && t[i] === "lava") {
					t[i] = "cooled";
					next[i] = 0;
				}
			}
			if (villagesHit > 0) blip(140, 0.3, "sawtooth", 0.18);
			setState({ terrain: t, lavaAmt: next, elev: s.elev, peakIdx: s.peakIdx });
			setTick((tt) => tt + 1);
		}, speed);
		return () => clearInterval(id);
	}, [running, speed]);

	const lavaCells = state.terrain.filter((c) => c === "lava").length;
	const totalLava = useMemo(() => {
		let s = 0;
		for (let i = 0; i < state.lavaAmt.length; i++) s += state.lavaAmt[i];
		return s;
	}, [state.lavaAmt]);
	const villagesAlive = state.terrain.filter((c) => c === "village").length;

	useEffect(() => {
		if (!running) return;
		if (tick > 30 && totalLava < 0.5 && lavaCells === 0) {
			setRunning(false);
			const saved = villagesAlive;
			if (saved > best) {
				setBest(saved);
				if (typeof localStorage !== "undefined") localStorage.setItem(BEST_KEY, String(saved));
			}
			blip(523, 0.3, "sine", 0.18);
			setTimeout(() => blip(784, 0.4, "sine", 0.18), 150);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tick, totalLava, lavaCells]);

	const applyCell = (i: number, mode: "place" | "remove") => {
		// Read live values through refs: rapid drag fires many events per render,
		// and reading `state`/`barriers` from the closure makes each event see the
		// same stale snapshot, so only the last painted cell sticks.
		const cur = stateRef.current;
		if (mode === "place" && cur.terrain[i] === "rock") {
			if (barriersRef.current <= 0) return;
			const t = cur.terrain.slice();
			t[i] = "barrier";
			const ns = { ...cur, terrain: t };
			stateRef.current = ns;
			barriersRef.current -= 1;
			setBarriers(barriersRef.current);
			setState(ns);
			blip(620, 0.04, "square", 0.06);
		} else if (mode === "remove" && cur.terrain[i] === "barrier") {
			const t = cur.terrain.slice();
			t[i] = "rock";
			const ns = { ...cur, terrain: t };
			stateRef.current = ns;
			barriersRef.current += 1;
			setBarriers(barriersRef.current);
			setState(ns);
			blip(360, 0.04, "square", 0.06);
		}
	};

	const onCellDown = (i: number) => {
		const c = stateRef.current.terrain[i];
		if (c === "barrier") { paintRef.current = "remove"; applyCell(i, "remove"); }
		else if (c === "rock") { paintRef.current = "place"; applyCell(i, "place"); }
	};
	const onCellEnter = (i: number) => {
		if (!paintRef.current) return;
		applyCell(i, paintRef.current);
	};

	useEffect(() => {
		const up = () => { paintRef.current = null; };
		window.addEventListener("mouseup", up);
		return () => window.removeEventListener("mouseup", up);
	}, []);

	const reset = (s = seed) => {
		stopRumble();
		setSeed(s);
		const ns = makeState(s);
		stateRef.current = ns;
		setState(ns);
		barriersRef.current = 20;
		setBarriers(20);
		tickRef.current = 0;
		setTick(0);
		setRunning(false);
	};

	const newSeed = () => reset(Math.floor(Math.random() * 1e9));

	return (
		<div style={{ fontFamily: "system-ui, sans-serif", color: "#fee", background: "#100808", padding: 12, minHeight: 600, userSelect: "none" }}>
			<h2 style={{ margin: 0 }}>88. Volcano</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
				Click and drag on rock to paint barriers (gray) — they redirect lava but become permanent terrain. Click a barrier to remove. Save the villages (cyan).
			</div>
			<div style={{ display: "flex", gap: 12, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
				<button type="button" onClick={() => setRunning((r) => !r)} style={btn}>{running ? "Pause" : "Erupt"}</button>
				<button type="button" onClick={() => reset()} style={btn}>Reset</button>
				<button type="button" onClick={newSeed} style={btn}>New mountain</button>
				<label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
					Speed
					<input type="range" min={60} max={400} step={20} value={400 - speed + 60} onChange={(e) => setSpeed(400 - Number(e.target.value) + 60)} />
				</label>
				<div>Barriers: {barriers}</div>
				<div>Tick: {tick}</div>
				<div>Villages: {villagesAlive}/{initialVillagesRef.current || villagesAlive}</div>
				<div style={{ opacity: 0.85 }}>Best saved: {best < 0 ? "—" : best}</div>
			</div>
			<div
				onContextMenu={(e) => e.preventDefault()}
				style={{ display: "grid", gridTemplateColumns: `repeat(${W}, ${CELL}px)`, gap: 0 }}
			>
				{state.terrain.map((c, i) => {
					const lava = state.lavaAmt[i];
					let bg = "#444";
					if (c === "rock") {
						const e = state.elev[i];
						const shade = Math.floor(40 + e * 80);
						bg = `rgb(${shade},${shade - 5},${shade - 10})`;
					}
					if (c === "village") bg = "#3ec1c8";
					if (c === "barrier") bg = "#888";
					if (c === "cooled") bg = "#2a1810";
					if (c === "lava" || lava > 0.1) {
						const v = Math.min(1, lava / 3);
						bg = `rgb(${200 + v * 55},${80 - v * 40},${20})`;
					}
					return (
						<div
							key={i}
							onMouseDown={(e) => {
								e.preventDefault();
								if (e.button === 2) { if (state.terrain[i] === "barrier") applyCell(i, "remove"); }
								else onCellDown(i);
							}}
							onMouseEnter={() => onCellEnter(i)}
							style={{ width: CELL, height: CELL, background: bg }}
						/>
					);
				})}
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "4px 10px",
	background: "#5a2010",
	color: "#fff",
	border: "1px solid #8a4030",
	borderRadius: 4,
	cursor: "pointer",
};
