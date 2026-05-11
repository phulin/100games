import { useEffect, useRef, useState } from "react";

// 1940s switchboard. Seeded procedural subscriber names — no fixed roster.
// Multiple calls ring at once; player clicks a call, then a line to plug it.
// Wrong line drops the call. Difficulty levels up after every 5 connections.

type Subscriber = { name: string; line: number };
type Call = { id: number; name: string; deadline: number; ringStart: number };

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

// Procedural name generation from phoneme tables (a different roster every seed).
const TITLES = ["Mr.", "Mrs.", "Miss", "Dr.", "Capt.", "Rev.", "Prof.", "Sgt."];
const ONSETS = ["B", "C", "D", "F", "G", "H", "K", "L", "M", "N", "P", "R", "S", "T", "V", "W", "Br", "Cl", "Dr", "Fl", "Gr", "Kn", "Pl", "Sl", "St", "Th", "Wh"];
const VOWELS = ["a", "e", "i", "o", "u", "ai", "ea", "ou", "y"];
const ENDS = ["s", "n", "r", "l", "m", "ld", "nd", "rt", "lk", "mp", "ne", "ke", "ll", "rd", "ckle", "ton", "by", "ham", "ridge", "wick"];

function genName(r: () => number): string {
	const title = TITLES[Math.floor(r() * TITLES.length)];
	const onset = ONSETS[Math.floor(r() * ONSETS.length)];
	const v = VOWELS[Math.floor(r() * VOWELS.length)];
	const end = ENDS[Math.floor(r() * ENDS.length)];
	const middle = r() < 0.35 ? VOWELS[Math.floor(r() * VOWELS.length)] + ENDS[Math.floor(r() * ENDS.length)] : "";
	const last = onset + v + middle + end;
	return `${title} ${last.charAt(0).toUpperCase() + last.slice(1).toLowerCase()}`;
}

function pickSubscribers(seed: number): Subscriber[] {
	const r = mulberry32(seed);
	const names = new Set<string>();
	while (names.size < 8) names.add(genName(r));
	return [...names].map((name, i) => ({ name, line: i + 1 }));
}

let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext | null {
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

function ringTone() {
	const ctx = getAudio();
	if (!ctx) return;
	const t = ctx.currentTime;
	const osc = ctx.createOscillator();
	const lfo = ctx.createOscillator();
	const lfoG = ctx.createGain();
	const g = ctx.createGain();
	osc.frequency.value = 440;
	osc.type = "sine";
	lfo.frequency.value = 20;
	lfoG.gain.value = 30;
	lfo.connect(lfoG).connect(osc.frequency);
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
	g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
	osc.connect(g).connect(ctx.destination);
	osc.start(t);
	lfo.start(t);
	osc.stop(t + 0.45);
	lfo.stop(t + 0.45);
}

function plugClick() {
	const ctx = getAudio();
	if (!ctx) return;
	const t = ctx.currentTime;
	const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
	const d = buf.getChannelData(0);
	for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-(i / d.length) * 18);
	const src = ctx.createBufferSource();
	src.buffer = buf;
	const g = ctx.createGain();
	g.gain.value = 0.4;
	src.connect(g).connect(ctx.destination);
	src.start(t);
}

function errorBuzz() {
	const ctx = getAudio();
	if (!ctx) return;
	const t = ctx.currentTime;
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.frequency.value = 110;
	osc.type = "square";
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
	g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
	osc.connect(g).connect(ctx.destination);
	osc.start(t);
	osc.stop(t + 0.32);
}

type Cord = { line: number; t: number };

