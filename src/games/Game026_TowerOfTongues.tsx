import { useMemo, useState } from "react";

// A staircase of word pairs. Each step labels the same concept in a target
// language across several related languages (cognates). Player must pick the
// correct meaning. Languages are mini "Romance" cognate sets — designed to
// teach by exposure.

type Step = { word: string; lang: string; choices: string[]; answer: number };
type Stair = { lang: string; steps: Step[] };

const STAIRS: Stair[] = [
	{
		lang: "Spanish",
		steps: [
			{ word: "agua", lang: "Spanish", choices: ["water", "fire", "wind"], answer: 0 },
			{ word: "noche", lang: "Spanish", choices: ["day", "night", "house"], answer: 1 },
			{ word: "luna", lang: "Spanish", choices: ["moon", "lake", "tree"], answer: 0 },
			{ word: "rojo", lang: "Spanish", choices: ["green", "blue", "red"], answer: 2 },
			{ word: "amigo", lang: "Spanish", choices: ["friend", "enemy", "brother"], answer: 0 },
		],
	},
	{
		lang: "Italian",
		steps: [
			{ word: "acqua", lang: "Italian", choices: ["bread", "water", "stone"], answer: 1 },
			{ word: "notte", lang: "Italian", choices: ["note", "night", "new"], answer: 1 },
			{ word: "luna", lang: "Italian", choices: ["moon", "sun", "earth"], answer: 0 },
			{ word: "rosso", lang: "Italian", choices: ["red", "rose", "roof"], answer: 0 },
			{ word: "amico", lang: "Italian", choices: ["friend", "lover", "stranger"], answer: 0 },
		],
	},
	{
		lang: "French",
		steps: [
			{ word: "eau", lang: "French", choices: ["egg", "water", "high"], answer: 1 },
			{ word: "nuit", lang: "French", choices: ["nothing", "night", "noon"], answer: 1 },
			{ word: "lune", lang: "French", choices: ["lung", "moon", "lonely"], answer: 1 },
			{ word: "rouge", lang: "French", choices: ["road", "red", "rough"], answer: 1 },
			{ word: "ami", lang: "French", choices: ["friend", "love", "soul"], answer: 0 },
		],
	},
	{
		lang: "Portuguese",
		steps: [
			{ word: "água", lang: "Portuguese", choices: ["water", "wing", "soul"], answer: 0 },
			{ word: "noite", lang: "Portuguese", choices: ["nine", "night", "north"], answer: 1 },
			{ word: "lua", lang: "Portuguese", choices: ["light", "moon", "law"], answer: 1 },
			{ word: "vermelho", lang: "Portuguese", choices: ["green", "red", "yellow"], answer: 1 },
			{ word: "amigo", lang: "Portuguese", choices: ["friend", "father", "grandfather"], answer: 0 },
		],
	},
];

export default function TowerOfTongues() {
	const stairs = useMemo(() => STAIRS, []);
	const [stairIdx, setStairIdx] = useState(0);
	const [step, setStep] = useState(0);
	const [score, setScore] = useState(0);
	const [strikes, setStrikes] = useState(0);
	const [msg, setMsg] = useState("");
	const stair = stairs[stairIdx];
	const cur = stair.steps[step];
	const done = step >= stair.steps.length;

	const pick = (i: number) => {
		if (done) return;
		if (i === cur.answer) {
			setScore((s) => s + 10);
			setStep((s) => s + 1);
			setMsg("Yes! Step up.");
		} else {
			setStrikes((x) => x + 1);
			setMsg(`Not quite. "${cur.word}" means "${cur.choices[cur.answer]}".`);
		}
	};

	const nextStair = () => {
		setStairIdx((i) => (i + 1) % stairs.length);
		setStep(0);
		setMsg("");
	};

	// Render the staircase visually.
	const totalSteps = stair.steps.length;
	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "linear-gradient(180deg,#2a1f15,#1a120a)",
				color: "#f0e6d0",
				fontFamily: "Georgia, serif",
				padding: 20,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
			}}
		>
			<h2 style={{ margin: 0 }}>Tower of Tongues</h2>
			<div style={{ fontSize: 13, opacity: 0.7 }}>
				Pick the right meaning to climb. Language: <b>{stair.lang}</b>
			</div>
			<div
				style={{
					marginTop: 16,
					position: "relative",
					width: 500,
					height: 320,
				}}
			>
				{Array.from({ length: totalSteps }).map((_, idx) => {
					const isCur = idx === step;
					const isDone = idx < step;
					const fromBottom = idx;
					return (
						<div
							key={`step-${idx}-${stair.lang}`}
							style={{
								position: "absolute",
								bottom: fromBottom * 50,
								left: 30 + fromBottom * 15,
								width: 360,
								height: 44,
								background: isCur
									? "#d4a04a"
									: isDone
										? "#5a8c3a"
										: "#3a2a1f",
								borderRadius: 4,
								border: "1px solid #6b4a2a",
								display: "flex",
								alignItems: "center",
								padding: "0 14px",
								fontSize: 18,
								color: isCur ? "#000" : "#f0e6d0",
								boxShadow: isCur ? "0 0 12px rgba(255,200,80,0.6)" : "none",
								transition: "all 0.3s",
							}}
						>
							{isDone
								? `✓ ${stair.steps[idx].word}`
								: isCur
									? stair.steps[idx].word
									: "•••"}
						</div>
					);
				})}
			</div>
			{!done && (
				<div style={{ marginTop: 20, display: "flex", gap: 10 }}>
					{cur.choices.map((c, i) => (
						<button
							type="button"
							key={c}
							onClick={() => pick(i)}
							style={{
								padding: "10px 18px",
								background: "#6b4a2a",
								color: "#fff",
								border: "1px solid #8a6a4a",
								borderRadius: 4,
								cursor: "pointer",
								fontSize: 14,
							}}
						>
							{c}
						</button>
					))}
				</div>
			)}
			{done && (
				<button
					type="button"
					onClick={nextStair}
					style={{
						marginTop: 20,
						padding: "10px 18px",
						background: "#9bcc70",
						color: "#000",
						border: "none",
						borderRadius: 4,
						cursor: "pointer",
						fontWeight: 600,
					}}
				>
					Next language →
				</button>
			)}
			<div style={{ marginTop: 14, fontStyle: "italic", minHeight: 20 }}>
				{msg}
			</div>
			<div style={{ marginTop: 6, fontSize: 13 }}>
				Score: {score} · Strikes: {strikes}
			</div>
		</div>
	);
}
