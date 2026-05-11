import { useEffect, useMemo, useRef, useState } from "react";

type Dipole = { x: number; y: number; angle: number; strength: number };
const W = 720,
	H = 460;

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function makeTarget(seed: number, count: number): Dipole[] {
	const rng = mulberry32(seed);
	const out: Dipole[] = [];
	for (let i = 0; i < count; i++) {
		out.push({
			x: 100 + rng() * (W - 200),
			y: 80 + rng() * (H - 160),
			angle: rng() * Math.PI * 2,
			strength: 0.7 + rng() * 0.6,
		});
	}
	return out;
}

function makeInitial(seed: number, count: number): Dipole[] {
	const rng = mulberry32(seed ^ 0xa5a5);
	const out: Dipole[] = [];
	for (let i = 0; i < count; i++) {
		out.push({
			x: 120 + rng() * (W - 240),
			y: 100 + rng() * (H - 200),
			angle: 0,
			strength: 1,
		});
	}
	return out;
}

function fieldAt(x: number, y: number, dipoles: Dipole[]): [number, number] {
	let fx = 0,
		fy = 0;
	for (const d of dipoles) {
		const dx = x - d.x,
			dy = y - d.y;
		const r2 = dx * dx + dy * dy + 100;
		const r = Math.sqrt(r2);
		const ux = Math.cos(d.angle),
			uy = Math.sin(d.angle);
		const dot = (dx * ux + dy * uy) / r;
		const bx = ((3 * dot * dx) / r - ux) / r2;
		const by = ((3 * dot * dy) / r - uy) / r2;
		fx += bx * d.strength * 50000;
		fy += by * d.strength * 50000;
	}
	return [fx, fy];
}

function sampleErrors(a: Dipole[], b: Dipole[]) {
	const errs: { x: number; y: number; d: number }[] = [];
	let total = 0,
		n = 0;
	for (let x = 40; x < W; x += 40) {
		for (let y = 40; y < H; y += 40) {
			const [ax, ay] = fieldAt(x, y, a);
			const [bx, by] = fieldAt(x, y, b);
			const angA = Math.atan2(ay, ax);
			const angB = Math.atan2(by, bx);
			let d = Math.abs(angA - angB);
			if (d > Math.PI) d = 2 * Math.PI - d;
			errs.push({ x, y, d });
			total += d;
			n++;
		}
	}
	return { avg: total / n, samples: errs };
}

function playTone(
	ref: React.MutableRefObject<AudioContext | null>,
	freq: number,
	dur = 0.12,
	type: OscillatorType = "sine",
) {
	try {
		if (!ref.current) ref.current = new AudioContext();
		const ctx = ref.current;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.value = freq;
		g.gain.value = 0.0001;
		g.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + dur + 0.02);
	} catch {
		/* ignore */
	}
}

