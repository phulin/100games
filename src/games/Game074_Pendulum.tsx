import { useEffect, useRef, useState } from "react";

// Game 74 — Pendulum
// Click at the right phase to add energy. Build amplitude to ring bells.

type Bell = { angle: number; rung: boolean; pitch: number };

const PIVOT = { x: 450, y: 80 };
const LEN = 320;

function makeBells(): Bell[] {
	// bells arc at various angles
	const angles = [-1.1, -0.85, -0.55, -0.3, 0.3, 0.55, 0.85, 1.1];
	return angles.map((a) => ({ angle: a, rung: false, pitch: 220 * Math.pow(1.5, Math.abs(a)) }));
}

export default function Game074_Pendulum() {
	const [theta, setTheta] = useState(0.05);
	const [, setOmega] = useState(0);
	const [bells, setBells] = useState<Bell[]>(makeBells);
	const [score, setScore] = useState(0);
	const [target] = useState(8);
	const [time, setTime] = useState(0);
	const [over, setOver] = useState(false);
	const audioRef = useRef<AudioContext | null>(null);
	const raf = useRef<number | null>(null);
	const last = useRef<number | null>(null);

	useEffect(() => {
		const step = (ts: number) => {
			if (last.current == null) last.current = ts;
			const dt = Math.min(0.05, (ts - last.current) / 1000);
			last.current = ts;
			setTime((t) => t + dt);

			setOmega((w) => {
				setTheta((th) => {
					const newW = w - (9.8 / LEN) * Math.sin(th) * 60 * dt - 0.2 * w * dt;
					const newT = th + newW * dt;
					// check bell rings
					setBells((bs) => {
						let changed = false;
						const next = bs.map((b) => {
							if (b.rung) return b;
							// ring if we cross or pass this angle
							if (Math.abs(newT - b.angle) < 0.04 && Math.abs(newW) > 0.5) {
								changed = true;
								playTone(audioRef, b.pitch);
								setScore((s) => s + 1);
								return { ...b, rung: true };
							}
							return b;
						});
						return changed ? next : bs;
					});
					return newT;
				});
				return w - (9.8 / LEN) * Math.sin(theta) * 60 * dt - 0.2 * w * dt;
			});

			raf.current = requestAnimationFrame(step);
		};
		raf.current = requestAnimationFrame(step);
		return () => {
			if (raf.current) cancelAnimationFrame(raf.current);
			last.current = null;
		};
	}, [theta]);

	useEffect(() => {
		if (score >= target && !over) setOver(true);
	}, [score, target, over]);

	const pushLeft = () => {
		// add energy if swinging left (theta decreasing, omega < 0) — gives boost in current direction
		setOmega((w) => w - 0.5);
	};
	const pushRight = () => {
		setOmega((w) => w + 0.5);
	};

	const bobX = PIVOT.x + Math.sin(theta) * LEN;
	const bobY = PIVOT.y + Math.cos(theta) * LEN;

	const reset = () => {
		setTheta(0.05);
		setOmega(0);
		setBells(makeBells());
		setScore(0);
		setTime(0);
		setOver(false);
	};

	return (
		<div
			style={{
				width: 900,
				height: 600,
				background: "linear-gradient(180deg,#1f1726,#3a2740)",
				color: "#fde",
				fontFamily: "system-ui, sans-serif",
				position: "relative",
				userSelect: "none",
			}}
		>
			<div style={{ position: "absolute", top: 8, left: 12 }}>
				<b>Pendulum</b> — A/D or ← → at the right phase to pump amplitude. Ring all bells.
			</div>
			<div style={{ position: "absolute", top: 8, right: 12 }}>
				Bells: {score}/{target} · Time: {time.toFixed(1)}s
			</div>

			<svg
				width={900}
				height={600}
				onMouseDown={(e) => {
					if (e.clientX < window.innerWidth / 2) pushLeft();
					else pushRight();
				}}
				style={{ cursor: "pointer" }}
			>
				{/* arc visualization */}
				<path
					d={describeArc(PIVOT.x, PIVOT.y, LEN, -1.3, 1.3)}
					stroke="#4448"
					fill="none"
					strokeDasharray="3 4"
				/>
				{bells.map((b, i) => {
					const x = PIVOT.x + Math.sin(b.angle) * LEN;
					const y = PIVOT.y + Math.cos(b.angle) * LEN;
					return (
						<g key={i}>
							<circle cx={x} cy={y} r={14} fill={b.rung ? "#fc5" : "#665"} stroke="#aa8" />
							<text x={x} y={y + 4} textAnchor="middle" fontSize={10} fill="#222">
								♪
							</text>
						</g>
					);
				})}
				<line x1={PIVOT.x} y1={PIVOT.y} x2={bobX} y2={bobY} stroke="#ccc" strokeWidth={2} />
				<circle cx={PIVOT.x} cy={PIVOT.y} r={6} fill="#888" />
				<circle cx={bobX} cy={bobY} r={16} fill="#f4b860" stroke="#a06520" strokeWidth={2} />
			</svg>

			<div style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center" }}>
				<button onClick={pushLeft} style={btn}>
					← Push
				</button>
				<button onClick={pushRight} style={btn}>
					Push →
				</button>
			</div>

			{over && (
				<div
					style={{
						position: "absolute",
						top: "40%",
						left: 0,
						right: 0,
						textAlign: "center",
						fontSize: 32,
					}}
				>
					All bells rung in {time.toFixed(1)}s!
					<div>
						<button onClick={reset} style={btn}>
							Again
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

const btn: React.CSSProperties = {
	margin: 4,
	padding: "6px 14px",
	fontSize: 14,
	cursor: "pointer",
};

function describeArc(cx: number, cy: number, r: number, a1: number, a2: number) {
	const x1 = cx + Math.sin(a1) * r;
	const y1 = cy + Math.cos(a1) * r;
	const x2 = cx + Math.sin(a2) * r;
	const y2 = cy + Math.cos(a2) * r;
	const large = a2 - a1 > Math.PI ? 1 : 0;
	return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2}`;
}

function playTone(ref: React.MutableRefObject<AudioContext | null>, freq: number) {
	try {
		if (!ref.current) ref.current = new AudioContext();
		const ctx = ref.current;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.frequency.value = freq;
		o.type = "sine";
		g.gain.value = 0.001;
		g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + 0.85);
	} catch {}
}
