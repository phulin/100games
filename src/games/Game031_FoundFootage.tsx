import { useEffect, useMemo, useRef, useState } from "react";

type AnomalyKind = "shimmer" | "shift" | "ghost" | "flicker" | "pulse";

type Anomaly = {
	id: number;
	x: number;
	y: number;
	r: number;
	phase: number;
	duration: number;
	kind: AnomalyKind;
	found: boolean;
	decoy: boolean;
};

type Difficulty = "easy" | "normal" | "hard";

const BEST_KEY = "game031_best_v2";

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

function diffParams(d: Difficulty) {
	switch (d) {
		case "easy":
			return { count: 4, decoys: 1, rMin: 34, rMax: 52, durMin: 0.25, durMax: 0.45, loopMs: 7000 };
		case "hard":
			return { count: 6, decoys: 3, rMin: 20, rMax: 32, durMin: 0.12, durMax: 0.22, loopMs: 5000 };
		default:
			return { count: 5, decoys: 2, rMin: 26, rMax: 42, durMin: 0.18, durMax: 0.32, loopMs: 6000 };
	}
}

function genAnomalies(seed: number, d: Difficulty): Anomaly[] {
	const p = diffParams(d);
	const r = mulberry32(seed);
	const kinds: AnomalyKind[] = ["shimmer", "shift", "ghost", "flicker", "pulse"];
	const total = p.count + p.decoys;
	return Array.from({ length: total }, (_, i) => ({
		id: i,
		x: 0.1 + r() * 0.8,
		y: 0.12 + r() * 0.76,
		r: p.rMin + r() * (p.rMax - p.rMin),
		phase: r(),
		duration: p.durMin + r() * (p.durMax - p.durMin),
		kind: kinds[Math.floor(r() * kinds.length)],
		found: false,
		decoy: i >= p.count,
	}));
}

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
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
function blip(freq: number, dur = 0.08, type: OscillatorType = "sine", gain = 0.08) {
	const ctx = getCtx();
	if (!ctx) return;
	const o = ctx.createOscillator();
	const g = ctx.createGain();
	o.type = type;
	o.frequency.value = freq;
	g.gain.value = 0;
	g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.005);
	g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
	o.connect(g).connect(ctx.destination);
	o.start();
	o.stop(ctx.currentTime + dur + 0.02);
}

