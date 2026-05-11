import { useEffect, useMemo, useRef, useState } from "react";

// Soothe a sequence of babies. Seeded procedural patterns (3-5 notes), each
// baby harder. Audio uses ADSR + ambient pad. Subtle hints reward listening:
// after each note, the baby briefly shifts color toward the expected direction.

const NOTES = ["C", "D", "E", "F", "G", "A", "B"];
const FREQS: Record<string, number> = {
	C: 261.63,
	D: 293.66,
	E: 329.63,
	F: 349.23,
	G: 392.0,
	A: 440.0,
	B: 493.88,
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

function playTone(freq: number, type: OscillatorType = "sine", dur = 0.6, vol = 0.2) {
	const ctx = getAudio();
	if (!ctx) return;
	const t = ctx.currentTime;
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.frequency.value = freq;
	osc.type = type;
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
	g.gain.exponentialRampToValueAtTime(vol * 0.6, t + 0.12);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	osc.connect(g).connect(ctx.destination);
	osc.start(t);
	osc.stop(t + dur + 0.05);
}

function playChord(freqs: number[]) {
	for (const f of freqs) playTone(f, "triangle", 1.2, 0.08);
}

function genPattern(rng: () => number, length: number): string[] {
	return Array.from({ length }, () => NOTES[Math.floor(rng() * NOTES.length)]);
}

type Sparkle = { x: number; y: number; vx: number; vy: number; life: number };

export default function Lullaby() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [babyIdx, setBabyIdx] = useState(0);
	const rng = useMemo(() => mulberry32(seed + babyIdx * 7919), [seed, babyIdx]);
	const pattern = useMemo(() => genPattern(rng, 3 + babyIdx), [rng, babyIdx]);
	const [matched, setMatched] = useState(0);
	const [calm, setCalm] = useState(50);
	const [history, setHistory] = useState<{ note: string; good: boolean }[]>([]);
	const [allWon, setAllWon] = useState(false);
	const [hintDir, setHintDir] = useState<"" | "up" | "down" | "same">("");
	const [breathe, setBreathe] = useState(0);
	const [sparkles, setSparkles] = useState<Sparkle[]>([]);
	const padRef = useRef<{ stop: () => void } | null>(null);

	useEffect(() => {
		let raf = 0;
		const start = performance.now();
		const tick = () => {
			setBreathe(Math.sin((performance.now() - start) / 1000) * 0.5 + 0.5);
			setSparkles((sp) =>
				sp
					.map((s) => ({ ...s, x: s.x + s.vx, y: s.y + s.vy, vy: s.vy + 0.15, life: s.life + 1 }))
					.filter((s) => s.life < 60),
			);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, []);

	useEffect(() => {
		const ctx = getAudio();
		if (!ctx) return;
		if (calm > 70 && !padRef.current) {
			const osc1 = ctx.createOscillator();
			const osc2 = ctx.createOscillator();
			const g = ctx.createGain();
			osc1.frequency.value = 130;
			osc2.frequency.value = 196;
			osc1.type = "sine";
			osc2.type = "sine";
			g.gain.value = 0;
			g.gain.linearRampToValueAtTime(0.04, ctx.currentTime + 1.5);
			osc1.connect(g);
			osc2.connect(g);
			g.connect(ctx.destination);
			osc1.start();
			osc2.start();
			padRef.current = {
				stop: () => {
					g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
					osc1.stop(ctx.currentTime + 0.6);
					osc2.stop(ctx.currentTime + 0.6);
				},
			};
		} else if (calm <= 70 && padRef.current) {
			padRef.current.stop();
			padRef.current = null;
		}
		return () => {
			if (padRef.current) {
				padRef.current.stop();
				padRef.current = null;
			}
		};
	}, [calm]);

	const press = (note: string) => {
		if (allWon) return;
		playTone(FREQS[note]);
		const expected = pattern[matched];
		const good = note === expected;
		setHistory((h) => [...h.slice(-9), { note, good }]);
		if (good) {
			setSparkles((sp) => {
				const add: Sparkle[] = [];
				for (let i = 0; i < 8; i++) {
					add.push({
						x: 100,
						y: 100,
						vx: (Math.random() - 0.5) * 6,
						vy: -Math.random() * 5 - 1,
						life: 0,
					});
				}
				return [...sp, ...add];
			});
			setHintDir("same");
			setMatched((m) => {
				const nm = m + 1;
				if (nm >= pattern.length) {
					setCalm((c) => Math.min(100, c + 25));
					return 0;
				}
				return nm;
			});
			setCalm((c) => Math.min(100, c + 5));
		} else {
			const eFreq = FREQS[expected];
			const aFreq = FREQS[note];
			setHintDir(aFreq < eFreq ? "up" : aFreq > eFreq ? "down" : "same");
			setMatched(0);
			setCalm((c) => Math.max(0, c - 8));
		}
	};

	useEffect(() => {
		if (calm >= 100) {
			playChord([261.63, 329.63, 392.0]);
			if (babyIdx >= 2) {
				setAllWon(true);
			} else {
				setTimeout(() => {
					setBabyIdx((b) => b + 1);
					setCalm(50);
					setMatched(0);
					setHistory([]);
					setHintDir("");
				}, 1200);
			}
		}
	}, [calm, babyIdx]);

	useEffect(() => {
		const id = setInterval(() => {
			if (!allWon) setCalm((c) => Math.max(0, c - 0.5));
		}, 1000);
		return () => clearInterval(id);
	}, [allWon]);

	const reset = () => {
		setSeed(Math.floor(Math.random() * 1e9));
		setBabyIdx(0);
		setMatched(0);
		setCalm(50);
		setHistory([]);
		setAllWon(false);
		setHintDir("");
	};

	const babyFace = allWon ? "ZZZ" : calm > 80 ? ":)" : calm > 40 ? ":|" : ":(";
	const cry = !allWon && calm < 30;
	const hintColor =
		hintDir === "up"
			? "0 0 24px rgba(255,200,80,0.6)"
			: hintDir === "down"
				? "0 0 24px rgba(120,200,255,0.6)"
				: hintDir === "same"
					? "0 0 24px rgba(180,255,180,0.6)"
					: "inset -8px -8px 24px rgba(0,0,0,0.08)";

	const breathScale = 1 + breathe * 0.04;

	return (
		<div style={{ background: "#f8e8f0", color: "#333", padding: 20, fontFamily: "sans-serif", minHeight: 540, position: "relative" }}>
			<h2 style={{ margin: "0 0 4px", color: "#553" }}>Lullaby</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
				Baby {babyIdx + 1} of 3. Find the {pattern.length}-note sequence. Yellow glow = play higher; blue = lower.
			</div>
			<div
				style={{
					margin: "0 auto",
					width: 200,
					height: 200,
					borderRadius: "50%",
					background: cry ? "#f6b" : "#fcd",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 56,
					color: "#553",
					boxShadow: hintColor,
					transition: "background 0.4s, box-shadow 0.5s",
					transform: `scale(${breathScale})`,
					position: "relative",
					overflow: "visible",
				}}
			>
				{babyFace}
			</div>
			<svg width={400} height={120} style={{ display: "block", margin: "-40px auto 0", pointerEvents: "none" }}>
				{sparkles.map((s, i) => (
					<circle
						key={i}
						cx={s.x + 100}
						cy={s.y}
						r={2}
						fill="#ffd"
						opacity={1 - s.life / 60}
					/>
				))}
			</svg>
			<div style={{ textAlign: "center", marginTop: 0 }}>
				<div style={{ width: 300, margin: "0 auto", background: "#eee", height: 16, borderRadius: 8, overflow: "hidden" }}>
					<div
						style={{
							width: `${calm}%`,
							height: "100%",
							background: "linear-gradient(90deg, #88c, #aef)",
							transition: "width 0.3s",
						}}
					/>
				</div>
				<div style={{ fontSize: 12, marginTop: 4 }}>
					Calm: {Math.floor(calm)}/100 · Progress: {matched}/{pattern.length}
				</div>
				{allWon && <div style={{ color: "#383", fontSize: 18, marginTop: 8 }}>All babies sleeping...</div>}
			</div>
			<div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16 }}>
				{NOTES.map((n) => (
					<button
						key={n}
						type="button"
						onClick={() => press(n)}
						style={{
							width: 50,
							height: 120,
							background: "#fff",
							border: "1px solid #999",
							borderRadius: 6,
							fontSize: 18,
							cursor: "pointer",
						}}
					>
						{n}
					</button>
				))}
			</div>
			<div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 12, fontSize: 14 }}>
				{history.map((h, i) => (
					<span key={i} style={{ color: h.good ? "#383" : "#a33" }}>
						{h.note}
					</span>
				))}
			</div>
			<div style={{ textAlign: "center", marginTop: 12 }}>
				<button type="button" onClick={reset}>
					New nursery (seed {seed})
				</button>
			</div>
		</div>
	);
}
