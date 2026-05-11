import { useEffect, useRef, useState } from "react";

// Slow Race — the slowest car wins, but you can't fully stop, and downhill forces acceleration.

type Segment = { x: number; slope: number }; // slope: -1 downhill .. +1 uphill

function makeTrack(seed: number, len = 30): Segment[] {
	let s = seed;
	const rng = () => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
	const segs: Segment[] = [];
	for (let i = 0; i < len; i++) {
		const slope = (rng() * 2 - 1) * 0.9;
		segs.push({ x: i, slope });
	}
	return segs;
}

export default function Game041_SlowRace() {
	const [seed, setSeed] = useState(1);
	const [track, setTrack] = useState<Segment[]>(() => makeTrack(1));
	const [pos, setPos] = useState(0); // along track
	const [vel, setVel] = useState(0.4);
	const [holding, setHolding] = useState(false);
	const [time, setTime] = useState(0);
	const [done, setDone] = useState(false);
	const [crashed, setCrashed] = useState(false);
	const [best, setBest] = useState<number | null>(() => {
		const v = localStorage.getItem("slowrace_best");
		return v ? parseFloat(v) : null;
	});
	const lastT = useRef(0);
	const holdingRef = useRef(false);
	const posRef = useRef(0);
	const velRef = useRef(0.4);

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
				const slope = track[idx].slope;
				// downhill accelerates strongly; uphill decelerates
				let accel = -slope * 0.6;
				// brake when holding
				if (holdingRef.current) accel -= 0.45;
				// idle creep — engine won't let you stop
				accel += 0.05;
				let v = velRef.current + accel * dt;
				if (v < 0.08) v = 0.08; // cannot fully stop
				if (v > 1.6) {
					setCrashed(true);
					return;
				}
				velRef.current = v;
				posRef.current += v * dt * 2;
				setVel(v);
				setPos(posRef.current);
				setTime((tt) => tt + dt);
				if (posRef.current >= track.length - 1) {
					setDone(true);
					setBest((b) => {
						const newTime = time + dt;
						if (b == null || newTime > b) {
							localStorage.setItem("slowrace_best", String(newTime));
							return newTime;
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
	}, [track, done, crashed, time]);

	const reset = (newSeed?: number) => {
		const ns = newSeed ?? seed + 1;
		setSeed(ns);
		setTrack(makeTrack(ns));
		setPos(0);
		setVel(0.4);
		posRef.current = 0;
		velRef.current = 0.4;
		lastT.current = 0;
		setTime(0);
		setDone(false);
		setCrashed(false);
	};

	const W = 880;
	const H = 520;

	// Render track as horizontal scrolling profile
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
			onMouseDown={() => setHolding(true)}
			onMouseUp={() => setHolding(false)}
			onMouseLeave={() => setHolding(false)}
		>
			<div style={{ marginBottom: 8, textAlign: "center" }}>
				<h2 style={{ margin: 0 }}>Slow Race</h2>
				<div style={{ fontSize: 13, opacity: 0.7 }}>
					Hold mouse to brake. Don't stop, don't crash, finish as slowly as possible.
				</div>
			</div>
			<svg width={W} height={H} style={{ background: "#0e1018", borderRadius: 8 }}>
				{/* track */}
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
				{/* finish */}
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
				{/* car */}
				<circle cx={carX} cy={carY - 10} r={10} fill={crashed ? "#f33" : "#fc6"} />
				{/* speedometer */}
				<rect x={20} y={20} width={200} height={14} fill="#222" />
				<rect
					x={20}
					y={20}
					width={200 * (vel / 1.6)}
					height={14}
					fill={vel > 1.2 ? "#f33" : vel > 0.8 ? "#fb0" : "#3c5"}
				/>
				<text x={20} y={50} fill="#aaa" fontSize={12}>
					speed (red = crash) — time: {time.toFixed(2)}s
				</text>
			</svg>
			<div style={{ marginTop: 12, display: "flex", gap: 12 }}>
				{(done || crashed) && (
					<button type="button" onClick={() => reset()} style={btn}>
						{crashed ? "Crashed — retry" : `Finished in ${time.toFixed(2)}s — next track`}
					</button>
				)}
				<div style={{ alignSelf: "center", opacity: 0.7 }}>
					Best (slowest finish): {best != null ? `${best.toFixed(2)}s` : "—"}
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
