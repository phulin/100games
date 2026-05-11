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

type NPC = {
	id: number;
	age: "child" | "adult" | "elder";
	hat: boolean;
	color: string;
	liar: boolean;
	speed: number;
	lane: number;
};

const AGES: NPC["age"][] = ["child", "adult", "elder"];
const COLORS = ["red", "blue", "green", "yellow"];
const COLOR_HEX: Record<string, string> = { red: "#d04050", blue: "#3a78d0", green: "#3ec075", yellow: "#e4d040" };
const PASSES = 3;
const PER_PASS = 12;
const TOTAL = PASSES * PER_PASS;
const DURATION = 60;
const PASS_LEN = DURATION / PASSES;

function makeNPCs(seed: number): NPC[] {
	const rnd = mulberry32(seed);
	const arr: NPC[] = [];
	for (let i = 0; i < TOTAL; i++) {
		arr.push({
			id: i,
			age: AGES[Math.floor(rnd() * 3)],
			hat: rnd() < 0.5,
			color: COLORS[Math.floor(rnd() * 4)],
			liar: rnd() < 0.22,
			speed: 0.85 + rnd() * 0.5,
			lane: Math.floor(rnd() * 3),
		});
	}
	return arr;
}

let _ac: AudioContext | null = null;
function ac(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!_ac) {
		const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
		const Ctor = W.AudioContext ?? W.webkitAudioContext;
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

const BEST_KEY = "game087_census_best";

type Counts = { child: number; adult: number; elder: number; hat: number; red: number; blue: number; green: number; yellow: number };
const EMPTY_COUNTS: Counts = { child: 0, adult: 0, elder: 0, hat: 0, red: 0, blue: 0, green: 0, yellow: 0 };
const CK = Object.keys(EMPTY_COUNTS) as (keyof Counts)[];

export default function Game087_Census() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const npcs = useMemo(() => makeNPCs(seed), [seed]);
	const [running, setRunning] = useState(false);
	const [time, setTime] = useState(0);
	const [counts, setCounts] = useState<Counts>(EMPTY_COUNTS);
	const [submitted, setSubmitted] = useState(false);
	const [notes, setNotes] = useState("");
	const startRef = useRef(0);
	const lastPassRef = useRef(-1);
	const [best, setBest] = useState<number>(() => {
		if (typeof localStorage === "undefined") return -1;
		const v = localStorage.getItem(BEST_KEY);
		return v === null ? -1 : Number(v);
	});

	const pass = Math.min(PASSES - 1, Math.floor(time / PASS_LEN));

	useEffect(() => {
		if (!running) return;
		startRef.current = performance.now();
		let raf = 0;
		const tick = (t: number) => {
			const elapsed = (t - startRef.current) / 1000;
			setTime(elapsed);
			const p = Math.floor(elapsed / PASS_LEN);
			if (p !== lastPassRef.current && p > 0 && p <= PASSES) {
				lastPassRef.current = p;
				blip(330, 0.18, "triangle", 0.12);
			}
			if (elapsed >= DURATION) { setRunning(false); return; }
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [running]);

	const displayFor = (npc: NPC, p: number): NPC => {
		if (!npc.liar || p === 0) return npc;
		const rnd = mulberry32(npc.id * 977 + p * 311 + seed);
		return {
			...npc,
			age: AGES[Math.floor(rnd() * 3)],
			color: COLORS[Math.floor(rnd() * 4)],
			hat: rnd() < 0.5 ? !npc.hat : npc.hat,
		};
	};

	const visible = useMemo(() => {
		const out: { npc: NPC; x: number }[] = [];
		const inPass = (time % PASS_LEN) / PASS_LEN;
		const start = pass * PER_PASS;
		for (let i = 0; i < PER_PASS; i++) {
			const npc = npcs[start + i];
			if (!npc) continue;
			const offset = i / PER_PASS;
			const x = ((inPass - offset) * 1.6 * npc.speed + 1) % 1;
			if (x > 0 && x < 1) out.push({ npc, x });
		}
		return out;
	}, [npcs, pass, time]);

	const truth = useMemo(() => {
		const t: Counts = { ...EMPTY_COUNTS };
		for (const n of npcs) {
			t[n.age]++;
			if (n.hat) t.hat++;
			t[n.color as keyof Counts]++;
		}
		return t;
	}, [npcs]);

	const errFromCounts = (c: Counts) => {
		let err = 0;
		for (const k of CK) err += Math.abs(truth[k] - c[k]);
		return err;
	};

	const score = errFromCounts(counts);

	const start = () => {
		setSubmitted(false);
		setTime(0);
		setCounts(EMPTY_COUNTS);
		lastPassRef.current = -1;
		setRunning(true);
	};

	const newSeed = () => {
		setSeed(Math.floor(Math.random() * 1e9));
		setSubmitted(false);
		setTime(0);
		setCounts(EMPTY_COUNTS);
		setRunning(false);
	};

	const adjust = (k: keyof Counts, d: number) => {
		setCounts((c) => ({ ...c, [k]: Math.max(0, c[k] + d) }));
		blip(440 + (d > 0 ? 120 : -80), 0.05, "square", 0.06);
	};

	const submit = () => {
		setSubmitted(true);
		const err = errFromCounts(counts);
		if (best < 0 || err < best) {
			setBest(err);
			if (typeof localStorage !== "undefined") localStorage.setItem(BEST_KEY, String(err));
		}
		blip(err === 0 ? 880 : 220, 0.25, err === 0 ? "sine" : "sawtooth", 0.15);
	};

	return (
		<div style={{ fontFamily: "system-ui, sans-serif", color: "#eee", background: "#1a1a22", padding: 16, minHeight: 600 }}>
			<h2 style={{ margin: 0 }}>87. Census</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
				Count the townsfolk in three passes. Some lie — their look changes between passes. Use the notepad. Lowest error wins.
			</div>
			<div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
				<button type="button" onClick={start} style={btn}>{running ? "Restart" : "Begin"}</button>
				<button type="button" onClick={newSeed} disabled={running} style={btn}>New town</button>
				<div style={{ fontSize: 12 }}>Time {time.toFixed(1)}/{DURATION}s · Pass {Math.min(PASSES, pass + 1)}/{PASSES}</div>
				<div style={{ fontSize: 12, opacity: 0.8 }}>Best error: {best < 0 ? "—" : best}</div>
			</div>
			<div style={{ position: "relative", height: 180, background: "linear-gradient(#0b0b16,#181826)", border: "1px solid #333", borderRadius: 6, overflow: "hidden" }}>
				{[0, 1, 2].map((l) => (
					<div key={l} style={{ position: "absolute", left: 0, right: 0, top: 40 + l * 45, height: 1, background: "#2a2a36" }} />
				))}
				{visible.map(({ npc, x }) => {
					const d = displayFor(npc, pass);
					const size = d.age === "child" ? 20 : d.age === "elder" ? 28 : 32;
					return (
						<div key={npc.id} style={{ position: "absolute", left: `${x * 100}%`, top: 30 + npc.lane * 45, transform: "translateX(-50%)", textAlign: "center" }}>
							{d.hat && <div style={{ width: size + 2, height: 6, background: "#222", border: "1px solid #555", margin: "0 auto", borderRadius: 2 }} />}
							<div style={{ width: size, height: size, background: COLOR_HEX[d.color], borderRadius: "50%", border: "1px solid #000", margin: "0 auto" }} />
						</div>
					);
				})}
			</div>
			<div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
				<div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
					{CK.map((k) => (
						<div
							key={k}
							style={{
								background: "#252530",
								padding: 8,
								borderRadius: 4,
								minWidth: 86,
								borderLeft: ["red", "blue", "green", "yellow"].includes(k) ? `4px solid ${COLOR_HEX[k]}` : "4px solid #555",
							}}
						>
							<div style={{ fontSize: 11, opacity: 0.8 }}>{k}</div>
							<div style={{ display: "flex", alignItems: "center", gap: 4 }}>
								<button type="button" onClick={() => adjust(k, -1)} style={btn}>−</button>
								<div style={{ minWidth: 22, textAlign: "center", fontWeight: 600 }}>{counts[k]}</div>
								<button type="button" onClick={() => adjust(k, 1)} style={btn}>+</button>
							</div>
						</div>
					))}
				</div>
				<div style={{ minWidth: 200 }}>
					<div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4 }}>Notes / tally</div>
					<textarea
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="scratch tallies here"
						style={{
							width: "100%",
							minHeight: 70,
							background: "#0e0e16",
							color: "#eee",
							border: "1px solid #333",
							borderRadius: 4,
							padding: 6,
							fontFamily: "monospace",
							fontSize: 12,
							resize: "vertical",
						}}
					/>
				</div>
			</div>
			<div style={{ marginTop: 12 }}>
				<button type="button" onClick={submit} disabled={running} style={btn}>Submit census</button>
				{submitted && (
					<div style={{ marginTop: 8, fontSize: 13 }}>
						Total error: <strong>{score}</strong>{score === 0 ? " — flawless" : ""}.
						<div style={{ opacity: 0.85, marginTop: 4 }}>
							Truth: child {truth.child}, adult {truth.adult}, elder {truth.elder}, hat {truth.hat}, red {truth.red}, blue {truth.blue}, green {truth.green}, yellow {truth.yellow}.
						</div>
					</div>
				)}
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "4px 10px",
	background: "#345",
	color: "#fff",
	border: "1px solid #567",
	borderRadius: 4,
	cursor: "pointer",
};
