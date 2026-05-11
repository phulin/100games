import { useEffect, useRef, useState } from "react";

// Lighthouse — aim a rotating beam to warn ships off rocks.

type ShipKind = "small" | "fast" | "tanker";
type Ship = {
	id: number;
	angle: number;
	dist: number;
	warned: boolean;
	saved: boolean;
	crashed: boolean;
	speed: number;
	kind: ShipKind;
	value: number;
};

const CX = 440;
const CY = 380;
const W = 880;
const H = 560;
const ROCK_RADIUS = 80;
const BEAM_WIDTH = 0.45;

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function useAudio() {
	const ctxRef = useRef<AudioContext | null>(null);
	const ensure = () => {
		if (!ctxRef.current) {
			try {
				ctxRef.current = new (window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
			} catch {
				/* no audio */
			}
		}
		return ctxRef.current;
	};
	const tone = (freq: number, dur: number, type: OscillatorType = "sine", gain = 0.1) => {
		const ctx = ensure();
		if (!ctx) return;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.value = freq;
		g.gain.setValueAtTime(0.0001, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.02);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + dur + 0.02);
	};
	const foghorn = () => {
		const ctx = ensure();
		if (!ctx) return;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = "sawtooth";
		o.frequency.setValueAtTime(110, ctx.currentTime);
		o.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.8);
		g.gain.setValueAtTime(0.0001, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + 1);
	};
	const crashSfx = () => {
		const ctx = ensure();
		if (!ctx) return;
		const buf = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
		const src = ctx.createBufferSource();
		src.buffer = buf;
		const g = ctx.createGain();
		g.gain.value = 0.25;
		src.connect(g).connect(ctx.destination);
		src.start();
	};
	return { ensure, tone, foghorn, crashSfx };
}

type Difficulty = "calm" | "stormy" | "fogbank";
const DIFF_CFG: Record<Difficulty, { spawn: [number, number]; fog: number; multHint: string }> = {
	calm: { spawn: [1.4, 1.8], fog: 0, multHint: "clear" },
	stormy: { spawn: [0.7, 1.0], fog: 0.15, multHint: "fast spawns" },
	fogbank: { spawn: [1.0, 1.4], fog: 0.55, multHint: "thick fog" },
};

