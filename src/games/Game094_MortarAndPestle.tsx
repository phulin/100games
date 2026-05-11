import { useEffect, useMemo, useState } from "react";

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function hashStr(s: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
function todayKey(): string {
	const d = new Date();
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

type Ing = { id: string; name: string; emoji: string };

const EMOJI_POOL = [
	"🌹",
	"🧂",
	"⚫",
	"🍋",
	"🧄",
	"🫚",
	"🌿",
	"🍯",
	"🫐",
	"🌶",
	"🌰",
	"🍃",
];
const SYL1 = [
	"thra",
	"vel",
	"myr",
	"qua",
	"san",
	"lor",
	"fen",
	"ka",
	"is",
	"ul",
];
const SYL2 = [
	"dra",
	"lim",
	"vor",
	"mun",
	"tas",
	"ren",
	"fil",
	"ax",
	"or",
	"el",
];

const PRODUCT_ADJ = [
	"Bright",
	"Bitter",
	"Warming",
	"Floral",
	"Smoked",
	"Golden",
	"Mossy",
	"Burning",
	"Velvet",
	"Hollow",
	"Crystal",
	"Twilight",
];
const PRODUCT_NOUN = [
	"tincture",
	"dust",
	"paste",
	"sachet",
	"brine",
	"balm",
	"oil",
	"powder",
	"essence",
	"tonic",
];

function pick<T>(rng: () => number, a: T[]): T {
	return a[Math.floor(rng() * a.length)];
}

function generateIngredients(rng: () => number, count: number): Ing[] {
	const out: Ing[] = [];
	const used = new Set<string>();
	for (let i = 0; i < count; i++) {
		let name = "";
		let id = "";
		let tries = 0;
		do {
			name = pick(rng, SYL1) + pick(rng, SYL2);
			name = name[0].toUpperCase() + name.slice(1);
			id = name.toLowerCase();
			tries++;
		} while (used.has(id) && tries < 20);
		used.add(id);
		out.push({ id, name, emoji: EMOJI_POOL[i % EMOJI_POOL.length] });
	}
	return out;
}

type ReactionTable = Record<string, string>;

function generateReactions(rng: () => number, ings: Ing[]): ReactionTable {
	const table: ReactionTable = {};
	const pairs: [string, string][] = [];
	for (let i = 0; i < ings.length; i++)
		for (let j = i + 1; j < ings.length; j++)
			pairs.push([ings[i].id, ings[j].id]);
	const usedProducts = new Set<string>();
	for (const [a, b] of pairs) {
		if (rng() < 0.3) continue;
		let product = "";
		let tries = 0;
		do {
			product = `${pick(rng, PRODUCT_ADJ)} ${pick(rng, PRODUCT_NOUN)}`;
			tries++;
		} while (usedProducts.has(product) && tries < 20);
		usedProducts.add(product);
		const k = [a, b].sort().join("+");
		table[k] = product;
	}
	return table;
}

function tripleKey(prod: string, ingId: string): string {
	return `${prod}|${ingId}`;
}
function generateCompounds(
	rng: () => number,
	ings: Ing[],
	reactions: ReactionTable,
): Record<string, string> {
	const out: Record<string, string> = {};
	const products = Object.values(reactions);
	const usedNames = new Set<string>(products);
	for (const p of products) {
		for (const ing of ings) {
			if (rng() < 0.6) continue;
			let name = "";
			let tries = 0;
			do {
				name = `${pick(rng, PRODUCT_ADJ)} ${pick(rng, PRODUCT_NOUN)}`;
				tries++;
			} while (usedNames.has(name) && tries < 20);
			usedNames.add(name);
			out[tripleKey(p, ing.id)] = name;
		}
	}
	return out;
}

let _ac: AudioContext | null = null;
function ac(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!_ac) {
		try {
			_ac = new (window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext)();
		} catch {
			return null;
		}
	}
	return _ac;
}
function grindSound() {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const dur = 0.5;
	const n = Math.floor(c.sampleRate * dur);
	const b = c.createBuffer(1, n, c.sampleRate);
	const d = b.getChannelData(0);
	for (let i = 0; i < n; i++) {
		const env = Math.sin((Math.PI * i) / n);
		d[i] = (Math.random() * 2 - 1) * env;
	}
	const src = c.createBufferSource();
	src.buffer = b;
	const f = c.createBiquadFilter();
	f.type = "lowpass";
	f.frequency.value = 600;
	const g = c.createGain();
	g.gain.value = 0.4;
	src.connect(f).connect(g).connect(c.destination);
	src.start(t);
	src.stop(t + dur + 0.05);
}
function ding(freq: number) {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const o = c.createOscillator();
	const g = c.createGain();
	o.type = "sine";
	o.frequency.value = freq;
	g.gain.setValueAtTime(0.001, t);
	g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
	o.connect(g).connect(c.destination);
	o.start(t);
	o.stop(t + 0.65);
}
function muddy() {
	const c = ac();
	if (!c) return;
	const t = c.currentTime;
	const o = c.createOscillator();
	const g = c.createGain();
	o.type = "sawtooth";
	o.frequency.value = 90;
	g.gain.setValueAtTime(0.001, t);
	g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
	g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
	o.connect(g).connect(c.destination);
	o.start(t);
	o.stop(t + 0.32);
}

type BowlItem =
	| { kind: "ing"; id: string }
	| { kind: "prod"; name: string };

export default function Game094_MortarAndPestle() {
	const [seedInput, setSeedInput] = useState<string>(() => todayKey());
	const [ingCount, setIngCount] = useState(6);
	const seed = useMemo(
		() => hashStr(`${seedInput}|I${ingCount}`),
		[seedInput, ingCount],
	);
	const { ings, reactions, compounds } = useMemo(() => {
		const rng = mulberry32(seed);
		const ings = generateIngredients(rng, ingCount);
		const reactions = generateReactions(rng, ings);
		const compounds = generateCompounds(rng, ings, reactions);
		return { ings, reactions, compounds };
	}, [seed, ingCount]);

	const ingMap = useMemo(
		() => Object.fromEntries(ings.map((i) => [i.id, i])),
		[ings],
	);
	const productList = useMemo(() => Object.values(reactions), [reactions]);

	const [target, setTarget] = useState<string>("");
	useEffect(() => {
		const rng = mulberry32(seed ^ 0x9e3779b9);
		setTarget(productList.length ? pick(rng, productList) : "");
	}, [seed, productList]);

	const [bowl, setBowl] = useState<BowlItem[]>([]);
	const [discovered, setDiscovered] = useState<Record<string, string>>({});
	const [discoveredTriples, setDiscoveredTriples] = useState<
		Record<string, string>
	>({});
	const [message, setMessage] = useState<string>(
		"Add two items (ingredient or product) and grind.",
	);
	const [score, setScore] = useState(0);

	useEffect(() => {
		try {
			const raw = localStorage.getItem(`mp_nb_${seed}`);
			if (raw) {
				const parsed = JSON.parse(raw);
				setDiscovered(parsed.pairs || {});
				setDiscoveredTriples(parsed.triples || {});
			} else {
				setDiscovered({});
				setDiscoveredTriples({});
			}
		} catch {
			setDiscovered({});
			setDiscoveredTriples({});
		}
		setBowl([]);
		setScore(0);
	}, [seed]);

	function saveNotebook(
		pairs: Record<string, string>,
		triples: Record<string, string>,
	) {
		try {
			localStorage.setItem(
				`mp_nb_${seed}`,
				JSON.stringify({ pairs, triples }),
			);
		} catch {}
	}

	function addIngredient(id: string) {
		if (bowl.length >= 2) return;
		setBowl([...bowl, { kind: "ing", id }]);
		setMessage("");
	}
	function addProduct(name: string) {
		if (bowl.length >= 2) return;
		setBowl([...bowl, { kind: "prod", name }]);
		setMessage("");
	}

	function grind() {
		if (bowl.length !== 2) {
			setMessage("Need two items.");
			return;
		}
		grindSound();
		const [a, b] = bowl;
		if (a.kind === "ing" && b.kind === "ing") {
			const k = [a.id, b.id].sort().join("+");
			const result = reactions[k];
			if (result) {
				const nd = { ...discovered, [k]: result };
				setDiscovered(nd);
				saveNotebook(nd, discoveredTriples);
				if (result === target) {
					ding(880);
					setScore((s) => s + 10);
					const rng = mulberry32(seed + Object.keys(nd).length);
					setTarget(pick(rng, productList));
					setMessage(`Produced ${result}! New target.`);
				} else {
					ding(660);
					setMessage(`Produced: ${result}`);
				}
			} else {
				muddy();
				setMessage("A muddy mess. Nothing useful.");
			}
		} else if (
			(a.kind === "prod" && b.kind === "ing") ||
			(a.kind === "ing" && b.kind === "prod")
		) {
			const prod = a.kind === "prod" ? a.name : (b as { name: string }).name;
			const ing = a.kind === "ing" ? a.id : (b as { id: string }).id;
			const k = tripleKey(prod, ing);
			const result = compounds[k];
			if (result) {
				const nd = { ...discoveredTriples, [k]: result };
				setDiscoveredTriples(nd);
				saveNotebook(discovered, nd);
				if (result === target) {
					ding(1100);
					setScore((s) => s + 25);
					const rng = mulberry32(seed + Object.keys(nd).length + 13);
					setTarget(pick(rng, productList));
					setMessage(`Compounded ${result}! New target.`);
				} else {
					ding(880);
					setMessage(`Compounded: ${result}`);
				}
			} else {
				muddy();
				setMessage("The mixture refuses to bind.");
			}
		} else {
			muddy();
			setMessage("Two products won't combine.");
		}
		setBowl([]);
	}

	function clearBowl() {
		setBowl([]);
		setMessage("");
	}

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
			<p style={{ margin: "0 0 10px", fontSize: 13, opacity: 0.7 }}>
				Combine herbs to discover products, then combine products with a third
				ingredient for compounds. Match today's target.
			</p>
			<div
				style={{
					display: "flex",
					gap: 10,
					alignItems: "center",
					marginBottom: 10,
					fontSize: 12,
				}}
			>
				<label>
					Seed:{" "}
					<input
						value={seedInput}
						onChange={(e) => setSeedInput(e.target.value)}
						style={{ width: 120 }}
					/>
				</label>
				<button onClick={() => setSeedInput(todayKey())}>Daily</button>
				<button
					onClick={() => setSeedInput(`r${Math.floor(Math.random() * 1e9)}`)}
				>
					New apothecary
				</button>
				<label>
					Shelf size{" "}
					<select
						value={ingCount}
						onChange={(e) => setIngCount(parseInt(e.target.value, 10))}
					>
						<option value={4}>4</option>
						<option value={6}>6</option>
						<option value={8}>8</option>
					</select>
				</label>
			</div>

			<div style={{ display: "flex", gap: 24 }}>
				<div style={{ flex: 1 }}>
					<div style={{ marginBottom: 8 }}>
						<strong>Target:</strong> {target || "(none)"} &nbsp; | &nbsp;{" "}
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
							fontSize: 28,
						}}
					>
						{bowl.length === 0 ? (
							<span style={{ fontSize: 14, opacity: 0.6 }}>(empty mortar)</span>
						) : (
							<div style={{ display: "flex", gap: 12 }}>
								{bowl.map((b, i) => (
									<span
										key={i}
										style={{
											fontSize: b.kind === "ing" ? 36 : 14,
											background:
												b.kind === "prod" ? "#fff8e1" : "transparent",
											padding: b.kind === "prod" ? "4px 8px" : 0,
											borderRadius: 4,
										}}
									>
										{b.kind === "ing" ? ingMap[b.id]?.emoji : `🧪 ${b.name}`}
									</span>
								))}
							</div>
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
							{ings.map((ing) => (
								<button
									key={ing.id}
									onClick={() => addIngredient(ing.id)}
									disabled={bowl.length >= 2}
									style={{ padding: "8px 10px", fontSize: 18 }}
								>
									{ing.emoji}{" "}
									<span style={{ fontSize: 11 }}>{ing.name}</span>
								</button>
							))}
						</div>
					</div>

					{Object.keys(discovered).length > 0 && (
						<div style={{ marginTop: 14 }}>
							<strong>Discovered products (click to add)</strong>
							<div
								style={{
									display: "flex",
									flexWrap: "wrap",
									gap: 6,
									marginTop: 6,
								}}
							>
								{Array.from(new Set(Object.values(discovered))).map((p) => (
									<button
										key={p}
										onClick={() => addProduct(p)}
										disabled={bowl.length >= 2}
										style={{ padding: "6px 8px", fontSize: 12 }}
									>
										🧪 {p}
									</button>
								))}
							</div>
						</div>
					)}
				</div>

				<div
					style={{
						width: 280,
						background: "#fff8e1",
						border: "1px solid #c2a464",
						padding: 10,
						borderRadius: 4,
						maxHeight: 520,
						overflowY: "auto",
					}}
				>
					<strong>Notebook</strong>
					<div style={{ fontSize: 12, marginTop: 6 }}>
						{Object.keys(discovered).length === 0 &&
							Object.keys(discoveredTriples).length === 0 && (
								<em>No recipes yet.</em>
							)}
						{Object.entries(discovered).map(([k, v]) => {
							const [a, b] = k.split("+");
							return (
								<div key={k} style={{ marginBottom: 4 }}>
									{ingMap[a]?.emoji}+{ingMap[b]?.emoji} →{" "}
									<strong>{v}</strong>
								</div>
							);
						})}
						{Object.entries(discoveredTriples).map(([k, v]) => {
							const [prod, ingId] = k.split("|");
							return (
								<div key={k} style={{ marginBottom: 4 }}>
									{prod}+{ingMap[ingId]?.emoji} → <strong>{v}</strong>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
}
