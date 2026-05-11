import { useMemo, useState } from "react";

type Ingredient = {
	name: string;
	flavors: { sweet: number; salty: number; sour: number; bitter: number; umami: number };
	note: string;
};

const ALL_INGREDIENTS: Ingredient[] = [
	{ name: "Onion", flavors: { sweet: 1, salty: 0, sour: 0, bitter: 0, umami: 2 }, note: "warm and savory" },
	{ name: "Garlic", flavors: { sweet: 0, salty: 0, sour: 0, bitter: 1, umami: 3 }, note: "pungent" },
	{ name: "Carrot", flavors: { sweet: 3, salty: 0, sour: 0, bitter: 0, umami: 0 }, note: "sweet earth" },
	{ name: "Salt", flavors: { sweet: 0, salty: 5, sour: 0, bitter: 0, umami: 0 }, note: "sharp" },
	{ name: "Lemon", flavors: { sweet: 1, salty: 0, sour: 4, bitter: 1, umami: 0 }, note: "bright sour" },
	{ name: "Mushroom", flavors: { sweet: 0, salty: 0, sour: 0, bitter: 0, umami: 4 }, note: "forest depth" },
	{ name: "Tomato", flavors: { sweet: 2, salty: 0, sour: 2, bitter: 0, umami: 2 }, note: "ripe tang" },
	{ name: "Bay leaf", flavors: { sweet: 0, salty: 0, sour: 0, bitter: 2, umami: 0 }, note: "herbal bitter" },
	{ name: "Chili", flavors: { sweet: 0, salty: 0, sour: 0, bitter: 1, umami: 1 }, note: "fire" },
	{ name: "Sugar", flavors: { sweet: 5, salty: 0, sour: 0, bitter: 0, umami: 0 }, note: "pure sweet" },
	{ name: "Vinegar", flavors: { sweet: 0, salty: 0, sour: 5, bitter: 0, umami: 0 }, note: "sharp sour" },
	{ name: "Cream", flavors: { sweet: 2, salty: 0, sour: 0, bitter: 0, umami: 1 }, note: "rich smooth" },
	{ name: "Soy", flavors: { sweet: 0, salty: 3, sour: 0, bitter: 0, umami: 3 }, note: "salty depth" },
	{ name: "Honey", flavors: { sweet: 4, salty: 0, sour: 0, bitter: 0, umami: 0 }, note: "floral sweet" },
	{ name: "Thyme", flavors: { sweet: 0, salty: 0, sour: 0, bitter: 1, umami: 1 }, note: "herbal whisper" },
	{ name: "Pepper", flavors: { sweet: 0, salty: 0, sour: 0, bitter: 2, umami: 1 }, note: "sharp bite" },
	{ name: "Cabbage", flavors: { sweet: 1, salty: 0, sour: 0, bitter: 1, umami: 1 }, note: "green crunch" },
	{ name: "Ginger", flavors: { sweet: 0, salty: 0, sour: 0, bitter: 1, umami: 2 }, note: "warming spice" },
	{ name: "Coffee", flavors: { sweet: 0, salty: 0, sour: 1, bitter: 4, umami: 1 }, note: "dark bitter" },
	{ name: "Miso", flavors: { sweet: 0, salty: 3, sour: 0, bitter: 0, umami: 4 }, note: "fermented depth" },
];

const FLAVORS = ["sweet", "salty", "sour", "bitter", "umami"] as const;

type Flavors = Ingredient["flavors"];

function targetForRound(seed: number): Flavors {
	const rng = () => {
		seed = (seed * 1664525 + 1013904223) % 2 ** 32;
		return (seed >>> 0) / 2 ** 32;
	};
	return {
		sweet: Math.floor(rng() * 8 + 2),
		salty: Math.floor(rng() * 8 + 2),
		sour: Math.floor(rng() * 8 + 2),
		bitter: Math.floor(rng() * 6 + 1),
		umami: Math.floor(rng() * 8 + 2),
	};
}