export default function Game043_Lighthouse() {
	const [diff, setDiff] = useState<Difficulty>("calm");
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const rngRef = useRef(mulberry32(seed));
	const [beam, setBeam] = useState(0);
	const beamRef = useRef(0);
	const aimRef = useRef(0);
	const [ships, setShips] = useState<Ship[]>([]);
	const shipsRef = useRef<Ship[]>([]);
	const [saved, setSaved] = useState(0);
	const [crashed, setCrashed] = useState(0);
	const [streak, setStreak] = useState(0);
	const streakRef = useRef(0);
	const [bestStreak, setBestStreak] = useState(0);
	const [score, setScore] = useState(0);
	const [time, setTime] = useState(90);
	const [over, setOver] = useState(false);
	const [paused, setPaused] = useState(false);
	const lastT = useRef(0);
	const spawnT = useRef(0);
	const foghornT = useRef(0);
	const nextId = useRef(1);
	const audio = useAudio();
	const audioRef = useRef(audio);
	audioRef.current = audio;
	const cfg = DIFF_CFG[diff];
	const cfgRef = useRef(cfg);
	cfgRef.current = cfg;

	useEffect(() => {
		shipsRef.current = ships;
	}, [ships]);

	useEffect(() => {
		rngRef.current = mulberry32(seed);
	}, [seed]);

	useEffect(() => {
		streakRef.current = streak;
	}, [streak]);

	useEffect(() => {
		let raf = 0;
		const step = (t: number) => {
			if (!lastT.current) lastT.current = t;
			const dt = Math.min(0.05, (t - lastT.current) / 1000);
			lastT.current = t;
			if (!over && !paused) {
				let diff_ = aimRef.current - beamRef.current;
				while (diff_ > Math.PI) diff_ -= 2 * Math.PI;
				while (diff_ < -Math.PI) diff_ += 2 * Math.PI;
				const maxSpd = 2.5;
				beamRef.current += Math.max(-maxSpd * dt, Math.min(maxSpd * dt, diff_));
				setBeam(beamRef.current);

				spawnT.current -= dt;
				if (spawnT.current <= 0) {
					const r = rngRef.current;
					const [lo, hi] = cfgRef.current.spawn;
					spawnT.current = lo + r() * (hi - lo);
					const angle = r() * Math.PI * 2;
					const roll = r();
					let kind: ShipKind = "small";
					let speed = 25 + r() * 15;
					let value = 1;
					if (roll < 0.18) {
						kind = "fast";
						speed = 55 + r() * 20;
						value = 2;
					} else if (roll < 0.32) {
						kind = "tanker";
						speed = 15 + r() * 8;
						value = 3;
					}
					shipsRef.current = [
						...shipsRef.current,
						{
							id: nextId.current++,
							angle,
							dist: 280,
							warned: false,
							saved: false,
							crashed: false,
							speed,
							kind,
							value,
						},
					];
				}
				foghornT.current -= dt;
				if (foghornT.current <= 0 && cfgRef.current.fog > 0.3) {
					foghornT.current = 6 + rngRef.current() * 4;
					audioRef.current.foghorn();
				}

				let dSaved = 0;
				let dCrashed = 0;
				let dStreakBreak = false;
				let dScore = 0;
				const newShips = shipsRef.current
					.map((s) => {
						if (s.saved || s.crashed) return s;
						let angDiff = (((s.angle - beamRef.current) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
						if (angDiff > Math.PI) angDiff -= 2 * Math.PI;
						const inBeam = Math.abs(angDiff) < BEAM_WIDTH;
						let dist = s.dist;
						let warned = s.warned;
						if (inBeam) {
							if (!warned) audioRef.current.tone(660 + s.value * 100, 0.07, "triangle", 0.06);
							warned = true;
						}
						if (warned) {
							dist += s.speed * 0.7 * dt;
							if (dist > 320) {
								dSaved += 1;
								dScore += s.value * (1 + Math.floor(streakRef.current / 3));
								return { ...s, dist, warned, saved: true };
							}
						} else {
							dist -= s.speed * dt;
							if (dist <= ROCK_RADIUS) {
								dCrashed += 1;
								dStreakBreak = true;
								audioRef.current.crashSfx();
								return { ...s, dist: ROCK_RADIUS, crashed: true };
							}
						}
						return { ...s, dist, warned };
					})
					.filter((s) => !(s.saved && s.dist > 360) && !(s.crashed && rngRef.current() < 0.01));
				shipsRef.current = newShips;
				setShips(newShips);
				if (dSaved) {
					setSaved((v) => v + dSaved);
					setScore((v) => v + dScore);
				}
				if (dCrashed) setCrashed((v) => v + dCrashed);
				if (dSaved || dStreakBreak) {
					setStreak((k) => {
						if (dStreakBreak) return 0;
						const nk = k + dSaved;
						setBestStreak((b) => Math.max(b, nk));
						return nk;
					});
				}

				setTime((tt) => {
					const nt = tt - dt;
					if (nt <= 0) {
						setOver(true);
						return 0;
					}
					return nt;
				});
			}
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [over, paused]);

	const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		aimRef.current = Math.atan2(my - CY, mx - CX);
	};

	const reset = (d: Difficulty = diff) => {
		const ns = Math.floor(Math.random() * 1e9);
		setSeed(ns);
		setDiff(d);
		rngRef.current = mulberry32(ns);
		shipsRef.current = [];
		setShips([]);
		setSaved(0);
		setCrashed(0);
		setStreak(0);
		setScore(0);
		setTime(90);
		setOver(false);
		setPaused(false);
		lastT.current = 0;
		spawnT.current = 0;
		foghornT.current = 4;
	};

	const shipColor = (s: Ship) =>
		s.crashed ? "#f44" : s.saved ? "#4a4" : s.warned ? "#fc4" : "#abc";
	const shipSize = (s: Ship) => (s.kind === "tanker" ? 14 : s.kind === "fast" ? 8 : 10);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#040a18",
				color: "#cde",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "system-ui, sans-serif",
				userSelect: "none",
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between", width: W, padding: "4px 8px" }}>
				<div>
					<strong>Lighthouse</strong>
					<span style={{ opacity: 0.7, marginLeft: 10 }}>
						Move mouse to aim. Streak {streak} (best {bestStreak})
					</span>
				</div>
				<div>
					Score: {score} · Saved: {saved} · Crashed: {crashed} · Time: {time.toFixed(1)}s
				</div>
			</div>
			<svg
				width={W}
				height={H}
				onMouseMove={onMove}
				onMouseDown={() => audio.ensure()}
				style={{ background: "linear-gradient(#01040c,#02091a)", cursor: "crosshair" }}
			>
				<rect x={0} y={H - 80} width={W} height={80} fill="#031628" />
				<circle cx={CX} cy={CY} r={ROCK_RADIUS} fill="#2a2820" stroke="#3a342a" />
				{Array.from({ length: 14 }).map((_, i) => {
					const a = (i / 14) * Math.PI * 2;
					return (
						<circle
							key={i}
							cx={CX + Math.cos(a) * ROCK_RADIUS}
							cy={CY + Math.sin(a) * ROCK_RADIUS}
							r={8 + (i % 3) * 3}
							fill="#3a3328"
						/>
					);
				})}
				<path
					d={`M ${CX} ${CY} L ${CX + Math.cos(beam - BEAM_WIDTH) * 600} ${
						CY + Math.sin(beam - BEAM_WIDTH) * 600
					} A 600 600 0 0 1 ${CX + Math.cos(beam + BEAM_WIDTH) * 600} ${
						CY + Math.sin(beam + BEAM_WIDTH) * 600
					} Z`}
					fill="url(#beamGrad)"
					opacity={0.5}
				/>
				<defs>
					<radialGradient id="beamGrad" cx={CX} cy={CY} r={600} gradientUnits="userSpaceOnUse">
						<stop offset="0" stopColor="#ffe7a0" stopOpacity={0.9} />
						<stop offset="1" stopColor="#ffe7a0" stopOpacity={0} />
					</radialGradient>
				</defs>
				<rect x={CX - 12} y={CY - 30} width={24} height={36} fill="#888" />
				<circle cx={CX} cy={CY - 30} r={6} fill="#ffe080" />
				{ships.map((s) => {
					const sx = CX + Math.cos(s.angle) * s.dist;
					const sy = CY + Math.sin(s.angle) * s.dist;
					const sz = shipSize(s);
					return (
						<g key={s.id} transform={`translate(${sx},${sy}) rotate(${(s.angle * 180) / Math.PI})`}>
							<polygon
								points={`-${sz},-${sz / 2} ${sz},0 -${sz},${sz / 2}`}
								fill={shipColor(s)}
							/>
						</g>
					);
				})}
				{cfg.fog > 0 && <rect x={0} y={0} width={W} height={H} fill="#ccd" opacity={cfg.fog} />}
				{paused && (
					<text x={W / 2} y={H / 2} textAnchor="middle" fontSize={48} fill="#fff" opacity={0.5}>
						PAUSED
					</text>
				)}
			</svg>
			<div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
				<button type="button" style={btn} onClick={() => setPaused((p) => !p)}>
					{paused ? "Resume" : "Pause"}
				</button>
				{(Object.keys(DIFF_CFG) as Difficulty[]).map((d) => (
					<button
						type="button"
						key={d}
						onClick={() => reset(d)}
						style={{ ...btn, background: d === diff ? "#445" : "#2a3045" }}
					>
						{d} ({DIFF_CFG[d].multHint})
					</button>
				))}
				<span style={{ opacity: 0.6, fontSize: 12 }}>
					Big triangles=tankers (3pts), small=fast (2pts). Streak ≥3 boosts multiplier.
				</span>
			</div>
			{over && (
				<div style={{ marginTop: 12 }}>
					<strong>Time up.</strong> Final score:{" "}
					<span style={{ color: "#fc4" }}>{score - crashed * 2}</span> (saved {saved}, crashed {crashed},
					best streak {bestStreak})
					<button type="button" onClick={() => reset()} style={btn}>
						Play again
					</button>
				</div>
			)}
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#2a3045",
	color: "#fff",
	border: "1px solid #445",
	padding: "6px 12px",
	borderRadius: 6,
	cursor: "pointer",
};
