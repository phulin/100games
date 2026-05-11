import { useMemo, useState } from "react";

type Ing = { id: string; name: string; emoji: string };
const INGREDIENTS: Ing[] = [
	{ id: "rose", name: "Rose petal", emoji: "🌹" },
	{ id: "salt", name: "Sea salt", emoji: "🧂" },
	{ id: "pep", name: "Peppercorn", emoji: "⚫" },
	{ id: "lem", name: "Lemon zest", emoji: "🍋" },
	{ id: "gar", name: "Garlic", emoji: "🧄" },
	{ id: "gin", name: "Ginger", emoji: "🫚" },
];

// Hidden rules: (first ground onto second) => product
// commutative: rule applies regardless of order
function reaction(a: string, b: string): string | null {
	const k = [a, b].sort().join("+");
	const map: Record<string, string> = {
		"rose+salt": "Perfumed dust",
		"lem+rose": "Bright tonic",
		"pep+salt": "Table seasoning",
		"gar+gin": "Warming paste",
		"gar+lem": "Aioli base",
		"gin+pep": "Spice rub",
		"lem+salt": "Citrus brine",
		"pep+rose": "Dark sachet",
		"gin+rose": "Floral balm",
		"gar+salt": "Garlic salt",
	};
	return map[k] ?? null;
}

const TARGETS = [
	"Warming paste",
	"Citrus brine",
	"Spice rub",
	"Bright tonic",
	"Garlic salt",
];

export default function Game094_MortarAndPestle() {
	const [bowl, setBowl] = useState<string[]>([]);
	const [discovered, setDiscovered] = useState<Record<string, string>>(() => {
		try {
			return JSON.parse(localStorage.getItem("mp_notebook") || "{}");
		} catch {
			return {};
		}
	});
	const [target, setTarget] = useState(
		() => TARGETS[Math.floor(Math.random() * TARGETS.length)],
	);
	const [message, setMessage] = useState<string>(
		"Add two ingredients, then grind.",
	);
	const [score, setScore] = useState(0);

	function addIngredient(id: string) {
		if (bowl.length >= 2) return;
		setBowl([...bowl, id]);
		setMessage("");
	}
	function grind() {
		if (bowl.length !== 2) {
			setMessage("Need two ingredients.");
			return;
		}
		const [a, b] = bowl;
		const result = reaction(a, b);
		const key = [a, b].sort().join("+");
		if (result) {
			setDiscovered((d) => {
				const nd = { ...d, [key]: result };
				try {
					localStorage.setItem("mp_notebook", JSON.stringify(nd));
				} catch {}
				return nd;
			});
			if (result === target) {
				setScore((s) => s + 10);
				setMessage(`✓ Produced ${result}! New target.`);
				setTarget(TARGETS[Math.floor(Math.random() * TARGETS.length)]);
			} else {
				setMessage(`Produced: ${result}`);
			}
		} else {
			setMessage("A muddy mess. Nothing useful.");
		}
		setBowl([]);
	}
	function clearBowl() {
		setBowl([]);
		setMessage("");
	}

	const ingMap = useMemo(
		() => Object.fromEntries(INGREDIENTS.map((i) => [i.id, i])),
		[],
	);

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "Georgia, serif",
				background: "#f3ead2",
				color: "#3a2a14",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px" }}>Mortar &amp; Pestle</h2>
			<p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
				Click two herbs, then grind. Discover pairings; match the day's recipe.
			</p>

			<div style={{ display: "flex", gap: 24 }}>
				<div style={{ flex: 1 }}>
					<div style={{ marginBottom: 8 }}>
						<strong>Target:</strong> {target} &nbsp; | &nbsp;{" "}
						<strong>Score:</strong> {score}
					</div>
					<div
						style={{
							background: "#d9c896",
							border: "4px solid #8b6f3e",
							borderRadius: "50% 50% 45% 45% / 30% 30% 70% 70%",
							padding: 30,
							minHeight: 140,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: 14,
							fontSize: 48,
						}}
					>
						{bowl.length === 0 ? (
							<span style={{ fontSize: 14, opacity: 0.6 }}>(empty mortar)</span>
						) : (
							bowl.map((b, i) => <span key={i}>{ingMap[b].emoji}</span>)
						)}
					</div>
					<div style={{ marginTop: 12 }}>
						<button onClick={grind} disabled={bowl.length !== 2}>
							Grind
						</button>
						<button
							onClick={clearBowl}
							style={{ marginLeft: 8 }}
							disabled={!bowl.length}
						>
							Clear
						</button>
					</div>
					<div style={{ marginTop: 10, minHeight: 24, fontStyle: "italic" }}>
						{message}
					</div>

					<div style={{ marginTop: 14 }}>
						<strong>Shelf</strong>
						<div
							style={{
								display: "flex",
								flexWrap: "wrap",
								gap: 6,
								marginTop: 6,
							}}
						>
							{INGREDIENTS.map((ing) => (
								<button
									key={ing.id}
									onClick={() => addIngredient(ing.id)}
									disabled={bowl.length >= 2}
									style={{ padding: "8px 10px", fontSize: 18 }}
								>
									{ing.emoji} <span style={{ fontSize: 11 }}>{ing.name}</span>
								</button>
							))}
						</div>
					</div>
				</div>

				<div
					style={{
						width: 260,
						background: "#fff8e1",
						border: "1px solid #c2a464",
						padding: 10,
						borderRadius: 4,
					}}
				>
					<strong>Notebook</strong>
					<div style={{ fontSize: 12, marginTop: 6 }}>
						{Object.keys(discovered).length === 0 && <em>No recipes yet.</em>}
						{Object.entries(discovered).map(([k, v]) => {
							const [a, b] = k.split("+");
							return (
								<div key={k} style={{ marginBottom: 4 }}>
									{ingMap[a]?.emoji}+{ingMap[b]?.emoji} → <strong>{v}</strong>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
