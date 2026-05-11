import { useEffect, useMemo, useRef, useState } from "react";

// Game 80 — Conducting
// Procedural target curves (seeded). Multiple sections.
// Touch & keyboard control, replay, harmonics polish, best score persisted.

const SECTIONS = [
	{ name: "Strings", color: "#d96", base: 220, type: "sawtooth" as OscillatorType },
	{ name: "Winds", color: "#9d6", base: 330, type: "triangle" as OscillatorType },
	{ name: "Brass", color: "#69d", base: 165, type: "square" as OscillatorType },
	{ name: "Percussion", color: "#d69", base: 110, type: "sine" as OscillatorType },
];

const DURATION = 30;
const SAMPLES_PER_SEC = 5;
const BEST_KEY = "conducting:best";

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

function makeTarget(seed: number): number[][] {
	const rnd = mulberry32(seed);
	return SECTIONS.map((_, s) => {
		const arr: number[] = [];
		const harmonics = 2 + Math.floor(rnd() * 3);
		const params: Array<{ amp: number; freq: number; phase: number }> = [];
		for (let h = 0; h < harmonics; h++) {
			params.push({
				amp: 0.15 + rnd() * 0.35,
				freq: 0.05 + rnd() * 0.25,
				phase: rnd() * Math.PI * 2,
			});
		}
		const silences: Array<[number, number]> = [];
		const nSil = Math.floor(rnd() * 3);
		for (let i = 0; i < nSil; i++) {
			const start = rnd() * DURATION * 0.8;
			const len = 1 + rnd() * 4;
			silences.push([start, start + len]);
		}
		for (let i = 0; i < DURATION * SAMPLES_PER_SEC; i++) {
			const t = i / SAMPLES_PER_SEC;
			let v = 0.4;
			for (const p of params) {
				v += p.amp * Math.sin(t * p.freq * Math.PI * 2 + p.phase);
			}
			v /= 1 + harmonics * 0.4;
			v = Math.max(0, Math.min(1, v));
			for (const [a, b] of silences) {
				if (t >= a && t <= b) v *= 0.05;
			}
			arr.push(v);
		}
		if (s === 2 && rnd() > 0.5) {
			for (let i = 0; i < arr.length; i++) {
				if (i % 7 === 0) arr[i] = Math.min(1, arr[i] + 0.2);
			}
		}
		return arr;
	});
}

