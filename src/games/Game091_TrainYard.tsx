import { useEffect, useMemo, useState } from "react";

type Car = { id: number; color: string };
type Yard = { main: Car[]; sides: Car[][]; out: Car[] };
type TrackRef =
	| { kind: "main" }
	| { kind: "side"; idx: number }
	| { kind: "out" };

const PALETTE = [
	"#e63946",
	"#f4a261",
	"#e9c46a",
	"#2a9d8f",
	"#264653",
	"#a06cd5",
	"#4cc9f0",
	"#b5179e",
];

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function hashStr(s: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
function todayKey(): string {
	const d = new Date();
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
function shuffleSeeded<T>(a: T[], rng: () => number): T[] {
	const r = a.slice();
	for (let i = r.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[r[i], r[j]] = [r[j], r[i]];
	}
	return r;
}

type PuzzleConfig = { n: number; sideTracks: number; sideCap: number };

function makePuzzle(
	seed: number,
	cfg: PuzzleConfig,
): { start: Car[]; target: Car[] } {
	const rng = mulberry32(seed);
	const target: Car[] = Array.from({ length: cfg.n }, (_, i) => ({
		id: i,
		color: PALETTE[Math.floor(rng() * PALETTE.length)],
	}));
	let start = shuffleSeeded(target, rng);
	if (start.every((c, i) => c.id === target[i].id))
		start = shuffleSeeded(target, mulberry32(seed + 1));
	return { start, target };
}

function estimatePar(start: Car[], target: Car[]): number {
	let inversions = 0;
	for (let i = 0; i < start.length; i++)
		for (let j = i + 1; j < start.length; j++) {
			const a = target.findIndex((c) => c.id === start[i].id);
			const b = target.findIndex((c) => c.id === start[j].id);
			if (a > b) inversions++;
		}
	return target.length + Math.min(inversions, target.length);
}

let _ac: AudioContext | null = null;
function ac(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!_ac) {
		try {
			_ac = new (window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext)();
		} catch {
			return null;
		}
	}
	return _ac;
}
function chuff() {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const sz = Math.floor(c.sampleRate * 0.12);
	const b = c.createBuffer(1, sz, c.sampleRate);
	const data = b.getChannelData(0);
	for (let i = 0; i < sz; i++)
		data[i] = (Math.random() * 2 - 1) * (1 - i / sz) * 0.4;
	const src = c.createBufferSource();
	src.buffer = b;
	const g = c.createGain();
	g.gain.value = 0.5;
	const f = c.createBiquadFilter();
	f.type = "bandpass";
	f.frequency.value = 220;
	src.connect(f).connect(g).connect(c.destination);
	src.start(t);
	src.stop(t + 0.14);
}
function whistle() {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const o = c.createOscillator();
	const g = c.createGain();
	o.type = "square";
	o.frequency.setValueAtTime(880, t);
	o.frequency.exponentialRampToValueAtTime(1320, t + 0.5);
	g.gain.setValueAtTime(0.001, t);
	g.gain.exponentialRampToValueAtTime(0.18, t + 0.05);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
	o.connect(g).connect(c.destination);
	o.start(t);
	o.stop(t + 0.62);
}
function beep(freq: number, dur = 0.07, vol = 0.06) {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const o = c.createOscillator();
	const g = c.createGain();
	o.type = "triangle";
	o.frequency.value = freq;
	g.gain.setValueAtTime(0.001, t);
	g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
	g.gain.exponentialRampToValueAtTime(0.001, t + dur);
	o.connect(g).connect(c.destination);
	o.start(t);
	o.stop(t + dur + 0.02);
}

export default function Game091_TrainYard() {
	const [seedInput, setSeedInput] = useState<string>(() => todayKey());
	const [level, setLevel] = useState(0);
	const cfg: PuzzleConfig = useMemo(
		() => ({
			n: Math.min(8, 5 + level),
			sideTracks: 1 + Math.min(2, Math.floor(level / 2)),
			sideCap: 3,
		}),
		[level],
	);
	const seed = useMemo(
		() => hashStr(`${seedInput}|L${level}`),
		[seedInput, level],
	);
	const puzzle = useMemo(() => makePuzzle(seed, cfg), [seed, cfg]);
	const par = useMemo(() => estimatePar(puzzle.start, puzzle.target), [puzzle]);

	const [yard, setYard] = useState<Yard>(() => ({
		main: puzzle.start.slice(),
		sides: Array.from({ length: cfg.sideTracks }, () => []),
		out: [],
	}));
	const [moves, setMoves] = useState(0);
	const [history, setHistory] = useState<Yard[]>([]);
	const [selected, setSelected] = useState<TrackRef | null>(null);

	useEffect(() => {
		setYard({
			main: puzzle.start.slice(),
			sides: Array.from({ length: cfg.sideTracks }, () => []),
			out: [],
		});
		setMoves(0);
		setHistory([]);
		setSelected(null);
	}, [puzzle, cfg.sideTracks]);

	const won =
		yard.out.length === puzzle.target.length &&
		yard.out.every((c, i) => c.id === puzzle.target[i].id);

	const bestKey = `ty_best_${seedInput}_${level}`;
	const [best, setBest] = useState<number | null>(null);
	useEffect(() => {
		try {
			const v = localStorage.getItem(bestKey);
			setBest(v ? parseInt(v, 10) : null);
		} catch {}
	}, [bestKey]);
	useEffect(() => {
		if (!won) return;
		whistle();
		try {
			const prev = localStorage.getItem(bestKey);
			if (!prev || moves < parseInt(prev, 10)) {
				localStorage.setItem(bestKey, String(moves));
				setBest(moves);
			}
		} catch {}
	}, [won, moves, bestKey]);

	function popFrom(y: Yard, src: TrackRef): { car: Car | null; yard: Yard } {
		const ny: Yard = {
			main: y.main.slice(),
			sides: y.sides.map((s) => s.slice()),
			out: y.out.slice(),
		};
		if (src.kind === "main") {
			if (!ny.main.length) return { car: null, yard: y };
			const car = ny.main[ny.main.length - 1];
			ny.main.pop();
			return { car, yard: ny };
		}
		if (src.kind === "side") {
			const s = ny.sides[src.idx];
			if (!s.length) return { car: null, yard: y };
			const car = s[s.length - 1];
			ny.sides[src.idx] = s.slice(0, -1);
			return { car, yard: ny };
		}
		return { car: null, yard: y };
	}

	function attemptMove(from: TrackRef, to: TrackRef) {
		if (
			from.kind === to.kind &&
			(from.kind !== "side" ||
				(to.kind === "side" && from.idx === to.idx))
		)
			return;
		const { car, yard: y2 } = popFrom(yard, from);
		if (!car) return;
		if (to.kind === "side" && y2.sides[to.idx].length >= cfg.sideCap) {
			beep(160, 0.1, 0.05);
			return;
		}
		if (to.kind === "out") {
			const expected = puzzle.target[y2.out.length];
			if (!expected || car.id !== expected.id) {
				beep(160, 0.12, 0.06);
				return;
			}
		}
		setHistory((h) => [...h.slice(-30), yard]);
		const ny = y2;
		if (to.kind === "main") ny.main.push(car);
		else if (to.kind === "side")
			ny.sides[to.idx] = [...ny.sides[to.idx], car];
		else ny.out.push(car);
		setYard(ny);
		setMoves((m) => m + 1);
		setSelected(null);
		chuff();
	}

	function clickTrack(target: TrackRef) {
		if (!selected) {
			if (target.kind !== "out") {
				const arr =
					target.kind === "main" ? yard.main : yard.sides[target.idx];
				if (arr.length) {
					setSelected(target);
					beep(440, 0.05, 0.04);
				}
			}
			return;
		}
		attemptMove(selected, target);
	}

	function undo() {
		setHistory((h) => {
			if (!h.length) return h;
			setYard(h[h.length - 1]);
			setMoves((m) => Math.max(0, m - 1));
			return h.slice(0, -1);
		});
		setSelected(null);
	}

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "system-ui, sans-serif",
				color: "#222",
				background: "#fdf6e3",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 6px" }}>Train Yard</h2>
			<p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.7 }}>
				Click a track to pick up its rightmost car, then click another to drop
				it. Out only accepts cars in target order.
			</p>
			<div
				style={{
					display: "flex",
					gap: 10,
					alignItems: "center",
					marginBottom: 10,
					fontSize: 13,
				}}
			>
				<label>
					Seed:{" "}
					<input
						value={seedInput}
						onChange={(e) => setSeedInput(e.target.value)}
						style={{ width: 120 }}
					/>
				</label>
				<button onClick={() => setSeedInput(todayKey())}>Daily</button>
				<button
					onClick={() => setSeedInput(`r${Math.floor(Math.random() * 1e9)}`)}
				>
					Random
				</button>
				<span>
					Level {level + 1} · cars {cfg.n} · sides {cfg.sideTracks}
				</span>
				<button onClick={() => setLevel((l) => Math.max(0, l - 1))}>−</button>
				<button onClick={() => setLevel((l) => Math.min(7, l + 1))}>+</button>
			</div>

			<div style={{ marginBottom: 10, fontSize: 14 }}>
				<strong>Target order (left = first out):</strong>
				<div style={{ display: "flex", gap: 4, marginTop: 6 }}>
					{puzzle.target.map((c, i) => (
						<CarTile key={i} car={c} dim={i < yard.out.length} />
					))}
				</div>
			</div>

			<TrackClickable
				label={`Main (right = head)${
					selected?.kind === "main" ? " ← picked" : ""
				}`}
				cars={yard.main}
				onClick={() => clickTrack({ kind: "main" })}
				highlight={selected?.kind === "main"}
			/>
			{yard.sides.map((s, i) => (
				<TrackClickable
					key={i}
					label={`Side ${i + 1} (cap ${cfg.sideCap})${
						selected?.kind === "side" && selected.idx === i ? " ← picked" : ""
					}`}
					cars={s}
					onClick={() => clickTrack({ kind: "side", idx: i })}
					highlight={selected?.kind === "side" && selected.idx === i}
				/>
			))}
			<TrackClickable
				label="Out"
				cars={yard.out}
				onClick={() => clickTrack({ kind: "out" })}
				highlight={false}
			/>

			<div style={{ marginTop: 12, fontSize: 14 }}>
				<strong>{won ? `Solved in ${moves} moves!` : `Moves: ${moves}`}</strong>
				{" · "}par≈{par}
				{best != null && ` · best ${best}`}
				<button
					onClick={undo}
					style={{ marginLeft: 12 }}
					disabled={!history.length}
				>
					Undo
				</button>
				{won && (
					<button
						onClick={() => setLevel((l) => Math.min(7, l + 1))}
						style={{ marginLeft: 8 }}
					>
						Next level
					</button>
				)}
				<button
					onClick={() => {
						setYard({
							main: puzzle.start.slice(),
							sides: Array.from({ length: cfg.sideTracks }, () => []),
							out: [],
						});
						setMoves(0);
						setHistory([]);
						setSelected(null);
					}}
					style={{ marginLeft: 8 }}
				>
					Reset
				</button>
			</div>
		</div>
	);
}

