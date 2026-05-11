import { useEffect, useMemo, useRef, useState } from "react";

type Line = { actor: string; text: string; t: number };

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

const NOUNS = [
	"moon",
	"shadow",
	"rose",
	"crown",
	"sword",
	"oath",
	"whisper",
	"raven",
	"flame",
	"river",
	"stone",
	"star",
	"wound",
	"banner",
];
const ADJ = [
	"silver",
	"crimson",
	"hollow",
	"bitter",
	"ancient",
	"silent",
	"fated",
	"weary",
	"gilded",
	"thorny",
];
const VERBS = [
	"falls",
	"dies",
	"rises",
	"weeps",
	"calls",
	"burns",
	"breaks",
	"sings",
	"fades",
];
const NARR_OPENERS = [
	"The curtain rises on",
	"Enter, beneath",
	"A bell tolls before",
	"Lightning forks above",
	"Far off, hounds bay at",
];
const ACTOR_LINES_OPEN = [
	"Who walks there?",
	"Speak — or be slain.",
	"You? Now?",
	"Hold your tongue.",
	"What news from the keep?",
];
const ACTOR_LINES_REPLY = [
	"A friend.",
	"News of import.",
	"The hour is ill.",
	"I bring only sorrow.",
	"We are betrayed.",
	"Then we ride at dawn.",
];

function pick<T>(rng: () => number, a: T[]): T {
	return a[Math.floor(rng() * a.length)];
}

