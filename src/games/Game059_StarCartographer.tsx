import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Game 59: Star Cartographer — seeded RNG, audio chimes, mistake/peek-penalized scoring, animated twinkle.

const W = 900;
const H = 600;
const BEST_KEY = "star-cartographer:best";

type Star = { x: number; y: number; r: number; idx: number };

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hashStr(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
	}
	return h >>> 0;
}

function generatePattern(level: number, runSeed: string): Star[] {
	const rng = mulberry32(hashStr(`sc-p:${runSeed}:${level}`));
	const n = 4 + level;
	const stars: Star[] = [];
	const cx = W / 2;
	const cy = H / 2;
	for (let i = 0; i < n; i++) {
		const a = (i / n) * Math.PI * 2 + rng() * 0.6;
		const r = 120 + rng() * 150;
		stars.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r, r: 5 + rng() * 3, idx: i });
	}
	return stars;
}

function generateDecoys(level: number, runSeed: string, existing: Star[]): Star[] {
	const rng = mulberry32(hashStr(`sc-d:${runSeed}:${level}`));
	const n = 30 + level * 3;
	const decoys: { x: number; y: number; r: number }[] = [];
	for (let i = 0; i < n; i++) {
		let x = 0;
		let y = 0;
		let tries = 0;
		do {
			x = 50 + rng() * (W - 100);
			y = 50 + rng() * (H - 100);
			tries++;
		} while (tries < 20 && existing.some((s) => Math.hypot(s.x - x, s.y - y) < 35));
		decoys.push({ x, y, r: 2 + rng() * 3 });
	}
	return decoys.map((d, i) => ({ ...d, idx: 1000 + i }));
}

function generateBackground(runSeed: string) {
	const rng = mulberry32(hashStr(`sc-bg:${runSeed}`));
	return Array.from({ length: 80 }, (_, i) => ({
		x: rng() * W,
		y: rng() * H,
		phase: rng() * Math.PI * 2,
		i,
	}));
}

function useAudio() {
	const ctxRef = useRef<AudioContext | null>(null);
	const ensure = useCallback(() => {
		if (!ctxRef.current) {
			try {
				const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
					?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
				if (Ctor) ctxRef.current = new Ctor();
			} catch {}
		}
		return ctxRef.current;
	}, []);
	const chime = useCallback((freq: number, dur = 0.4) => {
		const ctx = ensure();
		if (!ctx) return;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = "sine";
		o.frequency.value = freq;
		g.gain.setValueAtTime(0.0001, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + dur + 0.02);
	}, [ensure]);
	const wrong = useCallback(() => chime(160, 0.3), [chime]);
	const complete = useCallback(() => {
		[523.25, 659.25, 783.99, 1046.5].forEach((f, i) => setTimeout(() => chime(f, 0.5), i * 100));
	}, [chime]);
	return { chime, wrong, complete };
}

