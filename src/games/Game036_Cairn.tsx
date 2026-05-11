import { useEffect, useMemo, useRef, useState } from "react";

// Stack stones into a cairn. Seeded procedural stone shapes, wind gusts, and
// scoring. WebAudio for thuds and chimes. Tower height contributes to score.

type Stone = {
	x: number;
	y: number;
	w: number;
	h: number;
	angle: number;
	vx: number;
	vy: number;
	va: number;
	settled: boolean;
	hue: number;
};

type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number };

const W = 700;
const H = 540;
const GROUND_Y = 510;
const STONES_PER_RUN = 10;

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

function getCorners(s: Stone) {
	const cos = Math.cos(s.angle);
	const sin = Math.sin(s.angle);
	const hw = s.w / 2;
	const hh = s.h / 2;
	const pts = [
		[-hw, -hh],
		[hw, -hh],
		[hw, hh],
		[-hw, hh],
	];
	return pts.map(([px, py]) => ({ x: s.x + px * cos - py * sin, y: s.y + px * sin + py * cos }));
}

function rectsOverlap(a: Stone, b: Stone) {
	const axes = [a, b].flatMap((s) => {
		const c = Math.cos(s.angle);
		const sn = Math.sin(s.angle);
		return [
			{ x: c, y: sn },
			{ x: -sn, y: c },
		];
	});
	const ac = getCorners(a);
	const bc = getCorners(b);
	for (const axis of axes) {
		let minA = Infinity,
			maxA = -Infinity,
			minB = Infinity,
			maxB = -Infinity;
		for (const p of ac) {
			const d = p.x * axis.x + p.y * axis.y;
			minA = Math.min(minA, d);
			maxA = Math.max(maxA, d);
		}
		for (const p of bc) {
			const d = p.x * axis.x + p.y * axis.y;
			minB = Math.min(minB, d);
			maxB = Math.max(maxB, d);
		}
		if (maxA < minB || maxB < minA) return false;
	}
	return true;
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

function thud(intensity: number) {
	const ctx = getAudio();
	if (!ctx) return;
	const t = ctx.currentTime;
	const bufSize = Math.floor(ctx.sampleRate * 0.25);
	const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < bufSize; i++) {
		const k = i / bufSize;
		data[i] = (Math.random() * 2 - 1) * Math.exp(-k * 8) * intensity;
	}
	const src = ctx.createBufferSource();
	src.buffer = buf;
	const filter = ctx.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.value = 200 + intensity * 200;
	const g = ctx.createGain();
	g.gain.value = 0.5;
	src.connect(filter).connect(g).connect(ctx.destination);
	src.start(t);
}

function chime(freq: number) {
	const ctx = getAudio();
	if (!ctx) return;
	const t = ctx.currentTime;
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.frequency.value = freq;
	osc.type = "sine";
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
	g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
	osc.connect(g).connect(ctx.destination);
	osc.start(t);
	osc.stop(t + 1.3);
}

function topple() {
	const ctx = getAudio();
	if (!ctx) return;
	const t = ctx.currentTime;
	for (let i = 0; i < 5; i++) {
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.frequency.setValueAtTime(120 - i * 15, t + i * 0.05);
		osc.type = "sawtooth";
		g.gain.setValueAtTime(0.0001, t + i * 0.05);
		g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.05 + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.05 + 0.25);
		osc.connect(g).connect(ctx.destination);
		osc.start(t + i * 0.05);
		osc.stop(t + i * 0.05 + 0.3);
	}
}

