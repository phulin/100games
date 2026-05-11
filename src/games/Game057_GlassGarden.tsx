import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Game 57: Glass Garden
// Procedural per-run seed, audio feedback, weather events, persistent best score.

const W = 900;
const H = 600;
const BEST_KEY = "glass-garden:best";

type Plant = {
	id: number;
	x: number;
	y: number;
	water: number;
	growth: number;
	alive: boolean;
	hue: number;
	petals: number;
	sweetLo: number;
	sweetHi: number;
	drainRate: number;
};

type Weather = "calm" | "rain" | "drought";

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hashStr(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
	}
	return h >>> 0;
}

function makeSeed(): string {
	return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function seedPlants(seed: string): Plant[] {
	const rng = mulberry32(hashStr(`gg-plants:${seed}`));
	const n = 5 + Math.floor(rng() * 3);
	const out: Plant[] = [];
	const startX = (W - 130 * (n - 1)) / 2;
	for (let i = 0; i < n; i++) {
		const wiggle = (rng() - 0.5) * 30;
		out.push({
			id: i,
			x: startX + i * 130 + wiggle,
			y: H - 120,
			water: 0.55 + rng() * 0.15,
			growth: 0.04 + rng() * 0.04,
			alive: true,
			hue: Math.floor(rng() * 360),
			petals: 5 + Math.floor(rng() * 4),
			sweetLo: 0.35 + rng() * 0.1,
			sweetHi: 0.85 + rng() * 0.1,
			drainRate: 0.05 + rng() * 0.03,
		});
	}
	return out;
}

function useAudio() {
	const ctxRef = useRef<AudioContext | null>(null);
	const ensure = useCallback(() => {
		if (!ctxRef.current) {
			try {
				const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
					?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
				if (Ctor) ctxRef.current = new Ctor();
			} catch {}
		}
		return ctxRef.current;
	}, []);
	const drip = useCallback(() => {
		const ctx = ensure();
		if (!ctx) return;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = "sine";
		o.frequency.setValueAtTime(900, ctx.currentTime);
		o.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.18);
		g.gain.setValueAtTime(0.0001, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + 0.22);
	}, [ensure]);
	const shatter = useCallback(() => {
		const ctx = ensure();
		if (!ctx) return;
		const freqs = [1500, 2200, 3000, 1700];
		freqs.forEach((f, i) => {
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.type = "square";
			o.frequency.value = f + (Math.random() - 0.5) * 200;
			g.gain.setValueAtTime(0.0001, ctx.currentTime);
			g.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.005);
			g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25 + i * 0.05);
			o.connect(g).connect(ctx.destination);
			o.start();
			o.stop(ctx.currentTime + 0.3 + i * 0.05);
		});
	}, [ensure]);
	const chime = useCallback((freq: number) => {
		const ctx = ensure();
		if (!ctx) return;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = "triangle";
		o.frequency.value = freq;
		g.gain.setValueAtTime(0.0001, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + 0.62);
	}, [ensure]);
	return { drip, shatter, chime };
}

