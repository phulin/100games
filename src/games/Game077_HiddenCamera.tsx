import { useEffect, useMemo, useRef, useState } from "react";

// Game 77 — Hidden Camera
// Procedural scene: variable sprites, events, room layouts.
// Audio cues at event time. Hint button costs points. Best score persisted.

type Sprite = {
	id: number;
	name: string;
	color: string;
	keyframes: Array<{ t: number; x: number; y: number; holding?: string }>;
};

type EventSpec = { id: string; label: string; time: number; tolerance: number; sound: number };

type Scene = {
	sprites: Sprite[];
	events: EventSpec[];
	rooms: Array<{ x: number; y: number; w: number; h: number; label: string }>;
	bgTint: string;
};

const DURATION = 60;
const BEST_KEY = "hcamera:best";

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

const EVENT_POOL: ReadonlyArray<{ id: string; label: string; freq: number }> = [
	{ id: "wallet", label: "Wallet was taken", freq: 220 },
	{ id: "door", label: "Door opened", freq: 90 },
	{ id: "lights", label: "Lights flickered", freq: 1200 },
	{ id: "dog", label: "Dog barked", freq: 320 },
	{ id: "glass", label: "Glass broke", freq: 1800 },
	{ id: "phone", label: "Phone rang", freq: 680 },
	{ id: "knock", label: "Someone knocked", freq: 140 },
	{ id: "footsteps", label: "Footsteps in hall", freq: 200 },
	{ id: "window", label: "Window opened", freq: 110 },
	{ id: "vase", label: "Vase fell", freq: 540 },
];

const NAMES = ["Alex", "Bria", "Cory", "Dana", "Erin", "Finn", "Glo", "Hale", "Ines", "Jules"];
const COLORS = ["#e89", "#8df", "#cf9", "#fa6", "#bb8", "#9af", "#fc8"];

function makeScene(seed: number, difficulty: number): Scene {
	const rnd = mulberry32(seed);
	const nSprites = 2 + Math.floor(rnd() * Math.min(3, 1 + difficulty / 2));
	const nEvents = 3 + Math.floor(rnd() * 4) + Math.floor(difficulty / 2);
	const sprites: Sprite[] = [];
	for (let i = 0; i < nSprites; i++) {
		const path: Array<{ t: number; x: number; y: number; holding?: string }> = [];
		let t = 0;
		path.push({ t, x: 50 + rnd() * 800, y: 80 + rnd() * 220 });
		while (t < DURATION) {
			t += 4 + rnd() * 10;
			if (t > DURATION) t = DURATION;
			path.push({ t, x: 50 + rnd() * 800, y: 80 + rnd() * 220 });
		}
		sprites.push({
			id: i,
			name:
				NAMES[(Math.floor(rnd() * NAMES.length) + i) % NAMES.length] +
				" " +
				String.fromCharCode(65 + i),
			color: COLORS[i % COLORS.length],
			keyframes: path,
		});
	}

	const pool = EVENT_POOL.slice();
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	const events: EventSpec[] = [];
	const used: number[] = [];
	for (let i = 0; i < Math.min(nEvents, pool.length); i++) {
		const p = pool[i];
		let t = 0;
		for (let tries = 0; tries < 6; tries++) {
			t = 4 + rnd() * (DURATION - 8);
			if (!used.some((u) => Math.abs(u - t) < 2.5)) break;
		}
		used.push(t);
		events.push({ id: p.id, label: p.label, time: t, tolerance: 2, sound: p.freq });
	}
	for (const ev of events) {
		if (ev.id === "wallet" || ev.id === "vase") {
			const s = sprites[Math.floor(rnd() * sprites.length)];
			for (const kf of s.keyframes) {
				if (kf.t >= ev.time) kf.holding = ev.id;
			}
		}
	}

	const rooms = [
		{ x: 540 + rnd() * 80, y: 50, w: 60, h: 90, label: "door" },
		{ x: 280 + rnd() * 80, y: 230, w: 90, h: 50, label: "table" },
		{ x: 100 + rnd() * 80, y: 60, w: 80, h: 60, label: "window" },
	];

	const bgTint = `hsl(${Math.floor(rnd() * 360)}, 14%, 12%)`;
	return { sprites, events, rooms, bgTint };
}

function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