export default function StarCartographer() {
	const [runSeed, setRunSeed] = useState(() => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
	const [level, setLevel] = useState(1);
	const pattern = useMemo(() => generatePattern(level, runSeed), [level, runSeed]);
	const decoys = useMemo(() => generateDecoys(level, runSeed, pattern), [level, runSeed, pattern]);
	const background = useMemo(() => generateBackground(runSeed), [runSeed]);
	const [shown, setShown] = useState(true);
	const [progress, setProgress] = useState(0);
	const [score, setScore] = useState(0);
	const [mistakes, setMistakes] = useState(0);
	const [peeks, setPeeks] = useState(0);
	const [msg, setMsg] = useState("");
	const [twinkleTick, setTwinkleTick] = useState(0);
	const audio = useAudio();
	const [best, setBest] = useState<number>(() => {
		try {
			return Number.parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10) || 0;
		} catch {
			return 0;
		}
	});

	useEffect(() => {
		setShown(true);
		setProgress(0);
		setMsg("");
		const id = setTimeout(() => setShown(false), 3500);
		return () => clearTimeout(id);
	}, [pattern]);

	useEffect(() => {
		const id = setInterval(() => setTwinkleTick((t) => (t + 1) % 1000), 200);
		return () => clearInterval(id);
	}, []);

	function click(s: Star) {
		if (shown) return;
		if (s.idx >= 1000) {
			audio.wrong();
			setMistakes((m) => m + 1);
			setMsg("Decoy! Restart trace from index 0.");
			setProgress(0);
			return;
		}
		if (s.idx === progress) {
			audio.chime(440 + s.idx * 60, 0.3);
			const np = progress + 1;
			if (np >= pattern.length) {
				const earned = Math.max(0, level * 20 - mistakes * 5 - peeks * 8);
				setScore((sc) => sc + earned);
				audio.complete();
				setMsg(`Constellation traced! +${earned}`);
				const lv = level + 1;
				setTimeout(() => {
					setMistakes(0);
					setPeeks(0);
					setLevel(lv);
				}, 1200);
			} else {
				setProgress(np);
			}
		} else {
			audio.wrong();
			setMistakes((m) => m + 1);
			setMsg("Wrong star. Restart from index 0.");
			setProgress(0);
		}
	}

	function reveal() {
		if (shown) return;
		setPeeks((p) => p + 1);
		setShown(true);
		setTimeout(() => setShown(false), 1800);
	}

	function newSeed() {
		setRunSeed(`${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
		setLevel(1);
		setScore(0);
		setMistakes(0);
		setPeeks(0);
	}

	useEffect(() => {
		if (score > best) {
			setBest(score);
			try {
				localStorage.setItem(BEST_KEY, String(score));
			} catch {}
		}
	}, [score, best]);

	return (
		<div style={{ background: "#02030c", color: "#dde6ff", padding: 14, fontFamily: "Cambria, serif" }}>
			<h2 style={{ margin: 0 }}>Star Cartographer</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				A constellation is shown briefly. Click the stars in order (start → end) to trace it. Avoid decoy stars. Peeks and mistakes cost score.
			</div>
			<div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
				<div>Level: {level}</div>
				<div>Stars: {progress}/{pattern.length}</div>
				<div>Score: {score}</div>
				<div>Best: {best}</div>
				<div style={{ opacity: 0.7 }}>Mistakes: {mistakes}</div>
				<div style={{ opacity: 0.7 }}>Peeks: {peeks}</div>
				<button type="button" onClick={reveal} style={{ background: "#4a5a8a", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
					Peek (-8 pts)
				</button>
				<button type="button" onClick={newSeed} style={{ background: "#1a2a4a", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
					New Sky
				</button>
				<div style={{ color: "#ffe07a" }}>{msg}</div>
			</div>
			<svg
				width={W}
				height={H}
				style={{
					display: "block",
					marginTop: 8,
					background: "radial-gradient(ellipse at 30% 20%, #1a1a3a, #02030c 70%)",
					borderRadius: 6,
				}}
			>
				{background.map((b) => (
					<circle
						key={`bg${b.i}`}
						cx={b.x}
						cy={b.y}
						r={0.7}
						fill="#fff"
						opacity={0.3 + 0.3 * (0.5 + 0.5 * Math.sin(b.phase + twinkleTick * 0.5))}
					/>
				))}
				{shown &&
					pattern.slice(1).map((s, i) => (
						<line
							key={`p${i}`}
							x1={pattern[i].x}
							y1={pattern[i].y}
							x2={s.x}
							y2={s.y}
							stroke="#7ad6ff"
							strokeWidth={1.5}
							strokeDasharray="4 4"
							opacity={0.7}
						/>
					))}
				{Array.from({ length: progress - 1 }).map((_, i) => (
					<line key={`d${i}`} x1={pattern[i].x} y1={pattern[i].y} x2={pattern[i + 1].x} y2={pattern[i + 1].y} stroke="#ffd07a" strokeWidth={2} />
				))}
				{decoys.map((d) => (
					<circle key={`dec${d.idx}`} cx={d.x} cy={d.y} r={d.r} fill="#fff" opacity={0.7} onClick={() => click(d)} style={{ cursor: shown ? "default" : "pointer" }} />
				))}
				{pattern.map((s) => {
					const done = s.idx < progress;
					const next = s.idx === progress;
					return (
						<g key={`s${s.idx}`} onClick={() => click(s)} style={{ cursor: shown ? "default" : "pointer" }}>
							<circle cx={s.x} cy={s.y} r={s.r + 8} fill={shown || done || next ? "#ffd07a" : "#fff"} opacity={0.15} />
							<circle cx={s.x} cy={s.y} r={s.r + 2} fill={done ? "#ffd07a" : next ? "#7ad6ff" : "#fff"} />
							{shown && <text x={s.x + 8} y={s.y - 6} fill="#7ad6ff" fontSize={12}>{s.idx}</text>}
						</g>
					);
				})}
			</svg>
		</div>
	);
}
