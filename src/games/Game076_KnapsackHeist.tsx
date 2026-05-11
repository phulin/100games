import { useEffect, useMemo, useRef, useState } from "react";

// Game 76 — Knapsack Heist
// Procedural loot. Pick items balancing weight/value/noise.
// Difficulty scales across heists. Best gold persisted locally.

type Item = {
	id: number;
	name: string;
	weight: number;
	value: number;
	noise: number;
	icon: string;
	rarity: 0 | 1 | 2;
};

const POOL: ReadonlyArray<{ n: string; i: string }> = [
	{ n: "Gold coin", i: "🪙" },
	{ n: "Ruby", i: "💎" },
	{ n: "Goblet", i: "🏆" },
	{ n: "Painting", i: "🖼️" },
	{ n: "Tiara", i: "👑" },
	{ n: "Scroll", i: "📜" },
	{ n: "Vase", i: "🏺" },
	{ n: "Statuette", i: "🗿" },
	{ n: "Dagger", i: "🗡️" },
	{ n: "Mirror", i: "🪞" },
	{ n: "Necklace", i: "📿" },
	{ n: "Coin pile", i: "💰" },
	{ n: "Music box", i: "🎼" },
	{ n: "Key", i: "🗝️" },
	{ n: "Skull", i: "💀" },
	{ n: "Map", i: "🗺️" },
	{ n: "Lantern", i: "🏮" },
	{ n: "Crystal", i: "🔮" },
	{ n: "Locket", i: "🔗" },
	{ n: "Wine bottle", i: "🍷" },
	{ n: "Idol", i: "🗿" },
	{ n: "Chalice", i: "🍶" },
	{ n: "Mask", i: "🎭" },
	{ n: "Bell", i: "🔔" },
	{ n: "Telescope", i: "🔭" },
	{ n: "Compass", i: "🧭" },
	{ n: "Hourglass", i: "⏳" },
	{ n: "Tome", i: "📕" },
];

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

const BEST_KEY = "knapsack:best";
const HEIST_KEY = "knapsack:heist";

function makeItems(seed: number, level: number): Item[] {
	const rnd = mulberry32(seed);
	const count = 15 + Math.floor(rnd() * 6);
	const indices = POOL.map((_, idx) => idx);
	for (let i = indices.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		[indices[i], indices[j]] = [indices[j], indices[i]];
	}
	const chosen = indices.slice(0, count);
	return chosen.map((pi, i) => {
		const p = POOL[pi];
		const r = rnd();
		const rarity: 0 | 1 | 2 = r > 0.92 ? 2 : r > 0.75 ? 1 : 0;
		const valMul = rarity === 2 ? 3.2 : rarity === 1 ? 1.7 : 1;
		const noiseMul = rarity === 2 ? 1.8 : rarity === 1 ? 1.3 : 1;
		const baseWeight = 1 + Math.floor(rnd() * 9);
		const baseValue = Math.round((5 + rnd() * 60) * valMul) + level * 2;
		const baseNoise = Math.round(rnd() * 9 * noiseMul);
		return {
			id: i,
			name: p.n,
			icon: p.i,
			weight: baseWeight,
			value: baseValue,
			noise: Math.min(20, baseNoise),
			rarity,
		};
	});
}

class HeistAudio {
	private ctx: AudioContext | null = null;
	private heart: { o: OscillatorNode; g: GainNode } | null = null;
	private ensure() {
		if (!this.ctx) {
			try {
				this.ctx = new AudioContext();
			} catch {
				return null;
			}
		}
		if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
		return this.ctx;
	}
	click(noise: number) {
		const c = this.ensure();
		if (!c) return;
		const o = c.createOscillator();
		const g = c.createGain();
		o.type = "triangle";
		o.frequency.setValueAtTime(420 - noise * 12, c.currentTime);
		o.frequency.exponentialRampToValueAtTime(180, c.currentTime + 0.12);
		g.gain.setValueAtTime(0.0001, c.currentTime);
		g.gain.exponentialRampToValueAtTime(0.18, c.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.18);
		o.connect(g).connect(c.destination);
		o.start();
		o.stop(c.currentTime + 0.2);
	}
	sting(kind: "win" | "lose") {
		const c = this.ensure();
		if (!c) return;
		const notes = kind === "win" ? [392, 523, 659, 784] : [262, 196, 146];
		notes.forEach((f, i) => {
			const o = c.createOscillator();
			const g = c.createGain();
			o.type = kind === "win" ? "triangle" : "sawtooth";
			o.frequency.value = f;
			const t0 = c.currentTime + i * 0.12;
			g.gain.setValueAtTime(0.0001, t0);
			g.gain.exponentialRampToValueAtTime(0.2, t0 + 0.02);
			g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
			o.connect(g).connect(c.destination);
			o.start(t0);
			o.stop(t0 + 0.4);
		});
	}
	startHeart() {
		const c = this.ensure();
		if (!c || this.heart) return;
		const o = c.createOscillator();
		const g = c.createGain();
		o.type = "sine";
		o.frequency.value = 60;
		g.gain.value = 0.0;
		o.connect(g).connect(c.destination);
		o.start();
		this.heart = { o, g };
	}
	heartIntensity(p: number) {
		const c = this.ctx;
		if (!c || !this.heart) return;
		const t = c.currentTime;
		const amp = 0.02 + p * 0.18;
		this.heart.g.gain.cancelScheduledValues(t);
		this.heart.g.gain.setValueAtTime(amp, t);
		this.heart.g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
		this.heart.o.frequency.setValueAtTime(45 + p * 40, t);
	}
	stopHeart() {
		if (!this.heart) return;
		try {
			this.heart.o.stop();
		} catch {}
		this.heart = null;
	}
}

