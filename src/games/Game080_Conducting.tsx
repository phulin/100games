import { useEffect, useRef, useState } from "react";

// Game 80 — Conducting
// Mouse height controls section volume; horizontal position selects section.
// Match a target dynamic curve over time.

const SECTIONS = [
	{ name: "Strings", color: "#d96", base: 220, type: "sawtooth" as OscillatorType },
	{ name: "Winds", color: "#9d6", base: 330, type: "triangle" as OscillatorType },
	{ name: "Brass", color: "#69d", base: 165, type: "square" as OscillatorType },
	{ name: "Percussion", color: "#d69", base: 110, type: "sine" as OscillatorType },
];

const DURATION = 30; // seconds
const SAMPLES_PER_SEC = 5;

// target dynamic curves per section: array of volumes 0..1 sampled
function makeTarget(): number[][] {
	return SECTIONS.map((_, s) => {
		const arr: number[] = [];
		const phase = s * 1.3;
		const freq = 0.1 + s * 0.05;
		for (let i = 0; i < DURATION * SAMPLES_PER_SEC; i++) {
			const t = i / SAMPLES_PER_SEC;
			let v = 0.4 + 0.4 * Math.sin(t * freq * Math.PI * 2 + phase);
			// some sections silent at points
			if (s === 2 && t < 8) v *= 0.05;
			if (s === 3 && (t < 5 || (t > 15 && t < 20))) v *= 0.05;
			arr.push(Math.max(0, Math.min(1, v)));
		}
		return arr;
	});
}

