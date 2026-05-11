import { useEffect, useRef, useState } from "react";

// Game 78 — Tally
// Seeded procedural herds. Difficulty ramps: shorter flash, mixed species,
// drift motion, distractors. WebAudio chimes. Streak bonus.

const ANIMALS = ["🐑", "🐄", "🐐", "🦌", "🐓", "🦆", "🦃", "🐖"];
const DISTRACTORS = ["🌿", "🪨", "🌳", "🌾"];

type Beast = { animal: string; x: number; y: number; vx: number; vy: number; isDistractor: boolean };
type Round = {
	target: string;
	beasts: Beast[];
	flashMs: number;
	moving: boolean;
	mixed: boolean;
};

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

const BEST_KEY = "tally:best";

function makeRound(seed: number, level: number): Round {
	const rnd = mulberry32(seed);
	const target = ANIMALS[Math.floor(rnd() * ANIMALS.length)];
	const count = 5 + Math.floor(rnd() * (40 + level * 8));
	const mixed = level >= 2 && rnd() > 0.4;
	const moving = level >= 3 && rnd() > 0.4;
	const flashMs = Math.max(180, 700 - level * 60);
	const beasts: Beast[] = [];
	for (let i = 0; i < count; i++) {
		beasts.push({
			animal: target,
			x: 40 + rnd() * 780,
			y: 100 + rnd() * 380,
			vx: moving ? (rnd() - 0.5) * 60 : 0,
			vy: moving ? (rnd() - 0.5) * 40 : 0,
			isDistractor: false,
		});
	}
	if (mixed) {
		const others = ANIMALS.filter((a) => a !== target);
		const distractCount = Math.floor(count * (0.3 + rnd() * 0.4));
		for (let i = 0; i < distractCount; i++) {
			beasts.push({
				animal: others[Math.floor(rnd() * others.length)],
				x: 40 + rnd() * 780,
				y: 100 + rnd() * 380,
				vx: moving ? (rnd() - 0.5) * 60 : 0,
				vy: moving ? (rnd() - 0.5) * 40 : 0,
				isDistractor: true,
			});
		}
	}
	if (level >= 4) {
		const dec = Math.floor(rnd() * 6);
		for (let i = 0; i < dec; i++) {
			beasts.push({
				animal: DISTRACTORS[Math.floor(rnd() * DISTRACTORS.length)],
				x: 40 + rnd() * 780,
				y: 100 + rnd() * 380,
				vx: 0,
				vy: 0,
				isDistractor: true,
			});
		}
	}
	return { target, beasts, flashMs, moving, mixed };
}

class TallyAudio {
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
	pluck(freq: number, dur = 0.18) {
		const c = this.ensure();
		if (!c) return;
		const o = c.createOscillator();
		const g = c.createGain();
		o.type = "triangle";
		o.frequency.value = freq;
		g.gain.setValueAtTime(0.0001, c.currentTime);
		g.gain.exponentialRampToValueAtTime(0.16, c.currentTime + 0.005);
		g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
		o.connect(g).connect(c.destination);
		o.start();
		o.stop(c.currentTime + dur + 0.05);
	}
	chord(notes: number[]) {
		notes.forEach((f, i) => setTimeout(() => this.pluck(f, 0.25), i * 50));
	}
}