export default function Game080_Conducting() {
	const [seed, setSeed] = useState<number>(() => (Math.random() * 1e9) | 0);
	const [time, setTime] = useState(0);
	const [playing, setPlaying] = useState(false);
	const target = useMemo(() => makeTarget(seed), [seed]);
	const [played, setPlayed] = useState<number[][]>(() =>
		SECTIONS.map(() => Array(DURATION * SAMPLES_PER_SEC).fill(0)),
	);
	const [score, setScore] = useState<number | null>(null);
	const [best, setBest] = useState<number>(() => {
		try {
			return parseInt(localStorage.getItem(BEST_KEY) || "0") || 0;
		} catch {
			return 0;
		}
	});
	const [replay, setReplay] = useState<number[][] | null>(null);

	const mouseRef = useRef({ x: 0.5, y: 0.5 });
	const containerRef = useRef<HTMLDivElement>(null);
	const last = useRef<number | null>(null);
	const accSampler = useRef(0);
	const keyRef = useRef<{ section: number; vol: number }>({ section: -1, vol: 0 });

	const audioCtx = useRef<AudioContext | null>(null);
	const oscs = useRef<
		Array<{ o: OscillatorNode; g: GainNode; o2?: OscillatorNode; g2?: GainNode }>
	>([]);

	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (!containerRef.current) return;
			const r = containerRef.current.getBoundingClientRect();
			mouseRef.current.x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
			mouseRef.current.y = Math.max(0, Math.min(1, 1 - (e.clientY - r.top) / r.height));
		};
		const onTouch = (e: TouchEvent) => {
			if (!containerRef.current || !e.touches[0]) return;
			const r = containerRef.current.getBoundingClientRect();
			const t = e.touches[0];
			mouseRef.current.x = Math.max(0, Math.min(1, (t.clientX - r.left) / r.width));
			mouseRef.current.y = Math.max(0, Math.min(1, 1 - (t.clientY - r.top) / r.height));
		};
		const onKey = (e: KeyboardEvent) => {
			const map: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3 };
			if (map[e.key] !== undefined) keyRef.current.section = map[e.key];
			if (e.key === "ArrowUp") keyRef.current.vol = Math.min(1, keyRef.current.vol + 0.1);
			if (e.key === "ArrowDown") keyRef.current.vol = Math.max(0, keyRef.current.vol - 0.1);
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("touchmove", onTouch, { passive: true });
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("touchmove", onTouch);
			window.removeEventListener("keydown", onKey);
		};
	}, []);

	const start = (replayMode = false) => {
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
				const o2 = audioCtx.current!.createOscillator();
				const g2 = audioCtx.current!.createGain();
				o2.type = s.type;
				o2.frequency.value = s.base * 2;
				g2.gain.value = 0;
				o2.connect(g2).connect(audioCtx.current!.destination);
				o2.start();
				return { o, g, o2, g2 };
			});
		} catch {}
		setTime(0);
		if (!replayMode) {
			setPlayed(SECTIONS.map(() => Array(DURATION * SAMPLES_PER_SEC).fill(0)));
		}
		setScore(null);
		setPlaying(true);
	};

	const replayLast = () => {
		if (replay) {
			setPlayed(replay);
			start(true);
		}
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
					let seg = Math.floor(mouseRef.current.x * SECTIONS.length);
					let vol = mouseRef.current.y;
					if (keyRef.current.section >= 0) {
						seg = keyRef.current.section;
						vol = keyRef.current.vol;
					}
					const idx = Math.min(
						DURATION * SAMPLES_PER_SEC - 1,
						Math.floor(nt * SAMPLES_PER_SEC),
					);
					setPlayed((p) =>
						p.map((arr, si) => {
							if (si === seg) {
								const cp = [...arr];
								cp[idx] = vol;
								return cp;
							}
							return arr;
						}),
					);
					oscs.current.forEach((osc, si) => {
						try {
							const tg = si === seg ? vol * 0.18 : osc.g.gain.value * 0.7 || 0;
							osc.g.gain.linearRampToValueAtTime(
								tg,
								audioCtx.current!.currentTime + 0.05,
							);
							if (osc.g2) {
								osc.g2.gain.linearRampToValueAtTime(
									tg * 0.3,
									audioCtx.current!.currentTime + 0.05,
								);
							}
						} catch {}
					});
				}
				if (nt >= DURATION) {
					setPlaying(false);
					let err = 0;
					for (let s = 0; s < SECTIONS.length; s++) {
						for (let i = 0; i < target[s].length; i++) {
							err += Math.abs(target[s][i] - played[s][i]);
						}
					}
					const totalSamples = SECTIONS.length * DURATION * SAMPLES_PER_SEC;
					const sc = Math.max(0, Math.round(100 - (err / totalSamples) * 100));
					setScore(sc);
					setReplay(played);
					if (sc > best) {
						setBest(sc);
						try {
							localStorage.setItem(BEST_KEY, String(sc));
						} catch {}
					}
					oscs.current.forEach((osc) => {
						try {
							osc.g.gain.linearRampToValueAtTime(
								0,
								audioCtx.current!.currentTime + 0.1,
							);
							if (osc.g2)
								osc.g2.gain.linearRampToValueAtTime(
									0,
									audioCtx.current!.currentTime + 0.1,
								);
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
	}, [playing, target, played, best]);

	const curIdx = Math.min(
		DURATION * SAMPLES_PER_SEC - 1,
		Math.floor(time * SAMPLES_PER_SEC),
	);

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
			<div style={{ display: "flex", justifyContent: "space-between" }}>
				<b>Conducting</b>
				<span style={{ fontSize: 12, opacity: 0.85 }}>
					Best: {best} · Keys 1-4 select section, ↑/↓ volume
				</span>
			</div>
			<div style={{ fontSize: 12, opacity: 0.7 }}>
				Move mouse: x = section, height = volume. Match the dashed target curves.
			</div>

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

			<div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
				<button
					onClick={() => start(false)}
					disabled={playing}
					style={{ padding: "8px 18px", fontSize: 14 }}
				>
					{playing ? "Conducting…" : "Begin"}
				</button>
				<button
					onClick={replayLast}
					disabled={playing || !replay}
					style={{ padding: "6px 14px", fontSize: 13 }}
				>
					Replay
				</button>
				<button
					onClick={() => {
						setSeed((Math.random() * 1e9) | 0);
						setScore(null);
						setReplay(null);
						setPlayed(SECTIONS.map(() => Array(DURATION * SAMPLES_PER_SEC).fill(0)));
					}}
					disabled={playing}
					style={{ padding: "6px 14px", fontSize: 13 }}
				>
					New score
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