export default function GlassGarden() {
	const [seed, setSeed] = useState<string>(() => makeSeed());
	const initial = useMemo(() => seedPlants(seed), [seed]);
	const [plants, setPlants] = useState<Plant[]>(initial);
	const [score, setScore] = useState(0);
	const [time, setTime] = useState(60);
	const [over, setOver] = useState(false);
	const [weather, setWeather] = useState<Weather>("calm");
	const weatherUntilRef = useRef(0);
	const [hoverId, setHoverId] = useState<number | null>(null);
	const rafRef = useRef(0);
	const { drip, shatter, chime } = useAudio();
	const prevAliveRef = useRef<Set<number>>(new Set(initial.filter((p) => p.alive).map((p) => p.id)));
	const prevBloomedRef = useRef<Set<number>>(new Set());
	const weatherRngRef = useRef(mulberry32(hashStr(`gg-weather:${seed}`)));
	const [best, setBest] = useState<number>(() => {
		try {
			return Number.parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10) || 0;
		} catch {
			return 0;
		}
	});

	useEffect(() => {
		const fresh = seedPlants(seed);
		setPlants(fresh);
		setScore(0);
		setTime(60);
		setOver(false);
		setWeather("calm");
		weatherUntilRef.current = 0;
		prevAliveRef.current = new Set(fresh.filter((p) => p.alive).map((p) => p.id));
		prevBloomedRef.current = new Set();
		weatherRngRef.current = mulberry32(hashStr(`gg-weather:${seed}`));
	}, [seed]);

	useEffect(() => {
		let last = performance.now();
		const loop = (now: number) => {
			const dt = Math.min(60, now - last) / 1000;
			last = now;
			if (!over) {
				if (now >= weatherUntilRef.current) {
					const rng = weatherRngRef.current;
					const roll = rng();
					let w: Weather = "calm";
					if (roll < 0.2) w = "rain";
					else if (roll < 0.35) w = "drought";
					setWeather(w);
					weatherUntilRef.current = now + 4000 + rng() * 4000;
				}

				setPlants((ps) => {
					const rainBoost = weather === "rain" ? 0.05 : 0;
					const droughtMult = weather === "drought" ? 1.9 : 1;
					const next = ps.map((p) => {
						if (!p.alive) return p;
						const nw = p.water - dt * p.drainRate * droughtMult + dt * rainBoost;
						let nl: boolean = p.alive;
						let ng = p.growth;
						if (nw < 0.1) nl = false;
						else if (nw > 1.3) nl = false;
						else if (nw >= p.sweetLo && nw <= p.sweetHi) ng = Math.min(1, p.growth + dt * 0.05);
						return { ...p, water: Math.max(0, nw), growth: ng, alive: nl };
					});
					for (const p of next) {
						if (!p.alive && prevAliveRef.current.has(p.id)) {
							prevAliveRef.current.delete(p.id);
							shatter();
						}
						if (p.alive && p.growth >= 1 && !prevBloomedRef.current.has(p.id)) {
							prevBloomedRef.current.add(p.id);
							chime(523.25 + (p.id % 5) * 80);
						}
					}
					return next;
				});
				setTime((t) => {
					const nt = t - dt;
					if (nt <= 0) {
						setOver(true);
						return 0;
					}
					return nt;
				});
			}
			rafRef.current = requestAnimationFrame(loop);
		};
		rafRef.current = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafRef.current);
	}, [over, weather, shatter, chime]);

	useEffect(() => {
		const fully = plants.filter((p) => p.alive && p.growth >= 1).length;
		const partial = plants.filter((p) => p.alive && p.growth >= 0.5 && p.growth < 1).length;
		setScore(fully * 10 + partial * 3);
	}, [plants]);

	useEffect(() => {
		if (over && score > best) {
			setBest(score);
			try {
				localStorage.setItem(BEST_KEY, String(score));
			} catch {}
		}
	}, [over, score, best]);

	function water(id: number) {
		if (over) return;
		setPlants((ps) =>
			ps.map((p) => (p.id === id && p.alive ? { ...p, water: Math.min(1.5, p.water + 0.15) } : p)),
		);
		drip();
	}

	function reset() {
		setSeed(makeSeed());
	}

	return (
		<div style={{ background: "linear-gradient(#1a0f2a,#3a1a4a)", color: "#fde2ff", padding: 14, minHeight: 600, fontFamily: "Palatino, serif" }}>
			<h2 style={{ margin: 0 }}>Glass Garden</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Click a flower to water it. Each plant has its own sweet spot (hover to see). Too dry or too wet shatters it. Weather changes the rules.
			</div>
			<div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap" }}>
				<div>Score: {score}</div>
				<div>Best: {best}</div>
				<div>Time: {time.toFixed(1)}s</div>
				<div style={{ color: weather === "rain" ? "#7ad6ff" : weather === "drought" ? "#ffb060" : "#fde2ff" }}>
					Weather: {weather}
				</div>
				<div style={{ fontSize: 11, opacity: 0.6 }}>Seed: {seed}</div>
				<button type="button" onClick={reset} style={{ background: "#c060c0", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
					{over ? "Restart" : "New Seed"}
				</button>
			</div>
			<svg
				width={W}
				height={H}
				style={{
					display: "block",
					marginTop: 8,
					background:
						weather === "rain"
							? "radial-gradient(ellipse at 50% 90%, #2a4276, #0a0414)"
							: weather === "drought"
								? "radial-gradient(ellipse at 50% 90%, #663a22, #1a0a0a)"
								: "radial-gradient(ellipse at 50% 90%, #4a2266, #1a0a2a)",
					borderRadius: 6,
				}}
			>
				{weather === "rain" &&
					Array.from({ length: 40 }).map((_, i) => {
						const rx = (i * 73) % W;
						const ry = (performance.now() / 4 + i * 30) % H;
						return <line key={`r${i}`} x1={rx} y1={ry} x2={rx + 2} y2={ry + 10} stroke="#7ad6ff" strokeWidth={1} opacity={0.6} />;
					})}
				<rect x={0} y={H - 60} width={W} height={60} fill="#0a0414" />
				{plants.map((p) => {
					const stemH = 60 + p.growth * 200;
					const flowerR = 8 + p.growth * 28;
					const zone = p.water >= p.sweetLo && p.water <= p.sweetHi;
					const danger = p.water < 0.2 || p.water > 1.1;
					const hovered = hoverId === p.id;
					return (
						<g
							key={p.id}
							onClick={() => water(p.id)}
							onMouseEnter={() => setHoverId(p.id)}
							onMouseLeave={() => setHoverId((h) => (h === p.id ? null : h))}
							style={{ cursor: p.alive ? "pointer" : "default" }}
						>
							<line x1={p.x} y1={H - 60} x2={p.x} y2={H - 60 - stemH} stroke={p.alive ? "#7be0a0" : "#444"} strokeWidth={4} />
							{p.alive && (
								<g transform={`translate(${p.x},${H - 60 - stemH})`}>
									{Array.from({ length: p.petals }).map((_, k) => {
										const a = (k / p.petals) * Math.PI * 2;
										return (
											<ellipse
												key={k}
												cx={Math.cos(a) * flowerR * 0.7}
												cy={Math.sin(a) * flowerR * 0.7}
												rx={flowerR * 0.6}
												ry={flowerR * 0.4}
												fill={`hsla(${p.hue},80%,70%,0.7)`}
												stroke={`hsl(${p.hue},80%,85%)`}
												transform={`rotate(${(a * 180) / Math.PI})`}
											/>
										);
									})}
									<circle r={flowerR * 0.35} fill={`hsl(${(p.hue + 60) % 360},90%,75%)`} />
								</g>
							)}
							{!p.alive && (
								<g transform={`translate(${p.x},${H - 90})`}>
									{Array.from({ length: 5 }).map((_, k) => (
										<polygon key={k} points={`0,0 ${-8 + k * 4},${15 + k * 3} ${8 - k * 4},${20 + k * 3}`} fill="#333" opacity={0.5} />
									))}
								</g>
							)}
							<rect x={p.x - 30} y={H - 50} width={60} height={8} fill="#0006" />
							<rect x={p.x - 30 + 60 * (p.sweetLo / 1.5)} y={H - 50} width={60 * ((p.sweetHi - p.sweetLo) / 1.5)} height={8} fill="#0a4030" />
							<rect x={p.x - 30} y={H - 50} width={60 * Math.min(1, p.water / 1.5)} height={8} fill={danger ? "#ff5e7e" : zone ? "#5eff8d" : "#ffd75e"} />
							<rect x={p.x - 30} y={H - 38} width={60} height={4} fill="#0006" />
							<rect x={p.x - 30} y={H - 38} width={60 * p.growth} height={4} fill="#c0a8ff" />
							{hovered && p.alive && (
								<text x={p.x} y={H - 100 - stemH} textAnchor="middle" fontSize={11} fill="#fde2ff">
									sweet {(p.sweetLo * 100).toFixed(0)}-{(p.sweetHi * 100).toFixed(0)}%
								</text>
							)}
						</g>
					);
				})}
			</svg>
		</div>
	);
}
