import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Game 52: Tide Pool
// Click creatures to feed/save them as the tide changes. Keep your pool alive.
// Improvements:
//   1. Seeded mulberry32 RNG drives spawn positions / types (daily seed, no Math.random)
//   2. Predator gulls swoop in at high tide — click to shoo them off (+points)
//   3. Per-species diet preference ring (visual cue: which tide level they prefer)
//   4. Feed-streak combo multiplier with WebAudio plonk per feed
//   5. Day/night tint cycle tied to tide, plus persistent best score

type CreatureType = "anemone" | "crab" | "fish" | "urchin";
type Creature = {
	id: number;
	type: CreatureType;
	x: number;
	y: number;
	hunger: number;
	alive: boolean;
	wobble: number;
};
type Gull = { id: number; x: number; y: number; target: number; cooldown: number };

const W = 900;
const H = 600;
const TICK = 1000 / 30;
const TYPES: CreatureType[] = ["anemone", "crab", "fish", "urchin"];

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function todayUTCSeed(): number {
	const d = new Date();
	return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

let CID = 0;
let GID = 0;

export default function TidePool() {
	const [seed, setSeed] = useState<number>(() => todayUTCSeed());
	const rngRef = useRef(mulberry32(seed));

	const seedCreatures = useCallback((rng: () => number): Creature[] => {
		const out: Creature[] = [];
		for (let i = 0; i < 8; i++) {
			out.push({
				id: CID++,
				type: TYPES[i % 4],
				x: 80 + rng() * (W - 160),
				y: 140 + rng() * (H - 220),
				hunger: 0.2 + rng() * 0.3,
				alive: true,
				wobble: rng() * Math.PI * 2,
			});
		}
		return out;
	}, []);

	const [creatures, setCreatures] = useState<Creature[]>(() => seedCreatures(rngRef.current));
	const [gulls, setGulls] = useState<Gull[]>([]);
	const [tide, setTide] = useState(0.5);
	const [score, setScore] = useState(0);
	const [streak, setStreak] = useState(0);
	const [time, setTime] = useState(60);
	const [over, setOver] = useState(false);
	const [best, setBest] = useState(() => parseInt(localStorage.getItem("g52_best") || "0", 10));
	const ref = useRef({ tideDir: 1 });
	const audioRef = useRef<AudioContext | null>(null);

	const dietPref: Record<CreatureType, number> = useMemo(
		() => ({ anemone: 1, fish: 1, crab: 0, urchin: 0.5 }),
		[],
	);

	function ensureAudio() {
		if (!audioRef.current) {
			try {
				audioRef.current = new (window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
			} catch {
				/* ignore */
			}
		}
	}
	function tone(freq: number, dur = 0.12, type: OscillatorType = "sine", vol = 0.18) {
		const ac = audioRef.current;
		if (!ac) return;
		const o = ac.createOscillator();
		const g = ac.createGain();
		o.type = type;
		o.frequency.value = freq;
		o.connect(g);
		g.connect(ac.destination);
		g.gain.setValueAtTime(0.0001, ac.currentTime);
		g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
		o.start();
		o.stop(ac.currentTime + dur + 0.05);
	}

	useEffect(() => {
		rngRef.current = mulberry32(seed);
		setCreatures(seedCreatures(rngRef.current));
		setGulls([]);
		setScore(0);
		setStreak(0);
		setTide(0.5);
		setTime(60);
		setOver(false);
	}, [seed, seedCreatures]);

	useEffect(() => {
		if (over) return;
		const id = setInterval(() => {
			setTide((t) => {
				let nd = ref.current.tideDir;
				let nt = t + nd * 0.005;
				if (nt > 1) {
					nt = 1;
					nd = -1;
				}
				if (nt < 0) {
					nt = 0;
					nd = 1;
				}
				ref.current.tideDir = nd;
				return nt;
			});
			setCreatures((cs) =>
				cs.map((c) => {
					if (!c.alive) return c;
					const t = tide;
					const pref = dietPref[c.type];
					const mismatch = Math.abs(t - pref);
					const rate = 0.003 + mismatch * 0.014;
					const h = c.hunger + rate;
					const wobble = c.wobble + 0.06;
					if (h >= 1) return { ...c, hunger: 1, alive: false, wobble };
					return { ...c, hunger: h, wobble };
				}),
			);
			setTime((t) => {
				const nt = t - TICK / 1000;
				if (nt <= 0) {
					setOver(true);
					setScore((sc) => {
						setBest((b) => {
							const nb = Math.max(b, sc);
							localStorage.setItem("g52_best", String(nb));
							return nb;
						});
						return sc;
					});
					return 0;
				}
				return nt;
			});
		}, TICK);
		return () => clearInterval(id);
	}, [tide, over, dietPref]);

	useEffect(() => {
		if (over) return;
		const id = setInterval(() => {
			setCreatures((cs) => {
				const alive = cs.filter((c) => c.alive).length;
				if (alive > 14) return cs;
				const rng = rngRef.current;
				return [
					...cs,
					{
						id: CID++,
						type: TYPES[Math.floor(rng() * 4)],
						x: 80 + rng() * (W - 160),
						y: 140 + rng() * (H - 220),
						hunger: 0.4,
						alive: true,
						wobble: rng() * Math.PI * 2,
					},
				];
			});
		}, 2200);
		return () => clearInterval(id);
	}, [over]);

	useEffect(() => {
		if (over) return;
		const id = setInterval(() => {
			if (rngRef.current() < 0.3 + tide * 0.5) {
				setGulls((gs) => {
					if (gs.length >= 3) return gs;
					return [
						...gs,
						{
							id: GID++,
							x: rngRef.current() < 0.5 ? -40 : W + 40,
							y: 60 + rngRef.current() * 100,
							target: rngRef.current() * W,
							cooldown: 0,
						},
					];
				});
			}
		}, 3500);
		return () => clearInterval(id);
	}, [tide, over]);

	useEffect(() => {
		if (over) return;
		const id = setInterval(() => {
			setGulls((gs) =>
				gs
					.map((g) => {
						const dx = g.target - g.x;
						const nx = g.x + Math.sign(dx) * Math.min(Math.abs(dx), 2.5);
						const newCool = Math.max(0, g.cooldown - TICK / 1000);
						return { ...g, x: nx, cooldown: newCool };
					})
					.filter((g) => g.x > -100 && g.x < W + 100),
			);
			setCreatures((cs) => {
				let stolen = false;
				const ns = cs.map((c) => {
					if (!c.alive || stolen) return c;
					const g = gulls.find(
						(gg) => Math.abs(gg.x - c.x) < 26 && gg.cooldown === 0 && c.type === "fish" && c.hunger < 0.6,
					);
					if (g) {
						stolen = true;
						g.cooldown = 4;
						return { ...c, alive: false, hunger: 1 };
					}
					return c;
				});
				return ns;
			});
		}, TICK);
		return () => clearInterval(id);
	}, [over, gulls]);

	function feed(c: Creature) {
		if (!c.alive || over) return;
		ensureAudio();
		setCreatures((cs) => cs.map((x) => (x.id === c.id ? { ...x, hunger: Math.max(0, x.hunger - 0.5) } : x)));
		setStreak((st) => {
			const ns = st + 1;
			const mult = 1 + Math.floor(ns / 4);
			setScore((s) => s + mult);
			tone(440 + ns * 20, 0.1, "sine", 0.15);
			return ns;
		});
	}

	function shoo(g: Gull) {
		ensureAudio();
		tone(180, 0.18, "square", 0.18);
		setGulls((gs) => gs.map((x) => (x.id === g.id ? { ...x, target: x.x < W / 2 ? -200 : W + 200, cooldown: 5 } : x)));
		setScore((s) => s + 2);
	}

	function resetDaily() {
		ensureAudio();
		setSeed(todayUTCSeed());
		setStreak(0);
	}
	function newSeed() {
		setSeed(Math.floor(Math.random() * 0x7fffffff));
		setStreak(0);
	}

	const aliveCount = creatures.filter((c) => c.alive).length;
	const waterLevel = 80 + tide * 80;
	const dayTint = tide;
	const bgTop = `rgba(${20 + dayTint * 40},${100 + dayTint * 80},${160 + dayTint * 40},1)`;
	const bgBot = `rgba(${4 + dayTint * 10},${30 + dayTint * 30},${50 + dayTint * 20},1)`;

	return (
		<div style={{ background: "#04222b", color: "#cfeef5", padding: 12, fontFamily: "Verdana, sans-serif" }}>
			<h2 style={{ margin: 0 }}>Tide Pool</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Click creatures to feed (preference ring shows their ideal tide). Shoo away gulls. Survive 60s.
			</div>
			<div style={{ display: "flex", gap: 16, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
				<div>Score: {score}</div>
				<div>Best: {best}</div>
				<div>Streak: {streak}</div>
				<div>Alive: {aliveCount}</div>
				<div>Tide: {(tide * 100).toFixed(0)}%</div>
				<div>Time: {time.toFixed(1)}s</div>
				<div style={{ opacity: 0.7 }}>Seed {seed}</div>
				<button type="button" onClick={resetDaily} style={{ background: "#2b8a9c", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
					{over ? "Restart Daily" : "Daily"}
				</button>
				<button type="button" onClick={newSeed} style={{ background: "#7a3a8a", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
					New Seed
				</button>
			</div>
			<svg
				width={W}
				height={H}
				onClick={ensureAudio}
				style={{ display: "block", marginTop: 8, borderRadius: 6, background: `linear-gradient(${bgTop},${bgBot})` }}
			>
				<defs>
					<linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0%" stopColor="rgba(100,200,230,0.3)" />
						<stop offset="100%" stopColor="rgba(20,80,120,0.6)" />
					</linearGradient>
				</defs>
				<rect x={0} y={H - waterLevel - 200} width={W} height={waterLevel + 200} fill="url(#water)" />
				{[150, 350, 600, 800].map((x, i) => (
					<ellipse key={i} cx={x} cy={H - 30} rx={70} ry={28} fill="#1a2a30" />
				))}
				{gulls.map((g) => (
					<g
						key={g.id}
						transform={`translate(${g.x},${g.y})`}
						onClick={(e) => {
							e.stopPropagation();
							shoo(g);
						}}
						style={{ cursor: "pointer" }}
					>
						<ellipse cx={0} cy={0} rx={18} ry={6} fill="#eaeaea" />
						<path d={`M -18,0 Q -22,-10 -10,-6`} stroke="#bbb" fill="none" strokeWidth={3} />
						<path d={`M 18,0 Q 22,-10 10,-6`} stroke="#bbb" fill="none" strokeWidth={3} />
						<circle cx={14} cy={-2} r={3} fill="#fff" />
						<circle cx={15} cy={-2} r={1} fill="#000" />
					</g>
				))}
				{creatures.map((c) => {
					const color =
						c.type === "fish" ? "#ffb84d" : c.type === "crab" ? "#e25a3c" : c.type === "anemone" ? "#c060c0" : "#2a2a3a";
					const opacity = c.alive ? 1 : 0.25;
					const size = c.type === "urchin" ? 16 : 14;
					const pref = dietPref[c.type];
					const prefColor = `hsl(${200 - pref * 200},70%,60%)`;
					const wob = Math.sin(c.wobble) * 2;
					return (
						<g
							key={c.id}
							transform={`translate(${c.x},${c.y + wob})`}
							onClick={(e) => {
								e.stopPropagation();
								feed(c);
							}}
							style={{ cursor: c.alive ? "pointer" : "default", opacity }}
						>
							<circle cx={0} cy={0} r={size + 6} fill="none" stroke={prefColor} strokeWidth={1.5} strokeDasharray="3 3" opacity={0.6} />
							{c.type === "fish" && (
								<>
									<ellipse cx={0} cy={0} rx={size} ry={size * 0.55} fill={color} />
									<polygon points={`${-size},0 ${-size - 8},${-6} ${-size - 8},6`} fill={color} />
								</>
							)}
							{c.type === "crab" && (
								<>
									<ellipse cx={0} cy={0} rx={size} ry={size * 0.7} fill={color} />
									<circle cx={-size} cy={-4} r={4} fill={color} />
									<circle cx={size} cy={-4} r={4} fill={color} />
								</>
							)}
							{c.type === "anemone" && (
								<g>
									<circle cx={0} cy={0} r={size} fill={color} />
									{Array.from({ length: 8 }).map((_, k) => {
										const a = (k / 8) * Math.PI * 2;
										return (
											<line
												key={k}
												x1={0}
												y1={0}
												x2={Math.cos(a) * (size + 8)}
												y2={Math.sin(a) * (size + 8)}
												stroke={color}
												strokeWidth={2}
											/>
										);
									})}
								</g>
							)}
							{c.type === "urchin" && (
								<g>
									<circle cx={0} cy={0} r={size * 0.6} fill={color} />
									{Array.from({ length: 12 }).map((_, k) => {
										const a = (k / 12) * Math.PI * 2;
										return <line key={k} x1={0} y1={0} x2={Math.cos(a) * size} y2={Math.sin(a) * size} stroke="#444" strokeWidth={2} />;
									})}
								</g>
							)}
							<rect x={-size} y={size + 4} width={size * 2} height={3} fill="#fff3" />
							<rect
								x={-size}
								y={size + 4}
								width={size * 2 * (1 - c.hunger)}
								height={3}
								fill={c.hunger > 0.7 ? "#ff5a5a" : "#7be0a0"}
							/>
						</g>
					);
				})}
			</svg>
		</div>
	);
}