export default function FoundFootage() {
	const [difficulty, setDifficulty] = useState<Difficulty>("normal");
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const params = useMemo(() => diffParams(difficulty), [difficulty]);
	const [anomalies, setAnomalies] = useState<Anomaly[]>(() => genAnomalies(seed, difficulty));
	const [t, setT] = useState(0);
	const [misses, setMisses] = useState(0);
	const [decoyHits, setDecoyHits] = useState(0);
	const [combo, setCombo] = useState(0);
	const [score, setScore] = useState(0);
	const [startTime, setStartTime] = useState(() => performance.now());
	const [best, setBest] = useState<number>(() => {
		const v = typeof localStorage !== "undefined" ? localStorage.getItem(BEST_KEY) : null;
		return v ? Number(v) : 0;
	});
	const startRef = useRef(performance.now());
	const canvasRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		setAnomalies(genAnomalies(seed, difficulty));
		setMisses(0);
		setDecoyHits(0);
		setCombo(0);
		setScore(0);
		startRef.current = performance.now();
		setStartTime(performance.now());
	}, [seed, difficulty]);

	useEffect(() => {
		let raf = 0;
		const tick = () => {
			const elapsed = (performance.now() - startRef.current) % params.loopMs;
			setT(elapsed / params.loopMs);
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [params.loopMs]);

	const isVisible = (a: Anomaly) => {
		const local = (t - a.phase + 1) % 1;
		return local < a.duration;
	};

	const handleClick = (e: React.MouseEvent) => {
		const rect = canvasRef.current!.getBoundingClientRect();
		const cx = (e.clientX - rect.left) / rect.width;
		const cy = (e.clientY - rect.top) / rect.height;
		let hit: Anomaly | null = null;
		setAnomalies((prev) => {
			const ng = prev.map((a) => {
				if (a.found) return a;
				const dx = (cx - a.x) * rect.width;
				const dy = (cy - a.y) * rect.height;
				if (Math.hypot(dx, dy) < a.r + 8 && isVisible(a)) {
					if (!hit) hit = a;
					return { ...a, found: true };
				}
				return a;
			});
			return ng;
		});
		if (hit) {
			const a = hit as Anomaly;
			if (a.decoy) {
				setDecoyHits((d) => d + 1);
				setCombo(0);
				setScore((s) => Math.max(0, s - 50));
				blip(180, 0.18, "sawtooth", 0.07);
			} else {
				setCombo((c) => c + 1);
				const gain = 100 + combo * 25;
				setScore((s) => s + gain);
				blip(560 + combo * 60, 0.1, "triangle", 0.09);
				blip(820 + combo * 60, 0.06, "sine", 0.05);
			}
		} else {
			setMisses((m) => m + 1);
			setCombo(0);
			setScore((s) => Math.max(0, s - 20));
			blip(120, 0.05, "square", 0.04);
		}
	};

	const realFound = anomalies.filter((a) => !a.decoy && a.found).length;
	const realTotal = params.count;
	const won = realFound === realTotal && realTotal > 0;
	const finalScore = useMemo(() => {
		if (!won) return score;
		const timeBonus = Math.max(0, 600 - Math.floor((performance.now() - startTime) / 100));
		return score + timeBonus;
	}, [won, score, startTime]);

	useEffect(() => {
		if (won && finalScore > best) {
			setBest(finalScore);
			try {
				localStorage.setItem(BEST_KEY, String(finalScore));
			} catch {
				/* ignore */
			}
			blip(880, 0.2, "triangle", 0.1);
			blip(1320, 0.25, "sine", 0.08);
		}
	}, [won, finalScore, best]);

	const newClip = () => setSeed(Math.floor(Math.random() * 1e9));

	const bgPhase = t * Math.PI * 2;

	return (
		<div style={{ background: "#0a0a0c", color: "#ddd", padding: 16, fontFamily: "monospace" }}>
			<h2 style={{ margin: "0 0 4px" }}>Found Footage</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Spot real anomalies hidden in the loop. Some flickers are decoys — punish those clicks. Combos boost score.
			</div>
			<div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
				<div>Found: {realFound}/{realTotal}</div>
				<div>Misses: {misses}</div>
				<div>Decoys hit: {decoyHits}</div>
				<div>Combo: x{combo}</div>
				<div>Score: {score}</div>
				<div style={{ opacity: 0.7 }}>Best: {best}</div>
				<div>Loop: {(t * 100).toFixed(0)}%</div>
				<select
					value={difficulty}
					onChange={(e) => setDifficulty(e.target.value as Difficulty)}
					style={selStyle}
				>
					<option value="easy">Easy</option>
					<option value="normal">Normal</option>
					<option value="hard">Hard</option>
				</select>
				<button type="button" onClick={newClip} style={btn}>
					New Clip
				</button>
				{won && <div style={{ color: "#7f7" }}>SOLVED · {finalScore}</div>}
			</div>
			<div
				ref={canvasRef}
				onClick={handleClick}
				style={{
					position: "relative",
					width: "100%",
					maxWidth: 860,
					aspectRatio: "16 / 10",
					background: `radial-gradient(circle at ${50 + Math.sin(bgPhase) * 10}% ${50 + Math.cos(bgPhase) * 10}%, #2a2a35, #0c0c10 70%)`,
					border: "2px solid #333",
					overflow: "hidden",
					cursor: "crosshair",
					filter: "contrast(1.05)",
				}}
			>
				<div
					style={{
						position: "absolute",
						inset: 0,
						backgroundImage:
							"repeating-linear-gradient(0deg, rgba(0,0,0,0.18) 0 1px, transparent 1px 3px)",
						pointerEvents: "none",
					}}
				/>
				<div
					style={{
						position: "absolute",
						inset: 0,
						opacity: 0.18,
						mixBlendMode: "overlay",
						backgroundImage:
							"radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), radial-gradient(rgba(0,0,0,0.5) 1px, transparent 1px)",
						backgroundSize: "3px 3px, 5px 5px",
						backgroundPosition: `${Math.floor(t * 200)}px ${Math.floor(t * 300)}px, 0 0`,
						pointerEvents: "none",
					}}
				/>
				{anomalies.map((a) => {
					const vis = isVisible(a);
					if (!vis && !a.found) return null;
					const local = (t - a.phase + 1) % 1;
					const phaseT = local / a.duration;
					const alpha = Math.sin(phaseT * Math.PI);
					const baseAlpha = a.decoy ? alpha * 0.5 : alpha;
					return (
						<div
							key={a.id}
							style={{
								position: "absolute",
								left: `calc(${a.x * 100}% - ${a.r}px)`,
								top: `calc(${a.y * 100}% - ${a.r}px)`,
								width: a.r * 2,
								height: a.r * 2,
								borderRadius: "50%",
								background: a.found
									? a.decoy
										? "rgba(255,120,120,0.35)"
										: "rgba(120,255,140,0.35)"
									: a.kind === "shimmer"
										? `radial-gradient(circle, rgba(255,255,255,${baseAlpha * 0.35}), transparent 70%)`
										: a.kind === "shift"
											? `radial-gradient(circle, rgba(180,200,255,${baseAlpha * 0.35}), transparent 70%)`
											: a.kind === "ghost"
												? `radial-gradient(circle, rgba(255,180,180,${baseAlpha * 0.32}), transparent 70%)`
												: a.kind === "flicker"
													? `radial-gradient(circle, rgba(255,255,180,${baseAlpha * (Math.sin(phaseT * 30) * 0.5 + 0.5) * 0.4}), transparent 70%)`
													: `radial-gradient(circle, rgba(200,160,255,${baseAlpha * 0.34}), transparent 70%)`,
								border: a.found ? `2px solid ${a.decoy ? "#f66" : "#6f6"}` : "none",
								pointerEvents: "none",
								transition: a.found ? "all 0.3s" : undefined,
							}}
						/>
					);
				})}
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#222",
	color: "#ddd",
	border: "1px solid #444",
	padding: "4px 10px",
	cursor: "pointer",
	fontFamily: "monospace",
};

const selStyle: React.CSSProperties = {
	background: "#1a1a1a",
	color: "#ddd",
	border: "1px solid #444",
	padding: "3px 6px",
	fontFamily: "monospace",
};
