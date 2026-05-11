import { useEffect, useMemo, useRef, useState } from "react";

type Chambers = {
	top: number;
	midL: number;
	midR: number;
	b0: number;
	b1: number;
	b2: number;
};

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function hashStr(s: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
function todayKey(): string {
	const d = new Date();
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

type Config = {
	target: { b0: number; b1: number; b2: number };
	flowRate: number;
	leakL: number;
	leakR: number;
	startSand: number;
};

function generateConfig(seed: number): Config {
	const rng = mulberry32(seed);
	let a = 10 + Math.floor(rng() * 51);
	let b = 10 + Math.floor(rng() * 51);
	let c = 100 - a - b;
	if (c < 10) {
		const deficit = 10 - c;
		if (a > b) a -= deficit;
		else b -= deficit;
		c = 10;
	} else if (c > 80) {
		c = 80;
		const rest = 100 - c;
		a = 10 + Math.floor(rng() * (rest - 20));
		b = rest - a;
	}
	return {
		target: { b0: a, b1: b, b2: c },
		flowRate: 10 + Math.floor(rng() * 8),
		leakL: rng() * 0.2,
		leakR: rng() * 0.2,
		startSand: 100,
	};
}

let _ac: AudioContext | null = null;
function ac(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!_ac) {
		try {
			_ac = new (window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext)();
		} catch {
			return null;
		}
	}
	return _ac;
}

type StreamRef = {
	src: AudioBufferSourceNode | null;
	gain: GainNode | null;
};
function startStream(ref: StreamRef) {
	const c = ac();
	if (!c) return;
	if (ref.src) return;
	const dur = 1.0;
	const n = Math.floor(c.sampleRate * dur);
	const b = c.createBuffer(1, n, c.sampleRate);
	const d = b.getChannelData(0);
	for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
	const src = c.createBufferSource();
	src.buffer = b;
	src.loop = true;
	const f = c.createBiquadFilter();
	f.type = "bandpass";
	f.frequency.value = 1200;
	f.Q.value = 0.7;
	const g = c.createGain();
	g.gain.value = 0;
	src.connect(f).connect(g).connect(c.destination);
	src.start();
	ref.src = src;
	ref.gain = g;
}
function setStreamGain(ref: StreamRef, v: number) {
	const c = ac();
	if (!c || !ref.gain) return;
	ref.gain.gain.setTargetAtTime(v, c.currentTime, 0.05);
}
function stopStream(ref: StreamRef) {
	try {
		if (ref.src) ref.src.stop();
	} catch {}
	ref.src = null;
	ref.gain = null;
}
function chime(freq: number) {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const o = c.createOscillator();
	const g = c.createGain();
	o.type = "sine";
	o.frequency.value = freq;
	g.gain.setValueAtTime(0.001, t);
	g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
	o.connect(g).connect(c.destination);
	o.start(t);
	o.stop(t + 0.65);
}

export default function Game095_Hourglass() {
	const [seedInput, setSeedInput] = useState<string>(() => todayKey());
	const seed = useMemo(() => hashStr(seedInput), [seedInput]);
	const cfg = useMemo(() => generateConfig(seed), [seed]);

	const INIT: Chambers = useMemo(
		() => ({
			top: cfg.startSand,
			midL: 0,
			midR: 0,
			b0: 0,
			b1: 0,
			b2: 0,
		}),
		[cfg],
	);

	const [c, setC] = useState<Chambers>(INIT);
	const [tilt, setTilt] = useState(0);
	const tiltVelRef = useRef(0);
	const [running, setRunning] = useState(false);
	const [done, setDone] = useState(false);
	const tiltRef = useRef(0);
	tiltRef.current = tilt;
	const lastRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);
	const keysRef = useRef<{ left: boolean; right: boolean }>({
		left: false,
		right: false,
	});
	const streamRef = useRef<StreamRef>({ src: null, gain: null });

	useEffect(() => {
		setC(INIT);
		setTilt(0);
		tiltVelRef.current = 0;
		setRunning(false);
		setDone(false);
		lastRef.current = null;
	}, [INIT]);

	useEffect(() => {
		function down(e: KeyboardEvent) {
			if (e.key === "ArrowLeft") {
				keysRef.current.left = true;
				e.preventDefault();
			}
			if (e.key === "ArrowRight") {
				keysRef.current.right = true;
				e.preventDefault();
			}
			if (e.key === " ") {
				e.preventDefault();
				setRunning((r) => !r);
			}
		}
		function up(e: KeyboardEvent) {
			if (e.key === "ArrowLeft") keysRef.current.left = false;
			if (e.key === "ArrowRight") keysRef.current.right = false;
		}
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
		};
	}, []);

	useEffect(() => {
		if (!running) {
			setStreamGain(streamRef.current, 0);
			return;
		}
		startStream(streamRef.current);
		let alive = true;
		function tick(now: number) {
			if (!alive) return;
			if (lastRef.current == null) lastRef.current = now;
			const dt = Math.min(0.05, (now - lastRef.current) / 1000);
			lastRef.current = now;

			let accel = 0;
			if (keysRef.current.left) accel -= 2.4;
			if (keysRef.current.right) accel += 2.4;
			tiltVelRef.current = (tiltVelRef.current + accel * dt) * 0.92;
			const newTilt = Math.max(
				-1,
				Math.min(1, tiltRef.current + tiltVelRef.current * dt),
			);
			tiltRef.current = newTilt;
			setTilt(newTilt);

			setC((s) => {
				const tlt = tiltRef.current;
				const topRate = cfg.flowRate * dt;
				const fromTop = Math.min(s.top, topRate);
				const leftFrac = 0.5 - tlt * 0.5;
				const toL = fromTop * leftFrac;
				const toR = fromTop * (1 - leftFrac);

				const midLRate = Math.min(s.midL + toL, cfg.flowRate * dt);
				const midRRate = Math.min(s.midR + toR, cfg.flowRate * dt);
				let midLToB0 = midLRate * (0.5 - tlt * 0.5);
				let midLToB1 = midLRate - midLToB0;
				let midRToB2 = midRRate * (0.5 + tlt * 0.5);
				let midRToB1 = midRRate - midRToB2;
				const leakA = midLToB0 * cfg.leakL;
				midLToB0 -= leakA;
				midLToB1 += leakA;
				const leakB = midRToB2 * cfg.leakR;
				midRToB2 -= leakB;
				midRToB1 += leakB;

				const ns: Chambers = {
					top: s.top - fromTop,
					midL: s.midL + toL - midLRate,
					midR: s.midR + toR - midRRate,
					b0: s.b0 + midLToB0,
					b1: s.b1 + midLToB1 + midRToB1,
					b2: s.b2 + midRToB2,
				};
				if (
					ns.top <= 0.01 &&
					ns.midL <= 0.01 &&
					ns.midR <= 0.01 &&
					(s.top > 0.01 || s.midL > 0.01 || s.midR > 0.01)
				) {
					ns.top = 0;
					ns.midL = 0;
					ns.midR = 0;
					setRunning(false);
					setDone(true);
					chime(880);
				}
				const outflow = fromTop + midLRate + midRRate;
				setStreamGain(streamRef.current, Math.min(0.18, outflow * 0.6));
				return ns;
			});
			rafRef.current = requestAnimationFrame(tick);
		}
		rafRef.current = requestAnimationFrame(tick);
		return () => {
			alive = false;
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			lastRef.current = null;
			rafRef.current = null;
		};
	}, [running, cfg]);

	useEffect(() => () => stopStream(streamRef.current), []);

	function reset() {
		setC(INIT);
		setTilt(0);
		tiltVelRef.current = 0;
		setRunning(false);
		setDone(false);
		lastRef.current = null;
	}

	function score(): number {
		const total = c.b0 + c.b1 + c.b2 || 1;
		const p0 = (c.b0 / total) * 100;
		const p1 = (c.b1 / total) * 100;
		const p2 = (c.b2 / total) * 100;
		const err =
			Math.abs(p0 - cfg.target.b0) +
			Math.abs(p1 - cfg.target.b1) +
			Math.abs(p2 - cfg.target.b2);
		return Math.max(0, Math.round(100 - err));
	}

	const bestKey = `hg_best_${seedInput}`;
	const [best, setBest] = useState<number | null>(null);
	useEffect(() => {
		try {
			const v = localStorage.getItem(bestKey);
			setBest(v ? parseInt(v, 10) : null);
		} catch {}
	}, [bestKey]);
	useEffect(() => {
		if (!done) return;
		const s = score();
		try {
			const prev = localStorage.getItem(bestKey);
			if (!prev || s > parseInt(prev, 10)) {
				localStorage.setItem(bestKey, String(s));
				setBest(s);
			}
		} catch {}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [done]);

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "system-ui",
				background: "#1f1a14",
				color: "#f0e3c2",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px" }}>Hourglass</h2>
			<p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.7 }}>
				← → (or slider) tilt with inertia, Space to start/pause. Hit target
				proportions: {cfg.target.b0}% / {cfg.target.b1}% / {cfg.target.b2}%.
			</p>
			<div
				style={{
					display: "flex",
					gap: 10,
					alignItems: "center",
					marginBottom: 10,
					fontSize: 12,
				}}
			>
				<label>
					Seed:{" "}
					<input
						value={seedInput}
						onChange={(e) => setSeedInput(e.target.value)}
						style={{ width: 120 }}
					/>
				</label>
				<button onClick={() => setSeedInput(todayKey())}>Daily</button>
				<button
					onClick={() => setSeedInput(`r${Math.floor(Math.random() * 1e9)}`)}
				>
					New mix
				</button>
				{best != null && <span>Best {best}/100</span>}
			</div>

			<div style={{ display: "flex", gap: 24 }}>
				<svg
					viewBox="0 0 360 420"
					width={360}
					height={420}
					style={{ background: "#0e0a06", borderRadius: 8 }}
				>
					<Chamber
						x={120}
						y={20}
						w={120}
						h={90}
						fill={c.top / cfg.startSand}
						label={`${Math.round(c.top)}`}
					/>
					<line x1={180} y1={110} x2={100} y2={150} stroke="#806040" />
					<line x1={180} y1={110} x2={260} y2={150} stroke="#806040" />
					<Chamber
						x={40}
						y={150}
						w={100}
						h={70}
						fill={c.midL / 50}
						label={`${Math.round(c.midL)}`}
					/>
					<Chamber
						x={220}
						y={150}
						w={100}
						h={70}
						fill={c.midR / 50}
						label={`${Math.round(c.midR)}`}
					/>
					<line x1={90} y1={220} x2={50} y2={260} stroke="#806040" />
					<line x1={90} y1={220} x2={180} y2={260} stroke="#806040" />
					<line x1={270} y1={220} x2={180} y2={260} stroke="#806040" />
					<line x1={270} y1={220} x2={310} y2={260} stroke="#806040" />
					<Chamber
						x={10}
						y={260}
						w={80}
						h={140}
						fill={c.b0 / cfg.startSand}
						label={`${Math.round(c.b0)}`}
						target={cfg.target.b0}
					/>
					<Chamber
						x={140}
						y={260}
						w={80}
						h={140}
						fill={c.b1 / cfg.startSand}
						label={`${Math.round(c.b1)}`}
						target={cfg.target.b1}
					/>
					<Chamber
						x={270}
						y={260}
						w={80}
						h={140}
						fill={c.b2 / cfg.startSand}
						label={`${Math.round(c.b2)}`}
						target={cfg.target.b2}
					/>
					<g transform={`translate(180,410) rotate(${tilt * 20})`}>
						<line
							x1={-40}
							y1={0}
							x2={40}
							y2={0}
							stroke="#e9c46a"
							strokeWidth={3}
						/>
					</g>
				</svg>

				<div style={{ flex: 1 }}>
					<div style={{ marginBottom: 12 }}>
						<label style={{ fontSize: 12, opacity: 0.7 }}>
							Tilt ({tilt.toFixed(2)})
						</label>
						<br />
						<input
							type="range"
							min={-1}
							max={1}
							step={0.01}
							value={tilt}
							onChange={(e) => {
								const v = parseFloat(e.target.value);
								tiltRef.current = v;
								setTilt(v);
								tiltVelRef.current = 0;
							}}
							style={{ width: 240 }}
						/>
					</div>
					<button onClick={() => setRunning((r) => !r)} disabled={done}>
						{running ? "Pause" : "Start"}
					</button>
					<button onClick={reset} style={{ marginLeft: 8 }}>
						Reset
					</button>
					{done && (
						<div style={{ marginTop: 14, fontSize: 16 }}>
							<strong>Final score: {score()}/100</strong>
						</div>
					)}
					<div style={{ marginTop: 16, fontSize: 12, opacity: 0.7 }}>
						Tip: keyboard tilt has inertia. Slider snaps directly. Flow rate{" "}
						{cfg.flowRate}, leak L/R {cfg.leakL.toFixed(2)}/
						{cfg.leakR.toFixed(2)}.
					</div>
				</div>
			</div>
		</div>
	);
}

function Chamber({
	x,
	y,
	w,
	h,
	fill,
	label,
	target,
}: {
	x: number;
	y: number;
	w: number;
	h: number;
	fill: number;
	label: string;
	target?: number;
}) {
	const f = Math.max(0, Math.min(1, fill));
	return (
		<g>
			<rect
				x={x}
				y={y}
				width={w}
				height={h}
				fill="none"
				stroke="#a07a40"
				strokeWidth={2}
				rx={4}
			/>
			<rect
				x={x + 1}
				y={y + h * (1 - f) + 1}
				width={w - 2}
				height={h * f - 2}
				fill="#e9c46a"
				rx={3}
			/>
			<text
				x={x + w / 2}
				y={y + h / 2}
				fill="#fff"
				fontSize={12}
				textAnchor="middle"
				dominantBaseline="middle"
			>
				{label}
			</text>
			{target != null && (
				<text
					x={x + w / 2}
					y={y + h + 14}
					fill="#e63946"
					fontSize={11}
					textAnchor="middle"
				>
					target {target}%
				</text>
			)}
		</g>
	);
}