function generateScript(seed: number, lineCount: number, tempo: number): Line[] {
	const rng = mulberry32(seed);
	const lines: Line[] = [];
	let t = 1.0;
	const actors = ["NARRATOR", "JULIA", "YOU"];
	for (let i = 0; i < lineCount; i++) {
		const actor = actors[i % actors.length];
		let text: string;
		if (actor === "NARRATOR") {
			text = `${pick(rng, NARR_OPENERS)} the ${pick(rng, ADJ)} ${pick(rng, NOUNS)}.`;
		} else if (actor === "JULIA") {
			text =
				i < 3
					? pick(rng, ACTOR_LINES_OPEN)
					: `The ${pick(rng, NOUNS)} ${pick(rng, VERBS)}.`;
		} else {
			text =
				i < 5
					? pick(rng, ACTOR_LINES_REPLY)
					: `My ${pick(rng, ADJ)} ${pick(rng, NOUNS)} ${pick(rng, VERBS)}.`;
		}
		lines.push({ actor, text, t });
		t += tempo * (0.85 + rng() * 0.5);
	}
	lines.push({ actor: "NARRATOR", text: "Curtain.", t: t + tempo * 0.6 });
	return lines;
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
function tickSnd(high: boolean) {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const o = c.createOscillator();
	const g = c.createGain();
	o.type = "square";
	o.frequency.value = high ? 1200 : 800;
	g.gain.setValueAtTime(0.001, t);
	g.gain.exponentialRampToValueAtTime(0.04, t + 0.005);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
	o.connect(g).connect(c.destination);
	o.start(t);
	o.stop(t + 0.06);
}
function applaud() {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const n = Math.floor(c.sampleRate * 0.4);
	const b = c.createBuffer(1, n, c.sampleRate);
	const d = b.getChannelData(0);
	for (let i = 0; i < n; i++) {
		const env = Math.sin((Math.PI * i) / n);
		d[i] = (Math.random() * 2 - 1) * env * 0.4;
	}
	const src = c.createBufferSource();
	src.buffer = b;
	const f = c.createBiquadFilter();
	f.type = "bandpass";
	f.frequency.value = 2200;
	const g = c.createGain();
	g.gain.value = 0.4;
	src.connect(f).connect(g).connect(c.destination);
	src.start(t);
	src.stop(t + 0.45);
}
function dud() {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const o = c.createOscillator();
	const g = c.createGain();
	o.type = "sawtooth";
	o.frequency.value = 110;
	g.gain.setValueAtTime(0.001, t);
	g.gain.exponentialRampToValueAtTime(0.1, t + 0.01);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
	o.connect(g).connect(c.destination);
	o.start(t);
	o.stop(t + 0.2);
}

const WINDOW = 0.45;

export default function Game093_CurtainCall() {
	const [seedInput, setSeedInput] = useState<string>(() => todayKey());
	const [difficulty, setDifficulty] = useState(1);
	const [lineCount, setLineCount] = useState(9);
	const seed = useMemo(
		() => hashStr(`${seedInput}|D${difficulty}|N${lineCount}`),
		[seedInput, difficulty, lineCount],
	);
	const tempo = useMemo(
		() => Math.max(1.0, 2.4 - difficulty * 0.4),
		[difficulty],
	);
	const script = useMemo(
		() => generateScript(seed, lineCount, tempo),
		[seed, lineCount, tempo],
	);
	const totalDur = useMemo(
		() => script[script.length - 1].t + 1.5,
		[script],
	);

	const [t, setT] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [hits, setHits] = useState<Record<number, number>>({});
	const [missed, setMissed] = useState<Set<number>>(new Set());
	const startRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);
	const lastBeatRef = useRef(-1);
	const hitsRef = useRef(hits);
	hitsRef.current = hits;
	const missedRef = useRef(missed);
	missedRef.current = missed;
	const tRef = useRef(t);
	tRef.current = t;
	const playingRef = useRef(playing);
	playingRef.current = playing;

	useEffect(() => {
		setT(0);
		setHits({});
		setMissed(new Set());
		setPlaying(false);
		startRef.current = null;
	}, [seed]);

	useEffect(() => {
		if (!playing) return;
		function loop(now: number) {
			if (startRef.current == null) startRef.current = now;
			const cur = (now - startRef.current) / 1000;
			setT(cur);
			const beat = Math.floor(cur);
			if (beat !== lastBeatRef.current) {
				lastBeatRef.current = beat;
				tickSnd(beat % 4 === 0);
			}
			const curHits = hitsRef.current;
			const curMissed = missedRef.current;
			const newlyMissed: number[] = [];
			script.forEach((ln, i) => {
				if (ln.actor !== "YOU") return;
				if (cur > ln.t + WINDOW && !(i in curHits) && !curMissed.has(i)) {
					newlyMissed.push(i);
				}
			});
			if (newlyMissed.length) {
				setMissed((m) => {
					const n = new Set(m);
					for (const i of newlyMissed) n.add(i);
					return n;
				});
			}
			if (cur < totalDur) rafRef.current = requestAnimationFrame(loop);
			else {
				setPlaying(false);
				const yourCount = script.filter((l) => l.actor === "YOU").length;
				if (Object.keys(hitsRef.current).length >= yourCount * 0.6) applaud();
			}
		}
		rafRef.current = requestAnimationFrame(loop);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [playing, script, totalDur]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.code !== "Space") return;
			e.preventDefault();
			if (!playingRef.current) {
				setPlaying(true);
				startRef.current = null;
				lastBeatRef.current = -1;
				setT(0);
				setHits({});
				setMissed(new Set());
				return;
			}
			const curT = tRef.current;
			const curHits = hitsRef.current;
			const curMissed = missedRef.current;
			let bestIdx = -1;
			let bestErr = Infinity;
			script.forEach((ln, i) => {
				if (ln.actor !== "YOU") return;
				if (i in curHits || curMissed.has(i)) return;
				const err = Math.abs(ln.t - curT);
				if (err < bestErr) {
					bestErr = err;
					bestIdx = i;
				}
			});
			if (bestIdx >= 0 && bestErr <= WINDOW) {
				setHits((h) => ({ ...h, [bestIdx]: bestErr }));
				applaud();
			} else if (bestIdx >= 0) {
				setMissed((m) => new Set(m).add(bestIdx));
				dud();
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [script]);

	const totalYour = script.filter((l) => l.actor === "YOU").length;
	const hitCount = Object.keys(hits).length;
	const avgErr = hitCount
		? Object.values(hits).reduce((a, b) => a + b, 0) / hitCount
		: 0;
	const score = Math.round(hitCount * 100 - avgErr * 200);

	const bestKey = `cc_best_${seedInput}_${difficulty}_${lineCount}`;
	const [best, setBest] = useState<number | null>(null);
	useEffect(() => {
		try {
			const v = localStorage.getItem(bestKey);
			setBest(v ? parseInt(v, 10) : null);
		} catch {}
	}, [bestKey]);
	useEffect(() => {
		if (!playing && t > 0 && t >= totalDur - 0.5) {
			try {
				const prev = localStorage.getItem(bestKey);
				if (!prev || score > parseInt(prev, 10)) {
					localStorage.setItem(bestKey, String(score));
					setBest(score);
				}
			} catch {}
		}
	}, [playing, t, totalDur, score, bestKey]);

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "Georgia, serif",
				background: "#1a0a14",
				color: "#f4e9d8",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px", fontStyle: "italic" }}>Curtain Call</h2>
			<p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.7 }}>
				Press space to deliver YOUR line at the cue. Tolerance ±
				{WINDOW.toFixed(2)}s.
			</p>
			<div
				style={{
					display: "flex",
					gap: 10,
					alignItems: "center",
					fontSize: 12,
					marginBottom: 10,
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
					New play
				</button>
				<label>
					Difficulty{" "}
					<select
						value={difficulty}
						onChange={(e) => setDifficulty(parseInt(e.target.value, 10))}
					>
						<option value={1}>1</option>
						<option value={2}>2</option>
						<option value={3}>3</option>
					</select>
				</label>
				<label>
					Lines{" "}
					<select
						value={lineCount}
						onChange={(e) => setLineCount(parseInt(e.target.value, 10))}
					>
						<option value={6}>6</option>
						<option value={9}>9</option>
						<option value={12}>12</option>
					</select>
				</label>
				{best != null && <span>Best {best}</span>}
			</div>

			<div
				style={{
					position: "relative",
					height: 18,
					background: "#0e0610",
					border: "1px solid #3a2030",
					borderRadius: 4,
					marginBottom: 10,
				}}
			>
				{script.map((ln, i) => {
					const left = (ln.t / totalDur) * 100;
					return (
						<div
							key={i}
							style={{
								position: "absolute",
								left: `${left}%`,
								top: 2,
								bottom: 2,
								width: ln.actor === "YOU" ? 3 : 1,
								background:
									ln.actor === "YOU"
										? i in hits
											? "#a3d977"
											: missed.has(i)
												? "#e63946"
												: "#f4d35e"
										: "#7b5a48",
							}}
						/>
					);
				})}
				<div
					style={{
						position: "absolute",
						left: `${(t / totalDur) * 100}%`,
						top: 0,
						bottom: 0,
						width: 2,
						background: "#fff",
					}}
				/>
			</div>

			<div
				style={{
					background: "#0e0610",
					border: "1px solid #3a2030",
					borderRadius: 6,
					padding: 14,
					minHeight: 320,
					maxHeight: 320,
					overflow: "hidden",
				}}
			>
				<div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>
					t = {t.toFixed(2)}s / {totalDur.toFixed(1)}s
				</div>
				{script.map((ln, i) => {
					const past = t >= ln.t - 0.1;
					const isYou = ln.actor === "YOU";
					const wasHit = i in hits;
					const wasMissed = missed.has(i);
					const active =
						isYou && !wasHit && !wasMissed && Math.abs(ln.t - t) < 0.6;
					return (
						<div
							key={i}
							style={{
								opacity: past ? 1 : 0.3,
								color: isYou
									? wasHit
										? "#a3d977"
										: wasMissed
											? "#e63946"
											: active
												? "#f4d35e"
												: "#f4e9d8"
									: "#cdb38c",
								marginBottom: 4,
								fontWeight: isYou ? 700 : 400,
								fontStyle: ln.actor === "NARRATOR" ? "italic" : "normal",
								transform: active ? "scale(1.04)" : undefined,
								transition: "transform 120ms",
							}}
						>
							<span
								style={{ display: "inline-block", width: 90, opacity: 0.6 }}
							>
								{ln.actor}:
							</span>
							{ln.text}
							{isYou && wasHit && (
								<span style={{ marginLeft: 8, fontSize: 11 }}>
									(±{hits[i].toFixed(2)}s)
								</span>
							)}
							{isYou && wasMissed && (
								<span style={{ marginLeft: 8, fontSize: 11 }}>(missed)</span>
							)}
						</div>
					);
				})}
			</div>

			<div style={{ marginTop: 12 }}>
				{!playing && t === 0 && (
					<button onClick={() => setPlaying(true)}>
						Begin performance (Space)
					</button>
				)}
				{!playing && t > 0 && (
					<>
						<strong>Performance complete.</strong> Hit {hitCount}/{totalYour}{" "}
						cues · avg ±{avgErr.toFixed(2)}s · score{" "}
						<strong>{score}</strong>
						<button
							onClick={() => {
								setT(0);
								setHits({});
								setMissed(new Set());
								startRef.current = null;
							}}
							style={{ marginLeft: 12 }}
						>
							Encore
						</button>
					</>
				)}
			</div>
		</div>
	);
}