export default function Game078_Tally() {
	const [level, setLevel] = useState(1);
	const [round, setRound] = useState<Round>(() => makeRound((Math.random() * 1e9) | 0, 1));
	const [phase, setPhase] = useState<"ready" | "flash" | "guess" | "result">("ready");
	const [guess, setGuess] = useState("");
	const [history, setHistory] = useState<Array<{ guess: number; actual: number; level: number }>>(
		[],
	);
	const [streak, setStreak] = useState(0);
	const [bestStreak, setBestStreak] = useState<number>(() => {
		try {
			return parseInt(localStorage.getItem(BEST_KEY) || "0") || 0;
		} catch {
			return 0;
		}
	});
	const audio = useRef(new TallyAudio());

	const targetCount = round.beasts.filter(
		(b) => b.animal === round.target && !b.isDistractor,
	).length;

	useEffect(() => {
		if (phase !== "flash") return;
		const t = setTimeout(() => setPhase("guess"), round.flashMs);
		return () => clearTimeout(t);
	}, [phase, round.flashMs]);

	useEffect(() => {
		if (phase !== "flash" || !round.moving) return;
		let raf = 0;
		let last = performance.now();
		const step = (ts: number) => {
			const dt = (ts - last) / 1000;
			last = ts;
			setRound((r) => {
				if (!r.moving) return r;
				return {
					...r,
					beasts: r.beasts.map((b) => {
						let nx = b.x + b.vx * dt;
						let ny = b.y + b.vy * dt;
						let vx = b.vx;
						let vy = b.vy;
						if (nx < 30 || nx > 830) {
							vx = -vx;
							nx = b.x;
						}
						if (ny < 90 || ny > 490) {
							vy = -vy;
							ny = b.y;
						}
						return { ...b, x: nx, y: ny, vx, vy };
					}),
				};
			});
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [phase, round.moving]);

	const start = () => {
		const ns = (Math.random() * 1e9) | 0;
		setRound(makeRound(ns, level));
		setGuess("");
		setPhase("flash");
		audio.current.pluck(440, 0.08);
	};

	const submit = () => {
		const g = parseInt(guess);
		if (isNaN(g)) return;
		const err = Math.abs(g - targetCount) / Math.max(1, targetCount);
		const good = err < 0.15;
		if (good) {
			audio.current.chord([523, 659, 784]);
			const ns = streak + 1;
			setStreak(ns);
			if (ns > bestStreak) {
				setBestStreak(ns);
				try {
					localStorage.setItem(BEST_KEY, String(ns));
				} catch {}
			}
			if (ns % 3 === 0) setLevel((l) => Math.min(8, l + 1));
		} else {
			audio.current.pluck(150, 0.3);
			setStreak(0);
		}
		setHistory((h) => [{ guess: g, actual: targetCount, level }, ...h].slice(0, 12));
		setPhase("result");
	};

	const reset = () => {
		setLevel(1);
		setStreak(0);
		setHistory([]);
		setPhase("ready");
	};

	const accuracyScore = (() => {
		if (history.length === 0) return 0;
		const errs = history.map((r) => Math.abs(r.guess - r.actual) / Math.max(1, r.actual));
		const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
		return Math.max(0, Math.round((1 - mean) * 100));
	})();

	return (
		<div
			style={{
				width: 900,
				height: 600,
				background: "linear-gradient(180deg,#6a9a3a,#3a6a25)",
				color: "#fff",
				fontFamily: "system-ui, sans-serif",
				position: "relative",
				userSelect: "none",
				overflow: "hidden",
			}}
		>
			<div style={{ position: "absolute", top: 8, left: 12, zIndex: 10 }}>
				<b>Tally</b> — Estimate the {round.target} count. Lv {level}
				{round.mixed && " · mixed"}
				{round.moving && " · moving"}
			</div>
			<div
				style={{
					position: "absolute",
					top: 8,
					right: 12,
					zIndex: 10,
					textAlign: "right",
					fontSize: 13,
				}}
			>
				Streak: {streak} · Best: {bestStreak} · Acc: {accuracyScore}%
			</div>

			{phase === "flash" && (
				<>
					{round.beasts.map((b, i) => (
						<div
							key={i}
							style={{
								position: "absolute",
								left: b.x,
								top: b.y,
								fontSize: 22,
								pointerEvents: "none",
							}}
						>
							{b.animal}
						</div>
					))}
				</>
			)}

			{phase === "ready" && (
				<div style={{ textAlign: "center", marginTop: 220 }}>
					<button
						onClick={start}
						style={{
							fontSize: 28,
							padding: "14px 40px",
							cursor: "pointer",
							borderRadius: 10,
							border: "none",
							background: "#fff",
							color: "#3a6a25",
							fontWeight: "bold",
						}}
					>
						Begin
					</button>
					<div style={{ marginTop: 12 }}>
						Click to flash the herd. Count only the target animal.
					</div>
				</div>
			)}

			{phase === "guess" && (
				<div style={{ textAlign: "center", marginTop: 200 }}>
					<div style={{ fontSize: 24 }}>How many {round.target}?</div>
					<input
						autoFocus
						value={guess}
						onChange={(e) => setGuess(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && submit()}
						style={{
							fontSize: 28,
							padding: "8px 12px",
							marginTop: 12,
							width: 100,
							textAlign: "center",
						}}
					/>
					<div>
						<button
							onClick={submit}
							style={{ marginTop: 12, padding: "8px 20px", fontSize: 14 }}
						>
							Submit
						</button>
					</div>
				</div>
			)}

			{phase === "result" && (
				<div style={{ textAlign: "center", marginTop: 180 }}>
					<div style={{ fontSize: 32 }}>
						{round.target} Actual: <b>{targetCount}</b>
					</div>
					<div style={{ fontSize: 22, marginTop: 8 }}>
						You guessed: <b>{history[0].guess}</b> (off by{" "}
						{Math.abs(history[0].guess - targetCount)})
					</div>
					<div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "center" }}>
						<button onClick={start} style={{ padding: "10px 24px", fontSize: 16 }}>
							Next round
						</button>
						<button
							onClick={reset}
							style={{ padding: "10px 24px", fontSize: 14, opacity: 0.8 }}
						>
							Reset run
						</button>
					</div>
				</div>
			)}

			<div
				style={{
					position: "absolute",
					bottom: 12,
					left: 12,
					right: 12,
					fontSize: 12,
					background: "rgba(0,0,0,0.3)",
					padding: 6,
					borderRadius: 6,
				}}
			>
				<b>History:</b>{" "}
				{history.map((r, i) => (
					<span key={i} style={{ marginRight: 10 }}>
						{r.guess}/{r.actual}
						<span style={{ opacity: 0.6 }}>·L{r.level}</span>
					</span>
				))}
			</div>
		</div>
	);
}
