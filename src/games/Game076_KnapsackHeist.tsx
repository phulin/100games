import { useEffect, useMemo, useRef, useState } from "react";

// Game 76 — Knapsack Heist
// 20 loot items with weight, value, noise. Guard approaches every second.
// Pack and leave before time/noise kills you.

type Item = {
	id: number;
	name: string;
	weight: number;
	value: number;
	noise: number;
	icon: string;
};

const ITEMS_POOL = [
	{ name: "Gold coin", icon: "🪙" },
	{ name: "Ruby", icon: "💎" },
	{ name: "Goblet", icon: "🏆" },
	{ name: "Painting", icon: "🖼️" },
	{ name: "Tiara", icon: "👑" },
	{ name: "Scroll", icon: "📜" },
	{ name: "Vase", icon: "🏺" },
	{ name: "Statuette", icon: "🗿" },
	{ name: "Dagger", icon: "🗡️" },
	{ name: "Mirror", icon: "🪞" },
	{ name: "Necklace", icon: "📿" },
	{ name: "Coin pile", icon: "💰" },
	{ name: "Music box", icon: "🎼" },
	{ name: "Key", icon: "🗝️" },
	{ name: "Skull", icon: "💀" },
	{ name: "Map", icon: "🗺️" },
	{ name: "Lantern", icon: "🏮" },
	{ name: "Crystal", icon: "🔮" },
	{ name: "Locket", icon: "📿" },
	{ name: "Wine bottle", icon: "🍷" },
];

function makeItems(): Item[] {
	return ITEMS_POOL.map((p, i) => {
		const seed = (i * 9301 + 49297) % 233280;
		const r = (seed % 100) / 100;
		return {
			id: i,
			name: p.name,
			icon: p.icon,
			weight: 1 + Math.floor(r * 9),
			value: 5 + Math.floor(((seed * 7) % 90) / 1),
			noise: Math.floor(((seed * 13) % 10)),
		};
	});
}

const MAX_WEIGHT = 25;
const TIME_LIMIT = 30;

export default function Game076_KnapsackHeist() {
	const [items, setItems] = useState<Item[]>(() => makeItems());
	const [picked, setPicked] = useState<Set<number>>(new Set());
	const [time, setTime] = useState(0);
	const [escaped, setEscaped] = useState<null | "caught" | "weight" | "win">(null);
	const last = useRef<number | null>(null);

	useEffect(() => {
		if (escaped) return;
		let raf = 0;
		const step = (ts: number) => {
			if (last.current == null) last.current = ts;
			const dt = (ts - last.current) / 1000;
			last.current = ts;
			setTime((t) => {
				const nt = t + dt;
				if (nt >= TIME_LIMIT) {
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
	}, [escaped]);

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
		const cp = new Set(picked);
		if (cp.has(id)) cp.delete(id);
		else cp.add(id);
		// noise accelerates the guard
		const item = items[id];
		setTime((t) => Math.min(TIME_LIMIT, t + item.noise * 0.15));
		setPicked(cp);
	};

	const flee = () => {
		if (escaped) return;
		if (totals.w > MAX_WEIGHT) {
			setEscaped("weight");
			return;
		}
		setEscaped("win");
	};

	const reset = () => {
		setItems(makeItems());
		setPicked(new Set());
		setTime(0);
		setEscaped(null);
	};

	const danger = time / TIME_LIMIT;

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
			}}
		>
			<div>
				<b>Knapsack Heist</b> — Pick loot. Click items to add. Each item's noise advances the guard. Flee in time, under weight.
			</div>
			<div
				style={{
					marginTop: 10,
					display: "flex",
					gap: 14,
					alignItems: "center",
				}}
			>
				<div>Weight: <b style={{ color: totals.w > MAX_WEIGHT ? "#f55" : "#fff" }}>{totals.w}/{MAX_WEIGHT}</b></div>
				<div>Value: <b>{totals.v}g</b></div>
				<div>
					Guard:{" "}
					<div
						style={{
							display: "inline-block",
							width: 200,
							height: 12,
							background: "#333",
							verticalAlign: "middle",
						}}
					>
						<div
							style={{
								width: `${danger * 100}%`,
								height: "100%",
								background: `hsl(${(1 - danger) * 120}, 80%, 50%)`,
							}}
						/>
					</div>
				</div>
				<button onClick={flee} style={{ padding: "8px 18px", fontSize: 14, marginLeft: 12 }}>
					Flee!
				</button>
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
					return (
						<div
							key={it.id}
							onClick={() => toggle(it.id)}
							style={{
								background: taken ? "#2a4019" : "#2a2226",
								border: taken ? "2px solid #6f6" : "1px solid #443",
								padding: 8,
								borderRadius: 6,
								cursor: "pointer",
								textAlign: "center",
								fontSize: 12,
							}}
						>
							<div style={{ fontSize: 30 }}>{it.icon}</div>
							<div>{it.name}</div>
							<div style={{ fontSize: 11, opacity: 0.8 }}>
								⚖{it.weight} 💰{it.value} 🔊{it.noise}
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
						fontSize: 28,
						background: "rgba(0,0,0,0.7)",
						padding: 30,
					}}
				>
					{escaped === "win" && `Escaped with ${totals.v}g!`}
					{escaped === "caught" && "The guard caught you!"}
					{escaped === "weight" && "Too heavy — couldn't get out fast enough!"}
					<div>
						<button onClick={reset} style={{ marginTop: 12, padding: "8px 18px" }}>
							New heist
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