export default function Game080_Conducting() {
	const [time, setTime] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [target] = useState(() => makeTarget());
	const [played, setPlayed] = useState<number[][]>(() =>
		SECTIONS.map(() => Array(DURATION * SAMPLES_PER_SEC).fill(0))
	);
	const [score, setScore] = useState<number | null>(null);

	const mouseRef = useRef({ x: 0.5, y: 0.5 });
	const containerRef = useRef<HTMLDivElement>(null);
	const last = useRef<number | null>(null);
	const accSampler = useRef(0);

	const audioCtx = useRef<AudioContext | null>(null);
	const oscs = useRef<{ o: OscillatorNode; g: GainNode }[]>([]);

	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (!containerRef.current) return;
			const r = containerRef.current.getBoundingClientRect();
			mouseRef.current.x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
			mouseRef.current.y = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
		};
		window.addEventListener("mousemove", onMove);
		return () => window.removeEventListener("mousemove", onMove);
	}, []);

	const start = () => {
		if (playing) return;
		try {
			audioCtx.current = new AudioContext();
			oscs.current = SECTIONS.map((s) => {
				const o = audioCtx.current!.createOscillator();
				const g = audioCtx.current!.createGain();
				o.type = s.type;
				o.frequency.value = s.base;
				g.gain.value = 0;
				o.connect(g).connect(audioCtx.current!.destination);
				o.start();
				return { o, g };
			});
		} catch {}
		setTime(0);
		setPlayed(SECTIONS.map(() => Array(DURATION * SAMPLES_PER_SEC).fill(0)));
		setScore(null);
		setPlaying(true);
	};

	useEffect(() => {
		if (!playing) return;
		let raf = 0;
		const step = (ts: number) => {
			if (last.current == null) last.current = ts;
			const dt = (ts - last.current) / 1000;
			last.current = ts;

			setTime((t) => {
				const nt = t + dt;
				accSampler.current += dt;
				if (accSampler.current >= 1 / SAMPLES_PER_SEC) {
					accSampler.current = 0;
					// section based on mouse x
					const seg = Math.floor(mouseRef.current.x * SECTIONS.length);
					const vol = mouseRef.current.y;
					const idx = Math.min(DURATION * SAMPLES_PER_SEC - 1, Math.floor(nt * SAMPLES_PER_SEC));
					setPlayed((p) =>
						p.map((arr, si) => {
							if (si === seg) {
								const cp = [...arr];
								cp[idx] = vol;
								return cp;
							}
							return arr;
						})
					);
					// update audio gains
					oscs.current.forEach((osc, si) => {
						try {
							osc.g.gain.linearRampToValueAtTime(
								si === seg ? vol * 0.18 : (osc.g.gain.value * 0.7) || 0,
								audioCtx.current!.currentTime + 0.05
							);
						} catch {}
					});
				}
				if (nt >= DURATION) {
					setPlaying(false);
					// score
					let err = 0;
					for (let s = 0; s < SECTIONS.length; s++) {
						for (let i = 0; i < target[s].length; i++) {
							err += Math.abs(target[s][i] - played[s][i]);
						}
					}
					const total = SECTIONS.length * DURATION * SAMPLES_PER_SEC;
					setScore(Math.max(0, Math.round(100 - (err / total) * 100)));
					// fade out
					oscs.current.forEach((osc) => {
						try {
							osc.g.gain.linearRampToValueAtTime(0, audioCtx.current!.currentTime + 0.1);
						} catch {}
					});
					return DURATION;
				}
				return nt;
			});

			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => {
			cancelAnimationFrame(raf);
			last.current = null;
		};
	}, [playing, target, played]);

	const curIdx = Math.min(DURATION * SAMPLES_PER_SEC - 1, Math.floor(time * SAMPLES_PER_SEC));

	return (
		<div
			ref={containerRef}
			style={{
				width: 900,
				height: 600,
				background: "linear-gradient(180deg,#0c0a1a,#221830)",
				color: "#f0e8d0",
				fontFamily: "Georgia, serif",
				padding: 14,
				boxSizing: "border-box",
				position: "relative",
				cursor: "crosshair",
				userSelect: "none",
			}}
		>
			<div>
				<b>Conducting</b> — Move mouse: x = section, height = volume. Match the target curves.
			</div>

			{/* Section columns */}
			<div style={{ display: "flex", height: 240, marginTop: 12, gap: 4 }}>
				{SECTIONS.map((s, si) => {
					const targetV = target[si][curIdx];
					const playedV = played[si][curIdx];
					return (
						<div
							key={si}
							style={{
								flex: 1,
								background: "#0008",
								position: "relative",
								borderTop: `3px solid ${s.color}`,
							}}
						>
							<div style={{ textAlign: "center", color: s.color, padding: 4 }}>{s.name}</div>
							<div
								style={{
									position: "absolute",
									left: 0,
									right: 0,
									bottom: 0,
									height: `${targetV * 80}%`,
									background: `${s.color}33`,
									borderTop: `2px dashed ${s.color}`,
								}}
							/>
							<div
								style={{
									position: "absolute",
									left: 0,
									right: 0,
									bottom: 0,
									height: `${playedV * 80}%`,
									background: `${s.color}aa`,
								}}
							/>
						</div>
					);
				})}
			</div>

			{/* Timeline visualization */}
			<div style={{ marginTop: 10 }}>
				<div style={{ fontSize: 12, opacity: 0.7 }}>
					Time: {time.toFixed(1)}s / {DURATION}s
				</div>
				<svg width={870} height={140}>
					{SECTIONS.map((s, si) => (
						<g key={si}>
							{target[si].map((v, i) => (
								<rect
									key={i}
									x={(i / target[si].length) * 870}
									y={20 + si * 28 + (1 - v) * 20}
									width={870 / target[si].length}
									height={2}
									fill={s.color}
									opacity={0.5}
								/>
							))}
							{played[si].slice(0, curIdx).map((v, i) => (
								<rect
									key={i}
									x={(i / target[si].length) * 870}
									y={20 + si * 28 + (1 - v) * 20}
									width={870 / target[si].length}
									height={2}
									fill={s.color}
								/>
							))}
						</g>
					))}
					<line
						x1={(time / DURATION) * 870}
						x2={(time / DURATION) * 870}
						y1={0}
						y2={140}
						stroke="#fff"
					/>
				</svg>
			</div>

			<div style={{ marginTop: 8 }}>
				<button onClick={start} disabled={playing} style={{ padding: "8px 18px", fontSize: 14 }}>
					{playing ? "Conducting…" : "Begin"}
				</button>
				{score !== null && (
					<span style={{ marginLeft: 14, fontSize: 20 }}>
						Score: <b>{score}/100</b>
					</span>
				)}
			</div>
		</div>
	);
}