function spriteAt(s: Sprite, t: number) {
	const kf = s.keyframes;
	for (let i = 0; i < kf.length - 1; i++) {
		if (t >= kf[i].t && t <= kf[i + 1].t) {
			const lt = (t - kf[i].t) / Math.max(0.01, kf[i + 1].t - kf[i].t);
			return {
				x: lerp(kf[i].x, kf[i + 1].x, lt),
				y: lerp(kf[i].y, kf[i + 1].y, lt),
				holding: kf[i + 1].holding ?? kf[i].holding,
			};
		}
	}
	const last = kf[kf.length - 1];
	return { x: last.x, y: last.y, holding: last.holding };
}

class CamAudio {
	private ctx: AudioContext | null = null;
	private ensure() {
		if (!this.ctx) {
			try {
				this.ctx = new AudioContext();
			} catch {
				return null;
			}
		}
		if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
		return this.ctx;
	}
	chirp(freq: number, dur = 0.18) {
		const c = this.ensure();
		if (!c) return;
		const o = c.createOscillator();
		const g = c.createGain();
		o.type = "sine";
		o.frequency.setValueAtTime(freq, c.currentTime);
		o.frequency.exponentialRampToValueAtTime(freq * 0.7, c.currentTime + dur);
		g.gain.setValueAtTime(0.0001, c.currentTime);
		g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
		o.connect(g).connect(c.destination);
		o.start();
		o.stop(c.currentTime + dur + 0.05);
	}
	scrub() {
		const c = this.ensure();
		if (!c) return;
		const o = c.createOscillator();
		const g = c.createGain();
		o.type = "square";
		o.frequency.value = 90;
		g.gain.setValueAtTime(0.0001, c.currentTime);
		g.gain.exponentialRampToValueAtTime(0.04, c.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.06);
		o.connect(g).connect(c.destination);
		o.start();
		o.stop(c.currentTime + 0.08);
	}
}