export default function Game016_StoneSoup() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
	const target = useMemo(() => targetForRound(seed), [seed]);
	const [pot, setPot] = useState<Ingredient[]>([]);
	const [tasted, setTasted] = useState<Set<string>>(new Set());

	const totals: Flavors = pot.reduce(
		(acc, ing) => {
			for (const f of FLAVORS) acc[f] += ing.flavors[f];
			return acc;
		},
		{ sweet: 0, salty: 0, sour: 0, bitter: 0, umami: 0 } as Flavors,
	);

	function distance(a: Flavors, b: Flavors) {
		let d = 0;
		for (const f of FLAVORS) d += Math.abs(a[f] - b[f]);
		return d;
	}

	const dist = distance(totals, target);
	const matched = dist <= 3;
	const ruined = FLAVORS.some((f) => totals[f] > target[f] + 4);

	function add(ing: Ingredient) {
		if (matched) return;
		setPot([...pot, ing]);
		setTasted(new Set([...tasted, ing.name]));
	}

	function reset() {
		setSeed(Math.floor(Math.random() * 1e6));
		setPot([]);
		setTasted(new Set());
	}

	return (
		<div style={{ background: "#1a1410", color: "#eee", padding: 16, fontFamily: "system-ui", minHeight: 600 }}>
			<h2 style={{ margin: 0 }}>Stone Soup</h2>
			<p style={{ opacity: 0.7, margin: "4px 0 12px" }}>
				Add ingredients to match the target flavor profile. You can never remove anything.
			</p>
			<div style={{ display: "flex", gap: 24 }}>
				<div style={{ flex: 1 }}>
					<h3>Target</h3>
					{FLAVORS.map((f) => (
						<div key={f} style={{ display: "flex", alignItems: "center", gap: 8 }}>
							<span style={{ width: 60 }}>{f}</span>
							<div style={{ width: 200, height: 14, background: "#333", position: "relative" }}>
								<div
									style={{
										width: `${Math.min(100, (target[f] / 20) * 100)}%`,
										height: "100%",
										background: "#7fc97f",
									}}
								/>
								<div
									style={{
										position: "absolute",
										left: `${Math.min(100, (totals[f] / 20) * 100)}%`,
										top: -4,
										width: 2,
										height: 22,
										background: totals[f] > target[f] + 4 ? "#ff6b6b" : "#ffd166",
									}}
								/>
							</div>
							<span style={{ width: 60 }}>
								{totals[f]} / {target[f]}
							</span>
						</div>
					))}
					<div style={{ marginTop: 12 }}>
						Distance: {dist}
						{matched && <span style={{ color: "#7fc97f", marginLeft: 12 }}>MATCHED!</span>}
						{ruined && !matched && <span style={{ color: "#ff6b6b", marginLeft: 12 }}>Overpowered</span>}
					</div>
					<button onClick={reset} style={{ marginTop: 8 }}>
						New batch
					</button>
				</div>
				<div style={{ flex: 1 }}>
					<h3>Pot ({pot.length})</h3>
					<div style={{ maxHeight: 120, overflowY: "auto", fontSize: 13, opacity: 0.8 }}>
						{pot.map((ing, i) => (
							<div key={i}>{ing.name}</div>
						))}
					</div>
				</div>
			</div>
			<h3>Ingredients</h3>
			<div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
				{ALL_INGREDIENTS.map((ing) => (
					<button
						key={ing.name}
						onClick={() => add(ing)}
						disabled={matched}
						style={{
							padding: 8,
							background: "#3a2d20",
							color: "#eee",
							border: "1px solid #5a4030",
							cursor: matched ? "default" : "pointer",
							textAlign: "left",
						}}
					>
						<div style={{ fontWeight: "bold" }}>{ing.name}</div>
						<div style={{ fontSize: 11, opacity: 0.7 }}>
							{tasted.has(ing.name) ? ing.note : "untasted"}
						</div>
					</button>
				))}
			</div>
		</div>
	);
}
