import { useMemo, useState } from "react";

// The Inheritance — observe 8 heirs across 5 days, then allocate items based on a vague wish.

const HEIRS = ["Alma", "Bram", "Cleo", "Doran", "Eira", "Finn", "Greta", "Hale"];

type Trait = "kind" | "greedy" | "wise" | "wild" | "frugal";
const TRAITS: Trait[] = ["kind", "greedy", "wise", "wild", "frugal"];

type Heir = {
	name: string;
	traits: Record<Trait, number>; // hidden, -2..2
};

type Item = { id: string; name: string; tag: Trait; awarded?: string };

const ITEMS: Item[] = [
	{ id: "cottage", name: "the cottage by the sea", tag: "kind" },
	{ id: "vault", name: "the locked vault", tag: "greedy" },
	{ id: "library", name: "the library", tag: "wise" },
	{ id: "horse", name: "the wild horse", tag: "wild" },
	{ id: "coins", name: "the coin purse", tag: "frugal" },
];

function rngFrom(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0x100000000;
	};
}

function makeHeirs(seed: number): Heir[] {
	const r = rngFrom(seed);
	return HEIRS.map((name) => {
		const t: Record<Trait, number> = { kind: 0, greedy: 0, wise: 0, wild: 0, frugal: 0 };
		// Assign 1-2 dominant traits. Use Fisher-Yates: sort() with a non-transitive
		// comparator produces engine-dependent results, so the "seeded" output wasn't
		// actually deterministic.
		const shuffled = [...TRAITS];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(r() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		t[shuffled[0]] = 2;
		if (r() < 0.6) t[shuffled[1]] = 1;
		if (r() < 0.4) t[shuffled[2]] = -1;
		return { name, traits: t };
	});
}

// Generate observable interactions across 5 days
function makeEvents(heirs: Heir[], seed: number): { day: number; text: string }[] {
	const r = rngFrom(seed);
	const events: { day: number; text: string }[] = [];
	const templates: Record<Trait, (n: string) => string> = {
		kind: (n) => `${n} brought soup to a sick neighbor.`,
		greedy: (n) => `${n} hid a candlestick in their bag.`,
		wise: (n) => `${n} settled a quarrel over a hedgerow.`,
		wild: (n) => `${n} rode bareback through the orchard at dawn.`,
		frugal: (n) => `${n} darned three pairs of socks rather than buy new.`,
	};
	const antiTemplates: Record<Trait, (n: string) => string> = {
		kind: (n) => `${n} snapped at the cook for nothing.`,
		greedy: (n) => `${n} gave away their share of the meat.`,
		wise: (n) => `${n} forgot to lock the gate again.`,
		wild: (n) => `${n} sat by the window for hours without moving.`,
		frugal: (n) => `${n} bought a third pair of fine boots.`,
	};
	for (let day = 1; day <= 5; day++) {
		// Each day, 4-5 events
		const n = 4 + Math.floor(r() * 2);
		for (let i = 0; i < n; i++) {
			const h = heirs[Math.floor(r() * heirs.length)];
			// Only pick traits the heir actually has (positive OR negative). The old code
			// rolled a baseline-weighted trait then showed ANTI behavior whenever the heir
			// was neutral on it — slandering them for traits they don't have and making
			// the puzzle unwinnable in practice.
			const nonNeutral = TRAITS.filter((t) => h.traits[t] !== 0);
			if (nonNeutral.length === 0) continue;
			const weights = nonNeutral.map((t) => Math.abs(h.traits[t]));
			const sum = weights.reduce((a, b) => a + b, 0);
			let acc = r() * sum;
			let chosenIdx = 0;
			for (let k = 0; k < weights.length; k++) {
				acc -= weights[k];
				if (acc <= 0) {
					chosenIdx = k;
					break;
				}
			}
			const trait = nonNeutral[chosenIdx];
			const v = h.traits[trait];
			const text = v >= 1 ? templates[trait](h.name) : antiTemplates[trait](h.name);
			events.push({ day, text });
		}
	}
	return events;
}

export default function Game047_Inheritance() {
	const [seed] = useState(() => Math.floor(Math.random() * 1e9));
	const heirs = useMemo(() => makeHeirs(seed), [seed]);
	const events = useMemo(() => makeEvents(heirs, seed * 7), [heirs, seed]);
	const [day, setDay] = useState(1);
	const [allocations, setAllocations] = useState<Record<string, string>>({});
	const [submitted, setSubmitted] = useState(false);

	const visibleEvents = events.filter((e) => e.day <= day);

	const award = (itemId: string, heirName: string) => {
		if (submitted) return;
		// Heir can't be awarded twice
		const newAlloc = { ...allocations };
		// Remove any item currently allocated to this heir
		for (const k of Object.keys(newAlloc)) {
			if (newAlloc[k] === heirName) delete newAlloc[k];
		}
		newAlloc[itemId] = heirName;
		setAllocations(newAlloc);
	};

	const score = useMemo(() => {
		if (!submitted) return 0;
		let s = 0;
		for (const item of ITEMS) {
			const heirName = allocations[item.id];
			if (!heirName) continue;
			const heir = heirs.find((h) => h.name === heirName);
			if (!heir) continue;
			s += heir.traits[item.tag] * 5;
		}
		return s;
	}, [submitted, allocations, heirs]);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#1a1813",
				color: "#e0d8c0",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				padding: 12,
				boxSizing: "border-box",
				fontFamily: "Georgia, serif",
				overflow: "auto",
			}}
		>
			<h2 style={{ margin: 4 }}>The Inheritance</h2>
			<div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
				Read events across 5 days. The will: <em>"the kind get the cottage, the wise the library, the frugal the coins, the wild the horse, the greedy the vault."</em>
			</div>
			<div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 880 }}>
				<div style={{ flex: 1.4 }}>
					<div style={{ marginBottom: 6 }}>
						{[1, 2, 3, 4, 5].map((d) => (
							<button
								key={d}
								type="button"
								onClick={() => setDay(d)}
								style={{
									background: d === day ? "#5a4a30" : "#3a2e20",
									color: "#fff",
									border: "none",
									padding: "4px 10px",
									marginRight: 4,
									borderRadius: 4,
									cursor: "pointer",
								}}
							>
								Day {d}
							</button>
						))}
					</div>
					<div
						style={{
							background: "#2a2419",
							padding: 12,
							borderRadius: 6,
							maxHeight: 360,
							overflowY: "auto",
							fontSize: 14,
							lineHeight: 1.6,
						}}
					>
						{visibleEvents.map((e, i) => (
							<div key={i}>
								<span style={{ opacity: 0.5 }}>Day {e.day}:</span> {e.text}
							</div>
						))}
					</div>
				</div>
				<div style={{ flex: 1 }}>
					<div style={{ marginBottom: 8, fontWeight: "bold" }}>Allocate items</div>
					{ITEMS.map((it) => (
						<div key={it.id} style={{ marginBottom: 8 }}>
							<div>{it.name}</div>
							<select
								value={allocations[it.id] ?? ""}
								onChange={(e) => award(it.id, e.target.value)}
								disabled={submitted}
								style={{
									width: "100%",
									padding: 4,
									background: "#2a2419",
									color: "#e0d8c0",
									border: "1px solid #5a4a30",
								}}
							>
								<option value="">— choose heir —</option>
								{HEIRS.map((h) => (
									<option key={h} value={h}>
										{h}
									</option>
								))}
							</select>
						</div>
					))}
					{!submitted ? (
						<button type="button" onClick={() => setSubmitted(true)} style={btn}>
							Read the will
						</button>
					) : (
						<div style={{ marginTop: 8 }}>
							<div style={{ fontSize: 18 }}>Score: {score}</div>
							<div style={{ fontSize: 12, marginTop: 6, opacity: 0.7 }}>
								(based on hidden trait values; max 50)
							</div>
							<div style={{ marginTop: 8, fontSize: 12 }}>
								{heirs.map((h) => {
									const dom = TRAITS.filter((t) => h.traits[t] >= 1).join(", ");
									return (
										<div key={h.name}>
											<strong>{h.name}</strong>: {dom || "ordinary"}
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#5a4a30",
	color: "#fff",
	border: "none",
	padding: "8px 14px",
	borderRadius: 6,
	cursor: "pointer",
	marginTop: 8,
	fontFamily: "Georgia, serif",
};