export default function Game077_HiddenCamera() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [difficulty, setDifficulty] = useState(1);
	const scene = useMemo(() => makeScene(seed, difficulty), [seed, difficulty]);
	const [time, setTime] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [speed, setSpeed] = useState(1);
	const [guesses, setGuesses] = useState<Record<string, number>>({});
	const [submitted, setSubmitted] = useState(false);
	const [hintsUsed, setHintsUsed] = useState(0);
	const [revealedHints, setRevealedHints] = useState<Record<string, true>>({});
	const last = useRef<number | null>(null);
	const playedEvents = useRef<Set<string>>(new Set());
	const audio = useRef(new CamAudio());

	const [best, setBest] = useState<number>(() => {
		try {
			return parseInt(localStorage.getItem(BEST_KEY) || "0") || 0;
		} catch {
			return 0;
		}
	});

	useEffect(() => {
		setTime(0);
		setGuesses({});
		setSubmitted(false);
		setHintsUsed(0);
		setRevealedHints({});
		playedEvents.current = new Set();
	}, [seed]);

	useEffect(() => {
		if (!playing) return;
		let raf = 0;
		const step = (ts: number) => {
			if (last.current == null) last.current = ts;
			const dt = ((ts - last.current) / 1000) * speed;
			last.current = ts;
			setTime((t) => {
				const nt = t + dt;
				for (const e of scene.events) {
					if (!playedEvents.current.has(e.id) && t < e.time && nt >= e.time) {
						playedEvents.current.add(e.id);
						audio.current.chirp(e.sound);
					}
				}
				if (nt >= DURATION) {
					setPlaying(false);
					return DURATION;
				}
				return nt;
			});
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => {
			cancelAnimationFrame(raf);
			last.current = null;
		};
	}, [playing, scene, speed]);

	const onScrub = (v: number) => {
		setTime(v);
		audio.current.scrub();
		const np = new Set<string>();
		for (const e of scene.events) if (e.time <= v) np.add(e.id);
		playedEvents.current = np;
	};

	const setGuess = (id: string) => {
		setGuesses((g) => ({ ...g, [id]: time }));
	};

	const useHint = (id: string) => {
		if (revealedHints[id] || submitted) return;
		setHintsUsed((h) => h + 1);
		setRevealedHints((r) => ({ ...r, [id]: true }));
	};

	const computeScore = () => {
		let s = 0;
		for (const e of scene.events) {
			const g = guesses[e.id];
			if (g == null) continue;
			const err = Math.abs(g - e.time);
			s += Math.max(0, 100 - (err / e.tolerance) * 50);
		}
		return Math.max(0, Math.round(s - hintsUsed * 25));
	};

	const submit = () => {
		setSubmitted(true);
		const s = computeScore();
		if (s > best) {
			setBest(s);
			try {
				localStorage.setItem(BEST_KEY, String(s));
			} catch {}
		}
	};

	return (
		<div
			style={{
				width: 900,
				height: 600,
				background: "#0a0a0a",
				color: "#cfc",
				fontFamily: "monospace",
				padding: 12,
				boxSizing: "border-box",
				userSelect: "none",
				overflow: "hidden",
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<b>Hidden Camera</b>
				<span style={{ fontSize: 12, opacity: 0.85 }}>
					Difficulty: {difficulty} · Best: {best}
				</span>
			</div>
			<div style={{ fontSize: 12, opacity: 0.7 }}>
				Scrub the timeline. Mark when each event happened. Listen for cues.
			</div>

			<div
				style={{
					marginTop: 6,
					width: 876,
					height: 320,
					background: scene.bgTint,
					position: "relative",
					border: "2px solid #2a3a28",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						position: "absolute",
						top: 4,
						right: 8,
						color: "#f55",
						fontSize: 12,
					}}
				>
					● REC {time.toFixed(2)}s {speed !== 1 && `(${speed}×)`}
				</div>
				{scene.rooms.map((r, i) => (
					<div
						key={i}
						style={{
							position: "absolute",
							left: r.x,
							top: r.y,
							width: r.w,
							height: r.h,
							border: "2px solid #555",
							background: "#0003",
						}}
					>
						<div style={{ color: "#888", fontSize: 10, padding: 2 }}>{r.label}</div>
					</div>
				))}
				{scene.sprites.map((s) => {
					const p = spriteAt(s, time);
					return (
						<div
							key={s.id}
							style={{
								position: "absolute",
								left: p.x - 12,
								top: p.y - 12,
								width: 24,
								height: 24,
								borderRadius: "50%",
								background: s.color,
								fontSize: 11,
								color: "#000",
								textAlign: "center",
								lineHeight: "24px",
							}}
						>
							{s.name[0]}
							{p.holding && (
								<div
									style={{
										position: "absolute",
										left: 24,
										top: 0,
										fontSize: 11,
										color: "#fc8",
										whiteSpace: "nowrap",
									}}
								>
									holds {p.holding}
								</div>
							)}
						</div>
					);
				})}
			</div>

			<input
				type="range"
				min={0}
				max={DURATION}
				step={0.01}
				value={time}
				onChange={(e) => onScrub(parseFloat(e.target.value))}
				style={{ width: "100%", marginTop: 4 }}
			/>

			<div style={{ display: "flex", gap: 6, marginTop: 4, fontSize: 12, alignItems: "center" }}>
				<button onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
				<button onClick={() => onScrub(0)}>Rewind</button>
				<button onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1))}>
					Speed: {speed}×
				</button>
				<button
					onClick={() => {
						setSeed(Math.floor(Math.random() * 1e9));
						setDifficulty((d) => Math.min(8, d + (submitted ? 1 : 0)));
					}}
				>
					New scene
				</button>
			</div>

			<div style={{ marginTop: 6, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 12 }}>
				{scene.events.map((e) => {
					const g = guesses[e.id];
					const err = submitted && g != null ? Math.abs(g - e.time) : null;
					const hinted = revealedHints[e.id];
					return (
						<div key={e.id}>
							<button onClick={() => setGuess(e.id)} style={{ marginRight: 6 }}>
								Mark
							</button>
							{e.label}: {g != null ? `t=${g.toFixed(2)}s` : "—"}
							{!submitted && !hinted && (
								<button
									onClick={() => useHint(e.id)}
									style={{ marginLeft: 6, fontSize: 10 }}
									title="Reveals a ±5s window (-25 pts)"
								>
									hint
								</button>
							)}
							{hinted && !submitted && (
								<span style={{ marginLeft: 6, color: "#fc8" }}>
									(approx {Math.max(0, e.time - 5).toFixed(0)}–{Math.min(DURATION, e.time + 5).toFixed(0)}s)
								</span>
							)}
							{submitted && (
								<span style={{ color: err! < e.tolerance ? "#6f6" : "#f88" }}>
									{" "}
									(actual {e.time.toFixed(2)}, err {err!.toFixed(2)})
								</span>
							)}
						</div>
					);
				})}
			</div>

			<div style={{ marginTop: 6, fontSize: 12 }}>
				<button onClick={submit} disabled={submitted}>
					Submit
				</button>
				<span style={{ marginLeft: 12 }}>
					Score: <b>{submitted ? computeScore() : "—"}</b> / {scene.events.length * 100}
				</span>
				{hintsUsed > 0 && (
					<span style={{ marginLeft: 8, color: "#fc8" }}>(−{hintsUsed * 25} hints)</span>
				)}
			</div>
		</div>
	);
}
