import { useEffect, useMemo, useRef, useState } from "react";

// Five heirs, four traits each, mostly hidden. Each round an event tests one
// trait; you pick an heir to send. Their outcome reveals trait magnitude.
// After N rounds you crown one. The final secret challenge tests one trait;
// score reflects how close your pick was to the best possible heir.
//
// Heirs (names + traits) and event sequence are generated from a seed via
// mulberry32. Names are assembled from procedural syllable pools, events
// from compositional templates — no static heir or event list.

// ---------- seeded RNG ----------
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
function hashSeed(s: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

type TraitKey = "wisdom" | "valor" | "cunning" | "kindness";
const TRAIT_KEYS: TraitKey[] = ["wisdom", "valor", "cunning", "kindness"];

type Heir = {
	name: string;
	traits: Record<TraitKey, number>; // 1..10
	known: Record<TraitKey, number | null>; // revealed magnitudes
	sent: number; // how many times this heir was sent
};

type EventT = {
	desc: string;
	trait: TraitKey;
	outcomeOf: (v: number) => string;
};

// Procedural name generation: pick syllables from pools.
const NAME_HEADS = [
	"Ar", "Be", "Cy", "De", "El", "Fa", "Gor", "Hes",
	"Iv", "Jor", "Kel", "Lir", "Mor", "Nim", "Os", "Pae",
	"Qua", "Ral", "Sel", "Tav", "Ul", "Var", "Wen", "Xan",
	"Yor", "Zel",
];
const NAME_MIDS = ["", "an", "is", "or", "us", "el", "ia", "yn", "ar", "en", ""];
const NAME_TAILS = [
	"a", "us", "ius", "ian", "ar", "yn", "el", "is", "or",
	"ette", "essa", "anor", "iel", "ric", "wen", "yth",
];

function genName(rng: () => number): string {
	const head = NAME_HEADS[Math.floor(rng() * NAME_HEADS.length)];
	const mid = NAME_MIDS[Math.floor(rng() * NAME_MIDS.length)];
	const tail = NAME_TAILS[Math.floor(rng() * NAME_TAILS.length)];
	return head + mid + tail;
}

// Event templates: each combines a setting + a challenge that tests one
// trait. Outcome text is derived from a value tier.
const SETTINGS = [
	"A scholar arrives at the gate",
	"Bandits ambush a tax convoy",
	"A rival kingdom sends an ambassador",
	"A famine grips the lower villages",
	"A philosopher debates the meaning of justice",
	"A tournament of arms is held",
	"Court intrigue: a noble plots in shadow",
	"Orphans seek shelter at the gate",
	"A plague rumor spreads through the markets",
	"A traveling merchant offers a strange gift",
	"A heretic preaches in the public square",
	"A border lord refuses to pay tribute",
	"A peasant uprising threatens the granary",
	"A foreign prince comes courting",
	"A long-lost cousin claims an inheritance",
	"The royal hawk goes missing",
];

const VERBS_BY_TRAIT: Record<TraitKey, [string, string, string]> = {
	// [high, mid, low] outcome verbs
	wisdom: ["spoke profoundly", "held their own", "stumbled badly"],
	valor: ["routed the foe", "fought them off", "fled in panic"],
	cunning: ["outmaneuvered them", "matched their moves", "was outwitted"],
	kindness: [
		"moved the court to act",
		"sent modest aid",
		"shrugged and turned away",
	],
};

function buildEvent(rng: () => number): EventT {
	const setting = SETTINGS[Math.floor(rng() * SETTINGS.length)];
	const trait = TRAIT_KEYS[Math.floor(rng() * TRAIT_KEYS.length)];
	const verbs = VERBS_BY_TRAIT[trait];
	return {
		desc: setting + ".",
		trait,
		outcomeOf: (v) => (v >= 8 ? verbs[0] : v >= 5 ? verbs[1] : verbs[2]) + ".",
	};
}

function rollHeirs(rng: () => number, count: number): Heir[] {
	const used = new Set<string>();
	const out: Heir[] = [];
	while (out.length < count) {
		const name = genName(rng);
		if (used.has(name)) continue;
		used.add(name);
		out.push({
			name,
			traits: {
				wisdom: 1 + Math.floor(rng() * 10),
				valor: 1 + Math.floor(rng() * 10),
				cunning: 1 + Math.floor(rng() * 10),
				kindness: 1 + Math.floor(rng() * 10),
			},
			known: { wisdom: null, valor: null, cunning: null, kindness: null },
			sent: 0,
		});
	}
	return out;
}

function todayUTC(): string {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}
function dailySeed(): number {
	return hashSeed("heirapparent-daily:" + todayUTC());
}

const TOTAL_ROUNDS = 10;
const HEIR_COUNT = 5;

export default function HeirApparent() {
	const [mode, setMode] = useState<"daily" | "free">("free");
	const [seed, setSeed] = useState<number>(() => (Math.random() * 1e9) >>> 0);

	const { heirs0, events } = useMemo(() => {
		const rng = mulberry32(seed);
		const h = rollHeirs(rng, HEIR_COUNT);
		const e: EventT[] = [];
		for (let i = 0; i < TOTAL_ROUNDS; i++) e.push(buildEvent(rng));
		return { heirs0: h, events: e };
	}, [seed]);

	const [heirs, setHeirs] = useState<Heir[]>(heirs0);
	const [round, setRound] = useState(0);
	const [log, setLog] = useState<string[]>([]);
	const [crowned, setCrowned] = useState<number | null>(null);
	const [finalTrait, setFinalTrait] = useState<TraitKey | null>(null);
	const [finalScore, setFinalScore] = useState<number | null>(null);
	const [bestPerSeed, setBestPerSeed] = useState<Record<string, number>>(() => {
		try {
			return JSON.parse(localStorage.getItem("heir_best") || "{}");
		} catch {
			return {};
		}
	});

	// reset state when seed changes
	useEffect(() => {
		setHeirs(heirs0);
		setRound(0);
		setLog([]);
		setCrowned(null);
		setFinalTrait(null);
		setFinalScore(null);
	}, [heirs0]);

	// --- audio ---
	const audioRef = useRef<AudioContext | null>(null);
	const ensureAudio = () => {
		if (audioRef.current) return audioRef.current;
		const Ctor =
			(window as unknown as { AudioContext: typeof AudioContext })
				.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext;
		audioRef.current = new Ctor();
		return audioRef.current;
	};
	useEffect(
		() => () => {
			audioRef.current?.close();
		},
		[],
	);
	const beep = (
		freq: number,
		dur = 0.1,
		type: OscillatorType = "sine",
		vol = 0.12,
	) => {
		const ctx = audioRef.current;
		if (!ctx) return;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = type;
		osc.frequency.value = freq;
		g.gain.value = vol;
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
		osc.connect(g);
		g.connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + dur);
	};
	const fanfare = () => {
		const notes = [392, 494, 587, 784];
		notes.forEach((n, i) =>
			setTimeout(() => beep(n, 0.18, "triangle", 0.16), i * 120),
		);
	};

	const currentEvent = round < TOTAL_ROUNDS ? events[round] : null;

	const send = (i: number) => {
		ensureAudio();
		if (!currentEvent || crowned !== null) return;
		const heir = heirs[i];
		const v = heir.traits[currentEvent.trait];
		const newHeirs = heirs.map((h, idx) =>
			idx === i
				? {
						...h,
						known: { ...h.known, [currentEvent.trait]: v },
						sent: h.sent + 1,
					}
				: h,
		);
		setHeirs(newHeirs);
		setLog((l) => [
			`Round ${round + 1}: ${heir.name} ${currentEvent.outcomeOf(v)} (${
				currentEvent.trait
			}: ${v}/10)`,
			...l,
		]);
		setRound(round + 1);
		// pitch correlates with revealed strength
		beep(220 + v * 40, 0.18, v >= 8 ? "triangle" : v >= 5 ? "sine" : "sawtooth");
	};

	const crown = (i: number) => {
		ensureAudio();
		if (round < TOTAL_ROUNDS || crowned !== null) return;
		// The final secret trait is also seeded — but it depends on the round
		// stream, so it's deterministic per seed.
		const rng = mulberry32(seed ^ 0xdeadbeef);
		const secret = TRAIT_KEYS[Math.floor(rng() * TRAIT_KEYS.length)];
		const best = Math.max(...heirs.map((h) => h.traits[secret]));
		const chose = heirs[i].traits[secret];
		setCrowned(i);
		setFinalTrait(secret);
		const score = chose * 10 - (best - chose) * 5;
		setFinalScore(score);
		fanfare();
		// remember best per seed
		const key = String(seed);
		if ((bestPerSeed[key] ?? -Infinity) < score) {
			const m = { ...bestPerSeed, [key]: score };
			setBestPerSeed(m);
			try {
				localStorage.setItem("heir_best", JSON.stringify(m));
			} catch {
				/* ignore */
			}
		}
	};

	const reset = () => {
		setSeed(mode === "daily" ? dailySeed() : (Math.random() * 1e9) >>> 0);
	};

	const switchMode = (m: "daily" | "free") => {
		setMode(m);
		setSeed(m === "daily" ? dailySeed() : (Math.random() * 1e9) >>> 0);
	};

	const bestForSeed = bestPerSeed[String(seed)];

	// Preview of upcoming event traits — show how many of each trait remain
	// in the deck so the player can plan tests strategically.
	const remainingByTrait: Record<TraitKey, number> = {
		wisdom: 0,
		valor: 0,
		cunning: 0,
		kindness: 0,
	};
	for (let i = round; i < events.length; i++) remainingByTrait[events[i].trait]++;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "linear-gradient(180deg,#2c1d33,#13091a)",
				color: "#e6d6f0",
				fontFamily: "Georgia, serif",
				padding: 20,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				overflow: "auto",
			}}
		>
			<h2 style={{ margin: 0 }}>Heir Apparent</h2>
			<div style={{ fontSize: 13, opacity: 0.7 }}>
				Send heirs to face events. After {TOTAL_ROUNDS} rounds, crown one.
			</div>
			<div
				style={{
					display: "flex",
					gap: 6,
					marginTop: 6,
					fontSize: 12,
					flexWrap: "wrap",
					justifyContent: "center",
				}}
			>
				<button
					type="button"
					onClick={() => switchMode("free")}
					style={modeBtn(mode === "free")}
				>
					Free
				</button>
				<button
					type="button"
					onClick={() => switchMode("daily")}
					style={modeBtn(mode === "daily")}
				>
					Daily ({todayUTC()})
				</button>
				<button type="button" onClick={reset} style={modeBtn(false)}>
					New game
				</button>
				<span style={{ alignSelf: "center", opacity: 0.7 }}>
					seed: <code>{seed.toString(36)}</code>
					{bestForSeed !== undefined && ` · best: ${bestForSeed}`}
				</span>
			</div>
			<div style={{ marginTop: 14, fontSize: 14 }}>
				Round {Math.min(round + 1, TOTAL_ROUNDS)} / {TOTAL_ROUNDS}
			</div>
			<div style={{ marginTop: 4, fontSize: 11, opacity: 0.75 }}>
				Remaining: w {remainingByTrait.wisdom} · v {remainingByTrait.valor} · c{" "}
				{remainingByTrait.cunning} · k {remainingByTrait.kindness}
			</div>
			{currentEvent && (
				<div
					style={{
						marginTop: 10,
						padding: 12,
						background: "rgba(255,255,255,0.05)",
						border: "1px solid rgba(255,255,255,0.1)",
						borderRadius: 6,
						maxWidth: 600,
						fontStyle: "italic",
					}}
				>
					{currentEvent.desc}
					<div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>
						Tests: {currentEvent.trait}
					</div>
				</div>
			)}
			<div
				style={{
					marginTop: 16,
					display: "grid",
					gridTemplateColumns: "repeat(5, 1fr)",
					gap: 10,
					width: "100%",
					maxWidth: 800,
				}}
			>
				{heirs.map((h, i) => (
					<div
						key={h.name}
						style={{
							padding: 10,
							background:
								crowned === i ? "rgba(255,210,80,0.2)" : "rgba(0,0,0,0.3)",
							border:
								crowned === i ? "2px solid #ffd250" : "1px solid #4a3b56",
							borderRadius: 6,
							textAlign: "center",
						}}
					>
						<div style={{ fontWeight: 600 }}>{h.name}</div>
						<div style={{ fontSize: 10, opacity: 0.55, marginTop: 1 }}>
							sent {h.sent}×
						</div>
						<div style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
							{TRAIT_KEYS.map((t) => (
								<div
									key={t}
									style={{
										color:
											currentEvent && currentEvent.trait === t
												? "#ffd28c"
												: undefined,
										fontWeight:
											currentEvent && currentEvent.trait === t ? 600 : 400,
									}}
								>
									{t}: {h.known[t] !== null ? h.known[t] : "?"}
								</div>
							))}
						</div>
						{round < TOTAL_ROUNDS ? (
							<button
								type="button"
								onClick={() => send(i)}
								style={{
									marginTop: 8,
									padding: "4px 8px",
									background: "#5a3a72",
									color: "#fff",
									border: "none",
									borderRadius: 3,
									cursor: "pointer",
									fontSize: 12,
								}}
							>
								Send
							</button>
						) : crowned === null ? (
							<button
								type="button"
								onClick={() => crown(i)}
								style={{
									marginTop: 8,
									padding: "4px 8px",
									background: "#ffd250",
									color: "#000",
									border: "none",
									borderRadius: 3,
									cursor: "pointer",
									fontSize: 12,
									fontWeight: 600,
								}}
							>
								Crown
							</button>
						) : null}
					</div>
				))}
			</div>
			{crowned !== null && finalTrait !== null && (
				<div
					style={{
						marginTop: 16,
						padding: 12,
						background: "rgba(255,210,80,0.1)",
						border: "1px solid #ffd250",
						borderRadius: 6,
						textAlign: "center",
					}}
				>
					You crowned <b>{heirs[crowned].name}</b>. The final secret challenge
					tested <b>{finalTrait}</b> ({heirs[crowned].traits[finalTrait]}/10).
					<div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
						Best possible heir for {finalTrait}:{" "}
						{Math.max(...heirs.map((h) => h.traits[finalTrait]))}/10.
					</div>
					<div style={{ fontSize: 18, marginTop: 4 }}>
						Final score: <b>{finalScore}</b>
					</div>
				</div>
			)}
			<div
				style={{
					marginTop: 14,
					maxHeight: 140,
					overflowY: "auto",
					width: "100%",
					maxWidth: 600,
					fontSize: 12,
					opacity: 0.8,
				}}
			>
				{log.map((line) => (
					<div key={line}>{line}</div>
				))}
			</div>
		</div>
	);
}

function modeBtn(active: boolean): React.CSSProperties {
	return {
		padding: "4px 10px",
		background: active ? "#ffd250" : "#3a2640",
		color: active ? "#000" : "#fff",
		border: "1px solid #5a3a72",
		borderRadius: 3,
		cursor: "pointer",
		fontSize: 12,
	};
}
