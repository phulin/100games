import { useMemo, useState } from "react";

type Puzzle = {
	words: string[];
	// punctuation slots between words (and end). For each gap index 0..words.length,
	// the target punctuation (one of "", ",", ".", "-").
	target: string[];
	prompt: string;
};

const PUZZLES: Puzzle[] = [
	{
		words: ["Let's", "eat", "grandma"],
		// "Let's eat, grandma." (3 gaps: after Let's, after eat, after grandma)
		target: ["", ",", "."],
		prompt: "Invite grandma to dinner (don't eat her).",
	},
	{
		words: ["A", "woman", "without", "her", "man", "is", "nothing"],
		target: ["", ",", "", "", ",", "", "."],
		prompt: "Pro-woman reading: without HER, man is nothing.",
	},
	{
		words: ["I", "like", "cooking", "my", "family", "and", "my", "pets"],
		target: ["", "", "", "", ",", "", "", "."],
		prompt: "List three things I like (and I'm not a cannibal).",
	},
	{
		words: ["The", "panda", "eats", "shoots", "and", "leaves"],
		target: ["", "", "", "", "", "."],
		prompt: "The panda is herbivorous (no commas).",
	},
	{
		words: ["The", "panda", "eats", "shoots", "and", "leaves"],
		target: ["", "", ",", "", "", "."],
		prompt: "The panda is a gun-toting criminal.",
	},
	{
		words: ["Time", "flies", "like", "an", "arrow", "fruit", "flies", "like", "a", "banana"],
		target: ["", "", "", "", ";", "", "", "", "", "."],
		prompt: "Two parallel observations about flies.",
	},
];

const PUNCT_OPTIONS = ["", ",", ".", ";", "-"];

export default function Game085_Punctuation() {
	const [idx, setIdx] = useState(0);
	const puzzle = PUZZLES[idx];
	const [marks, setMarks] = useState<string[]>(() =>
		new Array(puzzle.target.length).fill(""),
	);
	const [checked, setChecked] = useState(false);

	const cycle = (i: number) => {
		const m = marks.slice();
		const cur = PUNCT_OPTIONS.indexOf(m[i]);
		m[i] = PUNCT_OPTIONS[(cur + 1) % PUNCT_OPTIONS.length];
		setMarks(m);
	};

	const correct = useMemo(
		() =>
			marks.length === puzzle.target.length &&
			marks.every((m, i) => m === puzzle.target[i]),
		[marks, puzzle],
	);

	const next = () => {
		const ni = (idx + 1) % PUZZLES.length;
		setIdx(ni);
		setMarks(new Array(PUZZLES[ni].target.length).fill(""));
		setChecked(false);
	};

	const reset = () => {
		setMarks(new Array(puzzle.target.length).fill(""));
		setChecked(false);
	};

	return (
		<div
			style={{
				fontFamily: "Georgia, serif",
				color: "#222",
				background: "#f4eedb",
				padding: 24,
				minHeight: 600,
			}}
		>
			<h2 style={{ margin: 0 }}>85. Punctuation</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
				Click the slots between words to cycle punctuation. Make the sentence
				mean the target.
			</div>
			<div
				style={{
					padding: 12,
					background: "#fff7e0",
					border: "1px solid #c0a060",
					marginBottom: 16,
				}}
			>
				<strong>Target meaning:</strong> {puzzle.prompt}
			</div>
			<div
				style={{
					fontSize: 26,
					lineHeight: 1.8,
					display: "flex",
					flexWrap: "wrap",
					alignItems: "center",
				}}
			>
				{puzzle.words.map((w, i) => (
					<span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
						<span>{w}</span>
						<button
							type="button"
							onClick={() => cycle(i)}
							style={{
								width: 28,
								height: 28,
								margin: "0 2px",
								border: "1px dashed #888",
								background:
									checked && marks[i] === puzzle.target[i]
										? "#c8f0c0"
										: checked && marks[i] !== puzzle.target[i]
											? "#f0c0c0"
											: "#fff",
								cursor: "pointer",
								fontSize: 20,
							}}
						>
							{marks[i] || "·"}
						</button>
					</span>
				))}
			</div>
			<div style={{ marginTop: 16, display: "flex", gap: 8 }}>
				<button type="button" onClick={() => setChecked(true)} style={btn}>
					Check
				</button>
				<button type="button" onClick={reset} style={btn}>
					Clear
				</button>
				<button type="button" onClick={next} style={btn}>
					Next puzzle
				</button>
				{checked && (
					<div style={{ alignSelf: "center" }}>
						{correct ? "Perfectly punctuated." : "Not quite — keep adjusting."}
					</div>
				)}
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "6px 12px",
	background: "#3a2a1a",
	color: "#fff",
	border: "1px solid #5a4030",
	borderRadius: 4,
	cursor: "pointer",
	fontFamily: "Georgia, serif",
};