export default function Cairn() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const rngRef = useRef(mulberry32(seed));
	const [stones, setStones] = useState<Stone[]>([]);
	const [placed, setPlaced] = useState(0);
	const [previewX, setPreviewX] = useState(W / 2);
	const [holdTime, setHoldTime] = useState(0);
	const [status, setStatus] = useState<"playing" | "won" | "fallen">("playing");
	const [wind, setWind] = useState(0);
	const [bestHeight, setBestHeight] = useState(() => {
		try {
			return parseFloat(localStorage.getItem("cairn_best_height") || "0");
		} catch {
			return 0;
		}
	});
	const [score, setScore] = useState(0);
	const [particles, setParticles] = useState<Particle[]>([]);
	const lastT = useRef(performance.now());
	const stonesRef = useRef(stones);
	stonesRef.current = stones;
	const windPhaseRef = useRef(0);

	const next = useMemo(() => {
		const r = rngRef.current;
		const w = 50 + r() * 80;
		const h = 22 + r() * 30;
		const hue = 20 + r() * 40;
		return { w, h, hue };
	}, [placed, seed]);

	useEffect(() => {
		rngRef.current = mulberry32(seed);
	}, [seed]);

	useEffect(() => {
		let raf = 0;
		const step = (now: number) => {
			const dt = Math.min(0.033, (now - lastT.current) / 1000);
			lastT.current = now;
			windPhaseRef.current += dt;
			const wp = windPhaseRef.current;
			const w =
				Math.sin(wp * 0.6) * 18 +
				Math.sin(wp * 1.7 + 1.3) * 10 +
				(Math.sin(wp * 3.1) > 0.85 ? Math.sin(wp * 11) * 40 : 0);
			setWind(w);

			setStones((prev) => {
				const ns = prev.map((s) => ({ ...s }));
				for (const s of ns) {
					if (s.settled) continue;
					s.vy += 800 * dt;
					s.vx += w * dt * 0.6;
					s.x += s.vx * dt;
					s.y += s.vy * dt;
					s.angle += s.va * dt;
					s.va *= 0.99;
					const corners = getCorners(s);
					const lowest = Math.max(...corners.map((c) => c.y));
					if (lowest > GROUND_Y) {
						const overlap = lowest - GROUND_Y;
						s.y -= overlap;
						const impact = Math.abs(s.vy);
						if (impact > 80) {
							thud(Math.min(1, impact / 400));
							setParticles((ps) => {
								const add: Particle[] = [];
								for (let k = 0; k < 8; k++) {
									add.push({
										x: s.x + (Math.random() - 0.5) * s.w,
										y: GROUND_Y,
										vx: (Math.random() - 0.5) * 80,
										vy: -Math.random() * 60,
										life: 0,
										max: 0.6 + Math.random() * 0.4,
									});
								}
								return [...ps.slice(-40), ...add];
							});
						}
						s.vy *= -0.2;
						const idx = corners.findIndex((c) => c.y === lowest);
						const lp = corners[idx];
						const dx = lp.x - s.x;
						s.va += dx * 0.001;
						s.vy *= 0.7;
						s.vx *= 0.85;
						if (Math.abs(s.vy) < 5 && Math.abs(s.va) < 0.05) {
							s.vy = 0;
							s.va *= 0.5;
						}
					}
				}
				for (let i = 0; i < ns.length; i++) {
					for (let j = 0; j < ns.length; j++) {
						if (i === j) continue;
						const a = ns[i];
						const b = ns[j];
						if (a.settled) continue;
						if (rectsOverlap(a, b)) {
							const dy = a.y - b.y;
							const push = Math.min(5, b.h * 0.5 + a.h * 0.5 - Math.abs(dy));
							a.y -= push;
							a.vy = Math.min(a.vy, 0) * 0.3;
							const offset = a.x - b.x;
							a.va += offset * 0.0008;
							a.vx += offset * 0.1 * dt;
						}
					}
				}
				return ns;
			});

			setParticles((ps) =>
				ps
					.map((p) => ({
						...p,
						life: p.life + dt,
						x: p.x + p.vx * dt,
						y: p.y + p.vy * dt,
						vy: p.vy + 200 * dt,
					}))
					.filter((p) => p.life < p.max),
			);

			const cur = stonesRef.current;
			const anyMoving = cur.some(
				(s) => Math.abs(s.vy) > 3 || Math.abs(s.vx) > 3 || Math.abs(s.va) > 0.04,
			);
			const anyFallen = cur.some((s) => {
				const corners = getCorners(s);
				return corners.every((c) => c.x < 0 || c.x > W);
			});
			if (anyFallen && status === "playing") {
				topple();
				setStatus("fallen");
			}
			if (placed >= STONES_PER_RUN && !anyMoving && status === "playing") {
				setHoldTime((t) => t + dt);
			} else if (anyMoving) {
				setHoldTime(0);
			}
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [placed, status]);

	const towerHeight = useMemo(() => {
		if (stones.length === 0) return 0;
		const top = Math.min(...stones.flatMap((s) => getCorners(s).map((c) => c.y)));
		return Math.max(0, GROUND_Y - top);
	}, [stones]);

	useEffect(() => {
		if (holdTime >= 3 && status === "playing" && placed >= STONES_PER_RUN) {
			setStatus("won");
			chime(523);
			setTimeout(() => chime(659), 180);
			setTimeout(() => chime(784), 360);
			const finalScore = Math.round(towerHeight + placed * 10);
			setScore(finalScore);
			if (towerHeight > bestHeight) {
				setBestHeight(towerHeight);
				try {
					localStorage.setItem("cairn_best_height", String(towerHeight));
				} catch {
					/* ignore */
				}
			}
		}
	}, [holdTime, placed, status, towerHeight, bestHeight]);

	const handleClick = () => {
		if (placed >= STONES_PER_RUN || status !== "playing") return;
		const r = rngRef.current;
		const stone: Stone = {
			x: previewX,
			y: 60,
			w: next.w,
			h: next.h,
			angle: (r() - 0.5) * 0.4,
			vx: 0,
			vy: 0,
			va: 0,
			settled: false,
			hue: next.hue,
		};
		setStones((s) => [...s, stone]);
		setPlaced((p) => p + 1);
		setHoldTime(0);
	};

	const reset = () => {
		const s = Math.floor(Math.random() * 1e9);
		setSeed(s);
		rngRef.current = mulberry32(s);
		setStones([]);
		setPlaced(0);
		setHoldTime(0);
		setStatus("playing");
		setScore(0);
		setParticles([]);
	};

	return (
		<div style={{ background: "#181a1f", color: "#eee", padding: 16, fontFamily: "sans-serif" }}>
			<h2 style={{ margin: "0 0 4px" }}>Cairn</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Aim, drop {STONES_PER_RUN} stones. Hold steady 3s to win. Mind the wind.
			</div>
			<div style={{ display: "flex", gap: 12, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
				<div>Placed: {placed}/{STONES_PER_RUN}</div>
				<div>Hold: {holdTime.toFixed(1)}s / 3.0s</div>
				<div>Height: {Math.round(towerHeight)}</div>
				<div style={{ opacity: 0.7 }}>Best: {Math.round(bestHeight)}</div>
				<div style={{ display: "flex", alignItems: "center", gap: 4 }}>
					Wind:
					<div style={{ width: 60, height: 8, background: "#333", borderRadius: 4, position: "relative" }}>
						<div
							style={{
								position: "absolute",
								left: 30,
								width: Math.abs(wind) * 1.2,
								height: 8,
								background: wind > 0 ? "#a84" : "#48a",
								transform: wind < 0 ? `translateX(-${Math.abs(wind) * 1.2}px)` : undefined,
								borderRadius: 4,
							}}
						/>
					</div>
				</div>
				<button type="button" onClick={reset}>
					New seed
				</button>
				<span style={{ opacity: 0.5, fontSize: 11 }}>seed: {seed}</span>
				{status === "won" && <span style={{ color: "#7f7" }}>WIN · score {score}</span>}
				{status === "fallen" && <span style={{ color: "#f77" }}>Toppled!</span>}
			</div>
			<svg
				width={W}
				height={H}
				style={{ background: "linear-gradient(#1a2030, #20242a)", cursor: "crosshair", display: "block" }}
				onMouseMove={(e) => {
					const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
					setPreviewX(e.clientX - r.left);
				}}
				onClick={handleClick}
			>
				<defs>
					<linearGradient id="ground" x1="0" x2="0" y1="0" y2="1">
						<stop offset="0" stopColor="#3a2a1a" />
						<stop offset="1" stopColor="#221610" />
					</linearGradient>
				</defs>
				<rect x={0} y={GROUND_Y} width={W} height={H - GROUND_Y} fill="url(#ground)" />
				{Array.from({ length: 6 }, (_, i) => {
					const base = (i * 113 + ((windPhaseRef.current * wind * 4) % W) + W) % W;
					return (
						<line
							key={i}
							x1={base}
							y1={50 + i * 60}
							x2={base + wind * 1.5}
							y2={50 + i * 60}
							stroke="rgba(255,255,255,0.08)"
							strokeWidth={1}
						/>
					);
				})}
				{placed < STONES_PER_RUN && status === "playing" && (
					<rect
						x={previewX - next.w / 2}
						y={40 - next.h / 2}
						width={next.w}
						height={next.h}
						fill={`hsla(${next.hue}, 15%, 55%, 0.35)`}
						stroke="#aaa"
						strokeDasharray="3 3"
					/>
				)}
				{stones.map((s, i) => {
					const corners = getCorners(s);
					const pts = corners.map((c) => `${c.x},${c.y}`).join(" ");
					return (
						<g key={i}>
							<polygon
								points={pts}
								fill={`hsl(${s.hue}, 14%, ${42 + (i % 3) * 6}%)`}
								stroke={`hsl(${s.hue}, 20%, 18%)`}
								strokeWidth={1.5}
							/>
							<polygon
								points={`${corners[0].x},${corners[0].y} ${corners[1].x},${corners[1].y} ${(corners[0].x + corners[1].x) / 2},${(corners[0].y + corners[1].y) / 2 + 4}`}
								fill={`hsla(${s.hue}, 25%, 70%, 0.35)`}
							/>
						</g>
					);
				})}
				{particles.map((p, i) => (
					<circle
						key={i}
						cx={p.x}
						cy={p.y}
						r={2}
						fill="rgba(180,160,130,0.5)"
						opacity={1 - p.life / p.max}
					/>
				))}
			</svg>
		</div>
	);
}
