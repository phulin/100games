import { useState } from "react";

// Game 79 — The Translator
// A poem in a fictional language. Glossary gives synonym options.
// Reorder & pick synonyms to produce English that scans and rhymes.

type Word = { foreign: string; synonyms: string[]; chosen: number };

type Puzzle = {
	title: string;
	gloss: Array<{ foreign: string; meanings: string[] }>;
	lines: string[][]; // foreign words per line
	target: { rhymeScheme: string; meterHint: string; example: string };
};

const PUZZLES: Puzzle[] = [
	{
		title: "Verse of Stones",
		gloss: [
			{ foreign: "kel", meanings: ["stone", "rock", "boulder"] },
			{ foreign: "tor", meanings: ["sleeps", "rests", "lies"] },
			{ foreign: "moa", meanings: ["water", "river", "stream"] },
			{ foreign: "rin", meanings: ["bright", "shining", "clear"] },
			{ foreign: "shi", meanings: ["beside", "near", "by"] },
			{ foreign: "ka", meanings: ["the"] },
			{ foreign: "lu", meanings: ["a", "one"] },
		],
		lines: [
			["lu", "kel", "tor", "shi", "ka", "moa", "rin"],
			["ka", "moa", "rin", "tor", "shi", "lu", "kel"],
		],
		target: {
			rhymeScheme: "AA",
			meterHint: "Roughly iambic; both lines end on a 1-syllable noun.",
			example: "A stone rests by the river clear / The river clear rests by a stone (etc.)",
		},
	},
	{
		title: "Song of Wings",
		gloss: [
			{ foreign: "vel", meanings: ["bird", "swallow", "wing"] },
			{ foreign: "soa", meanings: ["flies", "soars", "wheels"] },
			{ foreign: "nu", meanings: ["sky", "heaven", "blue"] },
			{ foreign: "dra", meanings: ["high", "far", "above"] },
			{ foreign: "fei", meanings: ["sings", "calls", "cries"] },
			{ foreign: "ma", meanings: ["song", "tune", "cry"] },
			{ foreign: "ka", meanings: ["the"] },
		],
		lines: [
			["ka", "vel", "soa", "dra", "nu"],
			["ka", "vel", "fei", "ka", "ma"],
		],
		target: {
			rhymeScheme: "AA",
			meterHint: "Each line 5 syllables.",
			example: "The swallow soars high blue / The swallow sings the tune",
		},
	},
];

