import { useEffect, useRef, useState } from "react";

// Slow Race — the slowest car wins, but you can't fully stop, and downhill forces acceleration.

type Segment = { x: number; slope: number; bump: number };

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeTrack(seed: number, len: number): Segment[] {
	const rng = mulberry32(seed);
	const segs: Segment[] = [];
	let slope = 0;
	for (let i = 0; i < len; i++) {
		slope = slope * 0.6 + (rng() * 2 - 1) * 0.7;
		if (slope > 0.95) slope = 0.95;
		if (slope < -0.95) slope = -0.95;
		const bump = rng() < 0.08 ? (rng() * 2 - 1) * 0.6 : 0;
		segs.push({ x: i, slope, bump });
	}
	return segs;
}

function useEngineAudio() {
	const ctxRef = useRef<AudioContext | null>(null);
	const oscRef = useRef<OscillatorNode | null>(null);
	const gainRef = useRef<GainNode | null>(null);
	const brakeRef = useRef<{ src: AudioBufferSourceNode; gain: GainNode } | null>(null);

	const ensure = () => {
		if (!ctxRef.current) {
			try {
				ctxRef.current = new (window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
				const ctx = ctxRef.current;
				const o = ctx.createOscillator();
				const g = ctx.createGain();
				o.type = "sawtooth";
				o.frequency.value = 80;
				g.gain.value = 0;
				o.connect(g).connect(ctx.destination);
				o.start();
				oscRef.current = o;
				gainRef.current = g;
				const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
				const d = buf.getChannelData(0);
				for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
				const src = ctx.createBufferSource();
				src.buffer = buf;
				src.loop = true;
				const bg = ctx.createGain();
				bg.gain.value = 0;
				const bp = ctx.createBiquadFilter();
				bp.type = "highpass";
				bp.frequency.value = 1200;
				src.connect(bp).connect(bg).connect(ctx.destination);
				src.start();
				brakeRef.current = { src, gain: bg };
			} catch {
				/* audio not available */
			}
		}
		return ctxRef.current;
	};

	const setEngine = (speed: number, braking: boolean) => {
		const ctx = ctxRef.current;
		if (!ctx || !oscRef.current || !gainRef.current) return;
		oscRef.current.frequency.setTargetAtTime(60 + speed * 110, ctx.currentTime, 0.05);
		gainRef.current.gain.setTargetAtTime(0.05 + speed * 0.05, ctx.currentTime, 0.1);
		if (brakeRef.current) {
			brakeRef.current.gain.gain.setTargetAtTime(braking ? 0.07 : 0, ctx.currentTime, 0.05);
		}
	};

	const stop = () => {
		const ctx = ctxRef.current;
		if (!ctx) return;
		if (gainRef.current) gainRef.current.gain.value = 0;
		if (brakeRef.current) brakeRef.current.gain.gain.value = 0;
	};

	const crashSfx = () => {
		const ctx = ensure();
		if (!ctx) return;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = "square";
		o.frequency.setValueAtTime(180, ctx.currentTime);
		o.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.6);
		g.gain.setValueAtTime(0.2, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + 0.7);
	};

	const finishSfx = () => {
		const ctx = ensure();
		if (!ctx) return;
		[523, 659, 784].forEach((f, i) => {
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.type = "triangle";
			o.frequency.value = f;
			g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.12);
			g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01 + i * 0.12);
			g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4 + i * 0.12);
			o.connect(g).connect(ctx.destination);
			o.start(ctx.currentTime + i * 0.12);
			o.stop(ctx.currentTime + 0.5 + i * 0.12);
		});
	};

	return { ensure, setEngine, stop, crashSfx, finishSfx };
}

type Difficulty = "easy" | "normal" | "hard";
const DIFFS: Record<Difficulty, { len: number; crashV: number; idle: number; slope: number }> = {
	easy: { len: 24, crashV: 1.8, idle: 0.06, slope: 0.5 },
	normal: { len: 36, crashV: 1.6, idle: 0.07, slope: 0.6 },
	hard: { len: 52, crashV: 1.4, idle: 0.09, slope: 0.75 },
};