function CarTile({ car, dim }: { car: Car; dim?: boolean }) {
	return (
		<div
			style={{
				width: 56,
				height: 36,
				background: car.color,
				color: "#fff",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				borderRadius: 4,
				fontWeight: 600,
				boxShadow: "0 1px 2px rgba(0,0,0,.2)",
				opacity: dim ? 0.3 : 1,
			}}
		>
			{car.id + 1}
		</div>
	);
}

function TrackClickable({
	label,
	cars,
	onClick,
	highlight,
}: {
	label: string;
	cars: Car[];
	onClick: () => void;
	highlight: boolean;
}) {
	return (
		<div style={{ margin: "8px 0" }}>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{label}</div>
			<button
				onClick={onClick}
				style={{
					display: "flex",
					gap: 4,
					padding: 8,
					background: highlight ? "#f4d35e" : "#eee2c0",
					borderRadius: 6,
					minHeight: 52,
					border: highlight ? "2px solid #e76f51" : "1px dashed #b8a16a",
					cursor: "pointer",
					width: "100%",
					textAlign: "left",
				}}
			>
				{cars.length === 0 ? (
					<span style={{ fontSize: 12, opacity: 0.5 }}>(empty)</span>
				) : (
					cars.map((c, i) => <CarTile key={i} car={c} />)
				)}
			</button>
		</div>
	);
}