export default function Switchboard() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [subscribers, setSubscribers] = useState<Subscriber[]>(() => pickSubscribers(seed));
	const [phase, setPhase] = useState<"memorize" | "play" | "over">("memorize");
	const [memTime, setMemTime] = useState(15);
	const [calls, setCalls] = useState<Call[]>([]);
	const [selectedCall, setSelectedCall] = useState<number | null>(null);
	const [score, setScore] = useState(0);
	const [missed, setMissed] = useState(0);
	const [now, setNow] = useState(performance.now());
	const [cords, setCords] = useState<Cord[]>([]);
	const [bestScore, setBestScore] = useState(() => {
		try {
			return parseInt(localStorage.getItem("switchboard_best") || "0", 10);
		} catch {
			return 0;
		}
	});
	const subsRef = useRef(subscribers);
	subsRef.current = subscribers;
	const lastRingRef = useRef(0);

	const level = Math.floor(score / 5) + 1;

	useEffect(() => {
		if (phase !== "memorize") return;
		const id = setInterval(() => {
			setMemTime((t) => {
				if (t <= 1) {
					clearInterval(id);
					setPhase("play");
					return 0;
				}
				return t - 1;
			});
		}, 1000);
		return () => clearInterval(id);
	}, [phase]);

	useEffect(() => {
		if (phase !== "play") return;
		let raf = 0;
		const tick = () => {
			setNow(performance.now());
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [phase]);

	useEffect(() => {
		if (phase !== "play") return;
		const id = setInterval(() => {
			if (calls.length > 0 && performance.now() - lastRingRef.current > 1100) {
				ringTone();
				lastRingRef.current = performance.now();
			}
		}, 400);
		return () => clearInterval(id);
	}, [phase, calls.length]);

	useEffect(() => {
		if (phase !== "play") return;
		const maxParallel = Math.min(4, 1 + Math.floor(level / 2));
		const spawn = () => {
			const subs = subsRef.current;
			const sub = subs[Math.floor(Math.random() * subs.length)];
			setCalls((cs) => {
				if (cs.length >= maxParallel) return cs;
				const t = performance.now();
				const window = Math.max(2800, 6500 - level * 350);
				return [
					...cs,
					{
						id: Date.now() + Math.random(),
						name: sub.name,
						deadline: t + window,
						ringStart: t,
					},
				];
			});
		};
		const interval = setInterval(spawn, Math.max(1100, 3200 - level * 200));
		return () => clearInterval(interval);
	}, [phase, level]);

	// Drop expired calls and count misses. Previously setMissed and
	// errorBuzz lived INSIDE the setCalls updater, which React 18 strict
	// mode runs twice — that double-counted every miss and double-buzzed.
	// Also avoid allocating a new array every frame when nothing expired,
	// which kept forcing re-renders.
	useEffect(() => {
		if (phase !== "play") return;
		let expired = 0;
		setCalls((cs) => {
			expired = 0;
			const survivors: Call[] = [];
			for (const c of cs) {
				if (now > c.deadline) expired++;
				else survivors.push(c);
			}
			return expired > 0 ? survivors : cs;
		});
		if (expired > 0) {
			setMissed((m) => m + expired);
			errorBuzz();
		}
	}, [now, phase]);

	useEffect(() => {
		if (missed >= 5 && phase === "play") {
			setPhase("over");
			if (score > bestScore) {
				setBestScore(score);
				try {
					localStorage.setItem("switchboard_best", String(score));
				} catch {
					/* ignore */
				}
			}
		}
	}, [missed, phase, score, bestScore]);

	const plugLine = (line: number) => {
		if (phase !== "play") return;
		const targetId = selectedCall ?? (calls.length > 0 ? calls[0].id : null);
		if (targetId == null) return;
		const target = calls.find((c) => c.id === targetId);
		if (!target) return;
		const sub = subscribers.find((s) => s.name === target.name);
		if (!sub) return;
		// Decide outcome OUTSIDE the setCalls updater. The previous version
		// called setScore / setMissed / audio cues inside the updater, so
		// React 18 strict mode double-fired every plug action (the wrong
		// line counted as two misses, a correct line awarded two points).
		const correct = sub.line === line;
		setCalls((cs) => cs.filter((c) => c.id !== targetId));
		setSelectedCall(null);
		if (correct) {
			plugClick();
			setScore((s) => s + 1);
			setCords((cd) => [...cd, { line, t: performance.now() }]);
			setTimeout(() => {
				setCords((cd) => cd.filter((c) => performance.now() - c.t < 600));
			}, 650);
		} else {
			errorBuzz();
			setMissed((m) => m + 1);
		}
	};

	const reset = () => {
		const ns = Math.floor(Math.random() * 1e9);
		setSeed(ns);
		setSubscribers(pickSubscribers(ns));
		setPhase("memorize");
		setMemTime(15);
		setCalls([]);
		setScore(0);
		setMissed(0);
		setSelectedCall(null);
		setCords([]);
	};

	return (
		<div style={{ background: "#2a1c10", color: "#f4e8d0", padding: 16, fontFamily: "Georgia, serif" }}>
			<h2 style={{ margin: "0 0 4px" }}>Switchboard</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Memorize the directory. When calls ring, click a call then plug its line. 5 missed = game over.
			</div>
			<div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
				<div>Connected: {score}</div>
				<div>Level: {level}</div>
				<div style={{ color: missed > 2 ? "#f88" : "#fc6" }}>Missed: {missed}/5</div>
				{phase === "memorize" && <div>Memorize: {memTime}s</div>}
				{phase === "over" && (
					<div style={{ color: "#f88" }}>
						GAME OVER · score {score} · best {bestScore}
					</div>
				)}
				<button type="button" onClick={reset}>
					{phase === "over" ? "Try again" : "Restart (new seed)"}
				</button>
				<span style={{ opacity: 0.5, fontSize: 11 }}>seed: {seed}</span>
			</div>

			<div
				style={{
					background: "#1a1008",
					padding: 12,
					borderRadius: 6,
					marginBottom: 12,
					minHeight: 80,
				}}
			>
				<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
					{phase === "memorize" ? "Directory" : "Directory (concealed)"}
				</div>
				<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
					{subscribers.map((s) => (
						<div
							key={s.line}
							style={{
								padding: 6,
								background: "#3a2818",
								borderRadius: 4,
								fontSize: 13,
							}}
						>
							{phase === "memorize" ? (
								<>
									<span style={{ color: "#fc6" }}>L{s.line}</span> · {s.name}
								</>
							) : (
								<span style={{ opacity: 0.3 }}>L{s.line} · ???</span>
							)}
						</div>
					))}
				</div>
			</div>

			<div style={{ display: "flex", gap: 8, minHeight: 70, marginBottom: 12 }}>
				{calls.map((c) => {
					const remaining = Math.max(0, c.deadline - now);
					const total = c.deadline - c.ringStart;
					const isSel = selectedCall === c.id;
					const ringing = Math.floor((now - c.ringStart) / 250) % 2 === 0;
					return (
						<div
							key={c.id}
							onClick={() => setSelectedCall(c.id)}
							style={{
								padding: 10,
								background: isSel ? "#c95" : ringing ? "#a83" : "#3a2818",
								borderRadius: 6,
								flex: 1,
								color: "#fff",
								boxShadow: isSel
									? "0 0 16px rgba(255,220,120,0.8)"
									: ringing
										? "0 0 12px rgba(255,200,80,0.5)"
										: undefined,
								cursor: "pointer",
								transition: "background 0.1s, box-shadow 0.1s",
							}}
						>
							<div style={{ fontSize: 14, fontWeight: "bold" }}>{c.name}</div>
							<div style={{ height: 4, background: "#221", marginTop: 4, borderRadius: 2 }}>
								<div
									style={{
										width: `${(remaining / total) * 100}%`,
										height: "100%",
										background: remaining < 1500 ? "#f44" : "#fc6",
										borderRadius: 2,
									}}
								/>
							</div>
						</div>
					);
				})}
				{calls.length === 0 && phase === "play" && (
					<div style={{ opacity: 0.5, alignSelf: "center" }}>Lines quiet...</div>
				)}
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8, position: "relative" }}>
				{subscribers.map((s) => {
					const corded = cords.find((c) => c.line === s.line);
					return (
						<button
							key={s.line}
							type="button"
							onClick={() => plugLine(s.line)}
							style={{
								height: 80,
								background: corded ? "#4a3018" : "#1a1008",
								border: "2px solid #5a4020",
								borderRadius: 6,
								color: "#fc6",
								fontSize: 20,
								fontWeight: "bold",
								cursor: "pointer",
								position: "relative",
								overflow: "hidden",
							}}
						>
							L{s.line}
							{corded && (
								<span
									style={{
										position: "absolute",
										left: "50%",
										top: 0,
										width: 4,
										height: "100%",
										background: "linear-gradient(#caa, #532)",
										transform: "translateX(-50%)",
										opacity: 1 - (performance.now() - corded.t) / 600,
									}}
								/>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}
