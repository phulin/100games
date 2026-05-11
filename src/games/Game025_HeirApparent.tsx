import { useState } from "react";

// Five heirs, four traits each, mostly hidden. Each round an event tests one
// trait; you pick an heir to send. Their outcome reveals trait magnitude.
// After 10 rounds you crown one. Final challenge tests a secret trait; score
// is the chosen heir's value in that trait minus the best possible.

type TraitKey = "wisdom" | "valor" | "cunning" | "kindness";
const TRAIT_KEYS: TraitKey[] = ["wisdom", "valor", "cunning", "kindness"];

type Heir = {
	name: string;
	traits: Record<TraitKey, number>; // 1..10
	known: Record<TraitKey, number | null>; // revealed magnitudes
};

type Event = {
	desc: string;
	trait: TraitKey;
	outcome: (v: number) => string;
};

const NAMES = ["Aris", "Beatrice", "Cyrus", "Delia", "Elias"];

function rollHeirs(): Heir[] {
	return NAMES.map((name) => ({
		name,
		traits: {
			wisdom: 1 + Math.floor(Math.random() * 10),
			valor: 1 + Math.floor(Math.random() * 10),
			cunning: 1 + Math.floor(Math.random() * 10),
			kindness: 1 + Math.floor(Math.random() * 10),
		},
		known: { wisdom: null, valor: null, cunning: null, kindness: null },
	}));
}

const EVENTS_POOL: Event[] = [
	{
		desc: "A scholar arrives with a riddle for the court.",
		trait: "wisdom",
		outcome: (v) =>
			v >= 8 ? "answered easily." : v >= 5 ? "answered after thought." : "stumbled.",
	},
	{
		desc: "Bandits ambush a tax convoy.",
		trait: "valor",
		outcome: (v) =>
			v >= 8 ? "routed them." : v >= 5 ? "fought them off." : "fled.",
	},
	{
		desc: "A rival kingdom sends a treacherous ambassador.",
		trait: "cunning",
		outcome: (v) =>
			v >= 8 ? "outmaneuvered him." : v >= 5 ? "matched his moves." : "was duped.",
	},
	{
		desc: "A famine grips the lower villages.",
		trait: "kindness",
		outcome: (v) =>
			v >= 8 ? "moved the court to act." : v >= 5 ? "sent some aid." : "shrugged.",
	},
	{
		desc: "A philosopher debates the meaning of justice.",
		trait: "wisdom",
		outcome: (v) =>
			v >= 8 ? "spoke profoundly." : v >= 5 ? "held their own." : "lost the debate.",
	},
	{
		desc: "A tournament of arms is held.",
		trait: "valor",
		outcome: (v) =>
			v >= 8 ? "won the prize." : v >= 5 ? "reached the finals." : "was unhorsed early.",
	},
	{
		desc: "Court intrigue: a noble plots in shadow.",
		trait: "cunning",
		outcome: (v) =>
			v >= 8 ? "exposed the plot." : v >= 5 ? "sensed something." : "was oblivious.",
	},
	{
		desc: "Orphans seek shelter at the gate.",
		trait: "kindness",
		outcome: (v) =>
			v >= 8 ? "took them in personally." : v >= 5 ? "saw them fed." : "turned them away.",
	},
];

const TOTAL_ROUNDS = 10;

export default function HeirApparent() {
	const [heirs, setHeirs] = useState<Heir[]>(rollHeirs);
	const [round, setRound] = useState(0);
	const [events] = useState<Event[]>(() =>
		Array.from(
			{ length: TOTAL_ROUNDS },
			() => EVENTS_POOL[Math.floor(Math.random() * EVENTS_POOL.length)],
		),
	);
	const [log, setLog] = useState<string[]>([]);
	const [crowned, setCrowned] = useState<number | null>(null);
	const [finalTrait, setFinalTrait] = useState<TraitKey | null>(null);
	const [finalScore, setFinalScore] = useState<number | null>(null);

	const currentEvent = round < TOTAL_ROUNDS ? events[round] : null;

	const send = (i: number) => {
		if (!currentEvent || crowned !== null) return;
		const heir = heirs[i];
		const v = heir.traits[currentEvent.trait];
		const newHeirs = heirs.map((h, idx) =>
			idx === i
				? {
						...h,
						known: { ...h.known, [currentEvent.trait]: v },
					}
				: h,
		);
		setHeirs(newHeirs);
		setLog((l) => [
			`Round ${round + 1}: ${heir.name} ${currentEvent.outcome(v)} (${
				currentEvent.trait
			}: ${v}/10)`,
			...l,
		]);
		setRound(round + 1);
	};

	const crown = (i: number) => {
		if (round < TOTAL_ROUNDS || crowned !== null) return;
		const secret = TRAIT_KEYS[Math.floor(Math.random() * TRAIT_KEYS.length)];
		const best = Math.max(...heirs.map((h) => h.traits[secret]));
		const chose = heirs[i].traits[secret];
		setCrowned(i);
		setFinalTrait(secret);
		setFinalScore(chose * 10 - (best - chose) * 5);
	};

	const reset = () => {
		setHeirs(rollHeirs());
		setRound(0);
		setLog([]);
		setCrowned(null);
		setFinalTrait(null);
		setFinalScore(null);
	};

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
			}}
		>
			<h2 style={{ margin: 0 }}>Heir Apparent</h2>
			<div style={{ fontSize: 13, opacity: 0.7 }}>
				Send heirs to face events. After 10 rounds, crown one.
			</div>
			<div style={{ marginTop: 14, fontSize: 14 }}>
				Round {Math.min(round + 1, TOTAL_ROUNDS)} / {TOTAL_ROUNDS}
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
						<div style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
							{TRAIT_KEYS.map((t) => (
								<div key={t}>
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
					You crowned <b>{heirs[crowned].name}</b>. The final secret
					challenge tested <b>{finalTrait}</b> ({heirs[crowned].traits[finalTrait]}
					/10).
					<div style={{ fontSize: 18, marginTop: 4 }}>
						Final score: <b>{finalScore}</b>
					</div>
					<button
						type="button"
						onClick={reset}
						style={{
							marginTop: 8,
							padding: "6px 12px",
							background: "#5a3a72",
							color: "#fff",
							border: "none",
							borderRadius: 3,
							cursor: "pointer",
						}}
					>
						New game
					</button>
				</div>
			)}
			<div
				style={{
					marginTop: 14,
					maxHeight: 120,
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