export default function Game041_SlowRace() {
	const [diff, setDiff] = useState<Difficulty>("normal");
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [track, setTrack] = useState<Segment[]>(() => makeTrack(seed, DIFFS.normal.len));
	const [pos, setPos] = useState(0);
	const [vel, setVel] = useState(0.4);
	const [holding, setHolding] = useState(false);
	const [time, setTime] = useState(0);
	const [done, setDone] = useState(false);
	const [crashed, setCrashed] = useState(false);
	const [topV, setTopV] = useState(0);
	const [best, setBest] = useState<Record<Difficulty, number | null>>(() => {
		const v = localStorage.getItem("slowrace_best_v2");
		if (v) {
			try {
				return JSON.parse(v);
			} catch {
				/* ignore */
			}
		}
		return { easy: null, normal: null, hard: null };
	});
	const lastT = useRef(0);
	const holdingRef = useRef(false);
	const posRef = useRef(0);
	const velRef = useRef(0.4);
	const topVRef = useRef(0);
	const audio = useEngineAudio();
	const cfg = DIFFS[diff];

	useEffect(() => {
		holdingRef.current = holding;
	}, [holding]);

	useEffect(() => {
		let raf = 0;
		const step = (t: number) => {
			if (!lastT.current) lastT.current = t;
			const dt = Math.min(0.05, (t - lastT.current) / 1000);
			lastT.current = t;
			if (!done && !crashed) {
				const idx = Math.min(track.length - 1, Math.floor(posRef.current));
				const seg = track[idx];
				let accel = -seg.slope * cfg.slope;
				accel += seg.bump * 0.4;
				if (holdingRef.current) accel -= 0.45;
				accel += cfg.idle;
				let v = velRef.current + accel * dt;
				if (v < cfg.idle + 0.01) v = cfg.idle + 0.01;
				if (v > cfg.crashV) {
					setCrashed(true);
					audio.crashSfx();
					audio.stop();
					return;
				}
				velRef.current = v;
				if (v > topVRef.current) {
					topVRef.current = v;
					setTopV(v);
				}
				posRef.current += v * dt * 2;
				setVel(v);
				setPos(posRef.current);
				setTime((tt) => tt + dt);
				audio.setEngine(v / cfg.crashV, holdingRef.current);
				if (posRef.current >= track.length - 1) {
					setDone(true);
					audio.finishSfx();
					audio.stop();
					setBest((b) => {
						const cur = b[diff];
						const newTime = time + dt;
						if (cur == null || newTime > cur) {
							const nb = { ...b, [diff]: newTime };
							localStorage.setItem("slowrace_best_v2", JSON.stringify(nb));
							return nb;
						}
						return b;
					});
					return;
				}
			}
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [track, done, crashed, time, diff, audio, cfg]);

	const reset = (opts?: { seed?: number; diff?: Difficulty }) => {
		const ns = opts?.seed ?? seed + 1;
		const nd = opts?.diff ?? diff;
		setSeed(ns);
		setDiff(nd);
		setTrack(makeTrack(ns, DIFFS[nd].len));
		setPos(0);
		setVel(0.4);
		posRef.current = 0;
		velRef.current = 0.4;
		topVRef.current = 0;
		setTopV(0);
		lastT.current = 0;
		setTime(0);
		setDone(false);
		setCrashed(false);
	};

	const W = 880;
	const H = 520;
	const carIdx = Math.floor(pos);
	const startIdx = Math.max(0, carIdx - 5);
	const endIdx = Math.min(track.length, startIdx + 16);
	const segWidth = W / 14;

	let y = H / 2;
	const points: { x: number; y: number; slope: number }[] = [];
	for (let i = startIdx; i < endIdx; i++) {
		const sx = (i - startIdx) * segWidth;
		points.push({ x: sx, y, slope: track[i].slope });
		y += track[i].slope * 30;
	}
	const carX = (pos - startIdx) * segWidth;
	const carY = points[Math.floor(pos) - startIdx]?.y ?? H / 2;
	const progress = pos / (track.length - 1);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#1a1d2b",
				color: "#eaeaea",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "system-ui, sans-serif",
				userSelect: "none",
			}}
			onMouseDown={() => {
				audio.ensure();
				setHolding(true);
			}}
			onMouseUp={() => setHolding(false)}
			onMouseLeave={() => setHolding(false)}
		>
			<div style={{ marginBottom: 8, textAlign: "center" }}>
				<h2 style={{ margin: 0 }}>Slow Race</h2>
				<div style={{ fontSize: 13, opacity: 0.7 }}>
					Hold mouse to brake. Don't stop, don't crash, finish as slowly as possible. (Seed {seed})
				</div>
			</div>
			<svg width={W} height={H} style={{ background: "#0e1018", borderRadius: 8 }}>
				<polyline
					points={points.map((p) => `${p.x},${p.y}`).join(" ")}
					stroke="#4a5"
					strokeWidth={4}
					fill="none"
				/>
				{points.map((p, i) => (
					<rect
						key={i}
						x={p.x - 2}
						y={p.y}
						width={4}
						height={H - p.y}
						fill={p.slope < -0.3 ? "#723" : p.slope > 0.3 ? "#346" : "#222"}
						opacity={0.4}
					/>
				))}
				{track.length - 1 >= startIdx && track.length - 1 < endIdx && (
					<line
						x1={(track.length - 1 - startIdx) * segWidth}
						x2={(track.length - 1 - startIdx) * segWidth}
						y1={0}
						y2={H}
						stroke="#ff0"
						strokeDasharray="5 5"
						/>
				)}
				<circle cx={carX} cy={carY - 10} r={10} fill={crashed ? "#f33" : "#fc6"} />
				<rect x={20} y={20} width={200} height={14} fill="#222" />
				<rect
					x={20}
					y={20}
					width={200 * (vel / cfg.crashV)}
					height={14}
					fill={vel > cfg.crashV * 0.85 ? "#f33" : vel > cfg.crashV * 0.6 ? "#fb0" : "#3c5"}
				/>
				{topV > 0 && (
					<line
						x1={20 + 200 * (topV / cfg.crashV)}
						x2={20 + 200 * (topV / cfg.crashV)}
						y1={16}
						y2={38}
						stroke="#fff"
						strokeDasharray="2 2"
					/>
				)}
				<text x={20} y={50} fill="#aaa" fontSize={12}>
					speed (white tick = run peak) — time: {time.toFixed(2)}s
				</text>
				<g transform={`translate(${W - 260}, 16)`}>
					<rect width={240} height={28} fill="#222" rx={4} />
					{track.map((s, i) => (
						<rect
							key={i}
							x={(i / track.length) * 240}
							y={12 - s.slope * 10}
							width={240 / track.length}
							height={Math.abs(s.slope) * 10 + 2}
							fill={s.slope > 0 ? "#346" : "#723"}
							opacity={0.7}
						/>
					))}
					<rect x={progress * 240 - 1} y={0} width={2} height={28} fill="#fc6" />
				</g>
			</svg>
			<div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
				{(done || crashed) && (
					<button type="button" onClick={() => reset()} style={btn}>
						{crashed ? "Crashed — retry" : `Finished in ${time.toFixed(2)}s — next track`}
					</button>
				)}
				<div style={{ display: "flex", gap: 4 }}>
					{(Object.keys(DIFFS) as Difficulty[]).map((d) => (
						<button
							type="button"
							key={d}
							onClick={() => reset({ diff: d, seed })}
							style={{ ...btn, background: d === diff ? "#445" : "#2a3045" }}
						>
							{d}
						</button>
					))}
				</div>
				<div style={{ opacity: 0.7 }}>
					Best ({diff}): {best[diff] != null ? `${(best[diff] as number).toFixed(2)}s` : "—"}
				</div>
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#2a3045",
	color: "#fff",
	border: "1px solid #445",
	padding: "8px 14px",
	borderRadius: 6,
	cursor: "pointer",
};
