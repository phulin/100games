import { useMemo, useState } from "react";

// Cuneiform — decipher procedurally generated symbols with consistent grammar.

const VOCAB = [
	"king",
	"river",
	"bread",
	"sky",
	"sun",
	"moon",
	"field",
	"city",
	"hand",
	"eye",
	"water",
	"sand",
	"three",
	"many",
	"sacred",
	"gives",
	"takes",
	"crosses",
	"lights",
	"sees",
];

function rng(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0x100000000;
	};
}

function makeGlyph(_seed: number, r: () => number): string {
	// 16x16 grid wedges as SVG
	const wedges: string[] = [];
	const n = 3 + Math.floor(r() * 4);
	for (let i = 0; i < n; i++) {
		const x = 4 + Math.floor(r() * 24);
		const y = 4 + Math.floor(r() * 24);
		const rot = Math.floor(r() * 4) * 45;
		const len = 6 + Math.floor(r() * 8);
		wedges.push(
			`<g transform="translate(${x},${y}) rotate(${rot})"><polygon points="0,0 ${len},-3 ${len},3" fill="#3a2c1e"/></g>`
		);
	}
	return wedges.join("");
}

type Tablet = { words: number[]; text: string };

function makeTablet(seed: number, vocabSize: number): Tablet {
	const r = rng(seed);
	const len = 5 + Math.floor(r() * 4);
	const words: number[] = [];
	for (let i = 0; i < len; i++) words.push(Math.floor(r() * vocabSize));
	const text = words.map((i) => VOCAB[i]).join(" ");
	return { words, text };
}

export default function Game044_Cuneiform() {
	const [vocabSize] = useState(10); // first 10 words
	const [sessionSeed] = useState(() => Math.floor(Math.random() * 1e9));

	// One glyph per word (procedural, consistent across the session)
	const glyphs = useMemo(() => {
		const r = rng(sessionSeed);
		return Array.from({ length: vocabSize }, (_, i) => makeGlyph(i, r));
	}, [sessionSeed, vocabSize]);

	const [known, setKnown] = useState<Record<number, boolean>>({ 0: true }); // first revealed free
	const [tablets] = useState<Tablet[]>(() =>
		Array.from({ length: 6 }, (_, i) => makeTablet(sessionSeed * 31 + i, vocabSize))
	);
	const [active, setActive] = useState(0);
	const [guesses, setGuesses] = useState<Record<number, string>>({});
	const [solved, setSolved] = useState<boolean[]>(Array.from({ length: 6 }, () => false));
	const [score, setScore] = useState(0);

	const tablet = tablets[active];

	const reveal = (wordIdx: number) => {
		setKnown((k) => ({ ...k, [wordIdx]: true }));
	};

	const checkSolved = () => {
		const guess = (guesses[active] ?? "").trim().toLowerCase();
		const target = tablet.text.toLowerCase();
		if (guess === target) {
			if (!solved[active]) {
				setScore((s) => s + 10);
				setSolved((arr) => arr.map((v, i) => (i === active ? true : v)));
			}
		}
	};

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#d9c79b",
				color: "#2a1d10",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "Georgia, serif",
				padding: 12,
				boxSizing: "border-box",
			}}
		>
			<h2 style={{ margin: 2 }}>Cuneiform</h2>
			<div style={{ fontSize: 13, opacity: 0.75 }}>
				Decipher tablets. Use the glossary; reveal one new symbol per inference (click a glyph in the glossary to learn it).
			</div>
			<div style={{ display: "flex", gap: 14, marginTop: 10 }}>
				<div style={{ flex: 1 }}>
					<div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
						{tablets.map((_, i) => (
							<button
								key={i}
								type="button"
								onClick={() => setActive(i)}
								style={{
									background: i === active ? "#7d5a30" : "#a38456",
									color: "#fff",
									border: "none",
									padding: "4px 8px",
									borderRadius: 4,
									cursor: "pointer",
								}}
							>
								Tablet {i + 1} {solved[i] ? "✓" : ""}
							</button>
						))}
					</div>
					<div
						style={{
							background: "#b89a6a",
							border: "4px solid #8a6a3c",
							borderRadius: 12,
							padding: 18,
							minHeight: 200,
							display: "flex",
							flexWrap: "wrap",
							gap: 14,
							alignItems: "center",
						}}
					>
						{tablet.words.map((w, i) => (
							<svg key={i} width={48} height={48} viewBox="0 0 32 32">
								<rect width={32} height={32} fill="none" />
								<g dangerouslySetInnerHTML={{ __html: glyphs[w] }} />
							</svg>
						))}
					</div>
					<div style={{ marginTop: 10 }}>
						<input
							value={guesses[active] ?? ""}
							onChange={(e) => setGuesses((g) => ({ ...g, [active]: e.target.value }))}
							placeholder="Type translation (space-separated words)..."
							style={{
								width: "100%",
								padding: 8,
								borderRadius: 6,
								border: "1px solid #8a6a3c",
								background: "#f4e6c4",
								color: "#2a1d10",
								fontFamily: "Georgia, serif",
							}}
						/>
						<button type="button" onClick={checkSolved} style={btn}>
							Submit
						</button>
						{solved[active] && (
							<span style={{ marginLeft: 10, color: "#2d6" }}>
								Solved! "{tablet.text}"
							</span>
						)}
					</div>
				</div>
				<div style={{ width: 240 }}>
					<div style={{ marginBottom: 6 }}>
						<strong>Glossary</strong> · score {score}
					</div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1fr 1fr",
							gap: 6,
							background: "#c2a978",
							padding: 8,
							borderRadius: 8,
						}}
					>
						{glyphs.map((g, i) => (
							<div
								key={i}
								onClick={() => reveal(i)}
								style={{
									background: known[i] ? "#f4e6c4" : "#8a6a3c",
									color: known[i] ? "#2a1d10" : "#c2a978",
									padding: 4,
									borderRadius: 4,
									textAlign: "center",
									cursor: known[i] ? "default" : "pointer",
								}}
								title={known[i] ? VOCAB[i] : "Click to reveal"}
							>
								<svg width={36} height={36} viewBox="0 0 32 32">
									<g dangerouslySetInnerHTML={{ __html: g }} />
								</svg>
								<div style={{ fontSize: 11 }}>{known[i] ? VOCAB[i] : "??"}</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	marginLeft: 8,
	background: "#7d5a30",
	color: "#fff",
	border: "none",
	padding: "8px 14px",
	borderRadius: 6,
	cursor: "pointer",
};