const MAX_WEIGHT_BASE = 25;
const TIME_LIMIT_BASE = 30;

export default function Game076_KnapsackHeist() {
	const [heist, setHeist] = useState<number>(() => {
		try {
			return parseInt(localStorage.getItem(HEIST_KEY) || "1") || 1;
		} catch {
			return 1;
		}
	});
	const [seed, setSeed] = useState<number>(() => (Math.random() * 1e9) | 0);
	const [items, setItems] = useState<Item[]>(() => makeItems(seed, heist));
	const [picked, setPicked] = useState<Set<number>>(new Set());
	const [time, setTime] = useState(0);
	const [escaped, setEscaped] = useState<null | "caught" | "weight" | "win">(null);
	const [showRatio, setShowRatio] = useState(false);
	const [best, setBest] = useState<number>(() => {
		try {
			return parseInt(localStorage.getItem(BEST_KEY) || "0") || 0;
		} catch {
			return 0;
		}
	});
	const [total, setTotal] = useState<number>(0);
	const last = useRef<number | null>(null);
	const audio = useRef(new HeistAudio());

	const maxWeight = MAX_WEIGHT_BASE + Math.floor(heist / 3);
	const timeLimit = Math.max(15, TIME_LIMIT_BASE - heist);

	useEffect(() => {
		setItems(makeItems(seed, heist));
		setPicked(new Set());
		setTime(0);
		setEscaped(null);
	}, [seed, heist]);

	useEffect(() => {
		if (escaped) {
			audio.current.stopHeart();
			return;
		}
		audio.current.startHeart();
		let raf = 0;
		const step = (ts: number) => {
			if (last.current == null) last.current = ts;
			const dt = (ts - last.current) / 1000;
			last.current = ts;
			setTime((t) => {
				const nt = t + dt;
				audio.current.heartIntensity(Math.min(1, nt / timeLimit));
				if (nt >= timeLimit) {
					audio.current.sting("lose");
					setEscaped("caught");
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
	}, [escaped, timeLimit]);

	const totals = useMemo(() => {
		let w = 0, v = 0, n = 0;
		for (const id of picked) {
			const it = items[id];
			w += it.weight;
			v += it.value;
			n += it.noise;
		}
		return { w, v, n };
	}, [picked, items]);

	const toggle = (id: number) => {
		if (escaped) return;
		const item = items[id];
		if (!item) return;
		setPicked((prev) => {
			const cp = new Set(prev);
			const taking = !cp.has(id);
			if (taking) {
				cp.add(id);
				setTime((t) => t + item.noise * 0.15);
			} else {
				cp.delete(id);
			}
			return cp;
		});
		audio.current.click(item.noise);
	};

	const flee = () => {
		if (escaped) return;
		if (totals.w > maxWeight) {
			audio.current.sting("lose");
			setEscaped("weight");
			return;
		}
		audio.current.sting("win");
		setEscaped("win");
		const newTotal = total + totals.v;
		setTotal(newTotal);
		if (newTotal > best) {
			setBest(newTotal);
			try {
				localStorage.setItem(BEST_KEY, String(newTotal));
			} catch {}
		}
	};

	const nextHeist = () => {
		const nh = heist + 1;
		setHeist(nh);
		try {
			localStorage.setItem(HEIST_KEY, String(nh));
		} catch {}
		setSeed((Math.random() * 1e9) | 0);
	};

	const retry = () => {
		setTotal(0);
		setHeist(1);
		try {
			localStorage.setItem(HEIST_KEY, "1");
		} catch {}
		setSeed((Math.random() * 1e9) | 0);
	};

	const danger = time / timeLimit;
	const rarityCol = (r: 0 | 1 | 2) => (r === 2 ? "#f6c64a" : r === 1 ? "#9bcaff" : "#888");
	const rarityLabel = (r: 0 | 1 | 2) => (r === 2 ? "★★" : r === 1 ? "★" : "");

	return (
		<div
			style={{
				width: 900,
				height: 600,
				background: "#1a1213",
				color: "#f1e9d2",
				fontFamily: "system-ui, sans-serif",
				padding: 16,
				boxSizing: "border-box",
				userSelect: "none",
				position: "relative",
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between" }}>
				<div>
					<b>Knapsack Heist</b> — Heist #{heist}. Pack loot; flee before the guard arrives.
				</div>
				<div style={{ fontSize: 12, opacity: 0.85 }}>
					Run total: <b>{total}g</b> · Best: <b>{best}g</b>
				</div>
			</div>
			<div
				style={{
					marginTop: 10,
					display: "flex",
					gap: 14,
					alignItems: "center",
					flexWrap: "wrap",
				}}
			>
				<div>Weight: <b style={{ color: totals.w > maxWeight ? "#f55" : "#fff" }}>{totals.w}/{maxWeight}</b></div>
				<div>Value: <b>{totals.v}g</b></div>
				<div>
					Guard:{" "}
					<div
						style={{
							display: "inline-block",
							width: 180,
							height: 12,
							background: "#333",
							verticalAlign: "middle",
						}}
					>
						<div
							style={{
								width: `${Math.min(100, danger * 100)}%`,
								height: "100%",
								background: `hsl(${(1 - Math.min(1, danger)) * 120}, 80%, 50%)`,
								transition: "width 0.1s linear",
							}}
						/>
					</div>
				</div>
				<button onClick={flee} style={{ padding: "8px 18px", fontSize: 14 }}>
					Flee!
				</button>
				<label style={{ fontSize: 12, cursor: "pointer" }}>
					<input
						type="checkbox"
						checked={showRatio}
						onChange={(e) => setShowRatio(e.target.checked)}
					/>{" "}
					show g/wt
				</label>
			</div>

			<div
				style={{
					marginTop: 14,
					display: "grid",
					gridTemplateColumns: "repeat(5, 1fr)",
					gap: 8,
				}}
			>
				{items.map((it) => {
					const taken = picked.has(it.id);
					const ratio = (it.value / it.weight).toFixed(1);
					return (
						<div
							key={it.id}
							onClick={() => toggle(it.id)}
							style={{
								background: taken ? "#2a4019" : "#2a2226",
								border: `2px solid ${taken ? "#6f6" : rarityCol(it.rarity)}`,
								padding: 8,
								borderRadius: 6,
								cursor: "pointer",
								textAlign: "center",
								fontSize: 12,
								boxShadow:
									it.rarity === 2
										? "0 0 12px #f6c64a55"
										: it.rarity === 1
											? "0 0 6px #9bcaff44"
											: undefined,
							}}
						>
							<div style={{ fontSize: 26 }}>{it.icon}</div>
							<div>
								{it.name}{" "}
								<span style={{ color: rarityCol(it.rarity) }}>{rarityLabel(it.rarity)}</span>
							</div>
							<div style={{ fontSize: 11, opacity: 0.8 }}>
								⚖{it.weight} 💰{it.value} 🔊{it.noise}
								{showRatio && <span style={{ marginLeft: 4, color: "#fc8" }}>({ratio})</span>}
							</div>
						</div>
					);
				})}
			</div>

			{escaped && (
				<div
					style={{
						position: "absolute",
						top: "40%",
						left: 0,
						right: 0,
						textAlign: "center",
						fontSize: 24,
						background: "rgba(0,0,0,0.78)",
						padding: 30,
					}}
				>
					{escaped === "win" && (
						<>
							<div>Escaped with {totals.v}g!</div>
							<div style={{ fontSize: 14, marginTop: 6, opacity: 0.8 }}>
								Run total: {total + 0}g · Difficulty rising…
							</div>
						</>
					)}
					{escaped === "caught" && "The guard caught you! Run over."}
					{escaped === "weight" && "Too heavy — couldn't slip out!"}
					<div style={{ marginTop: 12, display: "flex", gap: 10, justifyContent: "center" }}>
						{escaped === "win" ? (
							<button onClick={nextHeist} style={{ padding: "8px 18px" }}>
								Next heist
							</button>
						) : (
							<button onClick={retry} style={{ padding: "8px 18px" }}>
								New run
							</button>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