export default function Game079_TheTranslator() {
	const [puzzleIdx, setPuzzleIdx] = useState(0);
	const puzzle = PUZZLES[puzzleIdx];

	// each line is an ordered list of word slots; user can reorder and pick synonyms
	const [lines, setLines] = useState<Word[][]>(() =>
		puzzle.lines.map((line) =>
			line.map((f) => {
				const g = puzzle.gloss.find((x) => x.foreign === f)!;
				return { foreign: f, synonyms: g.meanings, chosen: 0 };
			})
		)
	);
	const [score, setScore] = useState<number | null>(null);

	const setSyn = (li: number, wi: number, ci: number) => {
		setLines((ls) =>
			ls.map((line, i) =>
				i === li ? line.map((w, j) => (j === wi ? { ...w, chosen: ci } : w)) : line
			)
		);
	};

	const move = (li: number, wi: number, dir: -1 | 1) => {
		setLines((ls) =>
			ls.map((line, i) => {
				if (i !== li) return line;
				const j = wi + dir;
				if (j < 0 || j >= line.length) return line;
				const cp = [...line];
				[cp[wi], cp[j]] = [cp[j], cp[wi]];
				return cp;
			})
		);
	};

	const englishLines = lines.map((line) => line.map((w) => w.synonyms[w.chosen]).join(" "));

	const evaluate = () => {
		// crude: reward rhyme (last syllable match) and length similarity
		const a = englishLines[0];
		const b = englishLines[englishLines.length - 1];
		const lastA = a.split(" ").pop()!.toLowerCase();
		const lastB = b.split(" ").pop()!.toLowerCase();
		const rhyme = lastA.slice(-2) === lastB.slice(-2) && lastA !== lastB ? 50 : lastA === lastB ? 20 : 0;
		const meter =
			englishLines.every((l) => Math.abs(l.split(" ").length - englishLines[0].split(" ").length) < 2)
				? 30
				: 10;
		// reward variety in word choices
		const variety = lines.reduce(
			(s, l) => s + l.filter((w) => w.chosen !== 0).length * 2,
			0
		);
		setScore(rhyme + meter + Math.min(20, variety));
	};

	const next = () => {
		const ni = (puzzleIdx + 1) % PUZZLES.length;
		setPuzzleIdx(ni);
		setLines(
			PUZZLES[ni].lines.map((line) =>
				line.map((f) => {
					const g = PUZZLES[ni].gloss.find((x) => x.foreign === f)!;
					return { foreign: f, synonyms: g.meanings, chosen: 0 };
				})
			)
		);
		setScore(null);
	};

	return (
		<div
			style={{
				width: 900,
				height: 600,
				background: "linear-gradient(180deg,#1a1828,#312846)",
				color: "#e7e3d4",
				fontFamily: "Georgia, serif",
				padding: 18,
				boxSizing: "border-box",
				overflowY: "auto",
			}}
		>
			<h2 style={{ margin: 0 }}>The Translator</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Translate "{puzzle.title}". Reorder words with arrows; click a word to cycle synonyms.
			</div>

			<div style={{ marginTop: 14, padding: 10, background: "#0006", borderRadius: 6 }}>
				<div style={{ fontStyle: "italic", opacity: 0.8 }}>Original:</div>
				{puzzle.lines.map((l, i) => (
					<div key={i} style={{ fontSize: 18, fontVariant: "small-caps" }}>
						{l.join(" ")}
					</div>
				))}
				<div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
					Hint: {puzzle.target.meterHint} Scheme: {puzzle.target.rhymeScheme}.
				</div>
			</div>

			<div style={{ marginTop: 14 }}>
				<div style={{ fontStyle: "italic", opacity: 0.8 }}>Your translation:</div>
				{lines.map((line, li) => (
					<div key={li} style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
						{line.map((w, wi) => (
							<div
								key={wi}
								style={{
									background: "#403254",
									padding: "4px 8px",
									borderRadius: 4,
									cursor: "pointer",
									display: "inline-flex",
									alignItems: "center",
									gap: 4,
								}}
								onClick={() =>
									setSyn(li, wi, (w.chosen + 1) % w.synonyms.length)
								}
								title={`(${w.foreign}) — click to cycle synonyms`}
							>
								<span style={{ fontSize: 16 }}>{w.synonyms[w.chosen]}</span>
								<button
									onClick={(e) => {
										e.stopPropagation();
										move(li, wi, -1);
									}}
									style={mini}
								>
									◀
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										move(li, wi, 1);
									}}
									style={mini}
								>
									▶
								</button>
							</div>
						))}
					</div>
				))}
				<div style={{ marginTop: 12, fontSize: 18, lineHeight: 1.4 }}>
					{englishLines.map((l, i) => (
						<div key={i}>{l}</div>
					))}
				</div>
			</div>

			<div style={{ marginTop: 14, display: "flex", gap: 8 }}>
				<button onClick={evaluate} style={btn}>
					Score my translation
				</button>
				<button onClick={next} style={btn}>
					Next poem
				</button>
			</div>
			{score !== null && (
				<div style={{ fontSize: 20, marginTop: 12 }}>
					Score: <b>{score}/100</b>
				</div>
			)}
		</div>
	);
}

const btn: React.CSSProperties = { padding: "6px 14px", fontSize: 14, cursor: "pointer" };
const mini: React.CSSProperties = {
	background: "#222",
	color: "#fff",
	border: "none",
	fontSize: 10,
	padding: "2px 4px",
	cursor: "pointer",
};