export default function Game099_MagneticField() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [count, setCount] = useState(2);
	const [showHeat, setShowHeat] = useState(true);

	const target = useMemo(() => makeTarget(seed, count), [seed, count]);
	const [dipoles, setDipoles] = useState<Dipole[]>(() =>
		makeInitial(seed, count),
	);
	const [bestScore, setBestScore] = useState(0);
	const lastChimeRef = useRef(0);
	const audio = useRef<AudioContext | null>(null);

	useEffect(() => {
		setDipoles(makeInitial(seed, count));
		setBestScore(0);
	}, [seed, count]);

	const [dragIdx, setDragIdx] = useState<number | null>(null);
	const [rotIdx, setRotIdx] = useState<number | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const targetCanvasRef = useRef<HTMLCanvasElement | null>(null);

	const { avg, samples } = useMemo(
		() => sampleErrors(dipoles, target),
		[dipoles, target],
	);
	const score = Math.max(0, Math.round((1 - avg / Math.PI) * 100));

	useEffect(() => {
		if (score > bestScore) setBestScore(score);
	}, [score, bestScore]);

	useEffect(() => {
		const now = Date.now();
		if (now - lastChimeRef.current < 250) return;
		if (score >= 95) {
			lastChimeRef.current = now;
			playTone(audio, 880, 0.15, "sine");
		} else if (score >= 80 && bestScore < 80) {
			lastChimeRef.current = now;
			playTone(audio, 660, 0.12, "triangle");
		}
	}, [score, bestScore]);

	useEffect(() => {
		const c1 = canvasRef.current;
		const c2 = targetCanvasRef.current;
		if (c1) drawField(c1, dipoles, "#7ab7ff", showHeat ? samples : null);
		if (c2) drawField(c2, target, "#bbb", null);
	}, [dipoles, target, showHeat, samples]);

	function onMouseDown(e: React.MouseEvent) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const x = e.clientX - rect.left,
			y = e.clientY - rect.top;
		for (let i = 0; i < dipoles.length; i++) {
			const d = dipoles[i];
			const dist = Math.hypot(d.x - x, d.y - y);
			if (dist < 22) {
				if (e.shiftKey) setRotIdx(i);
				else setDragIdx(i);
				return;
			}
		}
	}
	function onMouseMove(e: React.MouseEvent) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const x = e.clientX - rect.left,
			y = e.clientY - rect.top;
		if (dragIdx != null) {
			setDipoles((ds) =>
				ds.map((d, i) => (i === dragIdx ? { ...d, x, y } : d)),
			);
		} else if (rotIdx != null) {
			setDipoles((ds) =>
				ds.map((d, i) =>
					i === rotIdx ? { ...d, angle: Math.atan2(y - d.y, x - d.x) } : d,
				),
			);
		}
	}
	function onMouseUp() {
		setDragIdx(null);
		setRotIdx(null);
	}
	function onWheel(e: React.WheelEvent) {
		const rect = canvasRef.current?.getBoundingClientRect();
		if (!rect) return;
		const x = e.clientX - rect.left,
			y = e.clientY - rect.top;
		const i = dipoles.findIndex((d) => Math.hypot(d.x - x, d.y - y) < 24);
		if (i < 0) return;
		const delta = e.deltaY > 0 ? -0.1 : 0.1;
		setDipoles((ds) =>
			ds.map((d, j) =>
				j === i
					? { ...d, strength: Math.max(0.2, Math.min(2.5, d.strength + delta)) }
					: d,
			),
		);
	}

	function flipAngle(i: number) {
		setDipoles((ds) =>
			ds.map((d, j) =>
				j === i ? { ...d, angle: (d.angle + Math.PI) % (Math.PI * 2) } : d,
			),
		);
	}

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "system-ui",
				background: "#0a0d1a",
				color: "#dde",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px" }}>Magnetic Field</h2>
			<p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
				Drag dipoles. Shift-drag rotate. Scroll-wheel over one to change strength.
			</p>

			<div
				style={{
					marginBottom: 10,
					display: "flex",
					gap: 12,
					alignItems: "center",
					fontSize: 13,
				}}
			>
				<button onClick={() => setSeed(Math.floor(Math.random() * 1e9))}>
					New target (seed)
				</button>
				<label>
					Dipoles:
					<select
						value={count}
						onChange={(e) => setCount(parseInt(e.target.value))}
						style={{ marginLeft: 4 }}
					>
						{[2, 3, 4, 5].map((n) => (
							<option key={n}>{n}</option>
						))}
					</select>
				</label>
				<label>
					<input
						type="checkbox"
						checked={showHeat}
						onChange={(e) => setShowHeat(e.target.checked)}
					/>{" "}
					Error heatmap
				</label>
				<span style={{ marginLeft: "auto", opacity: 0.7 }}>
					Seed: <code>{seed}</code> • Best: {bestScore}%
				</span>
			</div>

			<div style={{ display: "flex", gap: 16 }}>
				<div>
					<div style={{ fontSize: 12, opacity: 0.7 }}>Target</div>
					<canvas
						ref={targetCanvasRef}
						width={W / 2}
						height={H / 2}
						style={{ background: "#000", borderRadius: 4 }}
					/>
				</div>
				<div>
					<div style={{ fontSize: 12, opacity: 0.7 }}>
						Yours — match: <strong>{score}%</strong>
					</div>
					<canvas
						ref={canvasRef}
						width={W}
						height={H}
						style={{
							background: "#000",
							borderRadius: 4,
							cursor: dragIdx != null ? "grabbing" : "crosshair",
						}}
						onMouseDown={onMouseDown}
						onMouseMove={onMouseMove}
						onMouseUp={onMouseUp}
						onMouseLeave={onMouseUp}
						onWheel={onWheel}
					/>
				</div>
			</div>

			<div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
				{dipoles.map((_, i) => (
					<button
						key={i}
						onClick={() => flipAngle(i)}
						style={{ marginLeft: i === 0 ? 0 : 6 }}
						title="Flip dipole 180°"
					>
						Flip #{i + 1}
					</button>
				))}
			</div>
			<div style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }}>
				Red = field error hotspots. Avg angular error:{" "}
				{(avg * 57.2958).toFixed(1)}°
			</div>
		</div>
	);
}

function drawField(
	canvas: HTMLCanvasElement,
	dipoles: Dipole[],
	color: string,
	errSamples: { x: number; y: number; d: number }[] | null,
) {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const w = canvas.width,
		h = canvas.height;
	ctx.fillStyle = "#000";
	ctx.fillRect(0, 0, w, h);

	const scale = w / W;

	if (errSamples) {
		for (const s of errSamples) {
			const intensity = Math.min(1, s.d / Math.PI);
			if (intensity < 0.05) continue;
			ctx.fillStyle = `rgba(230,57,70,${intensity * 0.5})`;
			ctx.beginPath();
			ctx.arc(s.x * scale, s.y * scale, 18 * scale, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	const ds = dipoles.map((d) => ({ ...d, x: d.x * scale, y: d.y * scale }));

	ctx.strokeStyle = color;
	ctx.globalAlpha = 0.75;
	const step = 22 * scale;
	for (let x = step / 2; x < w; x += step) {
		for (let y = step / 2; y < h; y += step) {
			const ox = x / scale,
				oy = y / scale;
			const [fx, fy] = fieldAt(ox, oy, dipoles);
			const mag = Math.hypot(fx, fy);
			const len = Math.min(step * 0.45, Math.log(1 + mag) * 2);
			const ang = Math.atan2(fy, fx);
			const ex = x + Math.cos(ang) * len,
				ey = y + Math.sin(ang) * len;
			ctx.beginPath();
			ctx.moveTo(x - Math.cos(ang) * len, y - Math.sin(ang) * len);
			ctx.lineTo(ex, ey);
			ctx.stroke();
			ctx.beginPath();
			ctx.arc(ex, ey, 1.5, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();
		}
	}
	ctx.globalAlpha = 1;

	for (const d of ds) {
		const r = 12 * scale * d.strength;
		ctx.save();
		ctx.translate(d.x, d.y);
		ctx.rotate(d.angle);
		ctx.fillStyle = "#e63946";
		ctx.fillRect(-r, -r / 3, r, r / 1.5);
		ctx.fillStyle = "#2a6df4";
		ctx.fillRect(0, -r / 3, r, r / 1.5);
		ctx.strokeStyle = "#fff";
		ctx.strokeRect(-r, -r / 3, 2 * r, r / 1.5);
		ctx.restore();
	}
}
