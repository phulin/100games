import { useMemo, useState } from "react";

// Tarot-like cards drawn into a 5-card spread. Player writes a short fortune.
// Past fortunes (mocked from a seeded archive) are presented for the player to vote on.

const CARDS = [
	{ name: "The Tower", glyph: "T", themes: ["sudden change", "collapse", "revelation"] },
	{ name: "The Star", glyph: "S", themes: ["hope", "guidance", "clarity"] },
	{ name: "The Moon", glyph: "M", themes: ["illusion", "dream", "uncertainty"] },
	{ name: "The Sun", glyph: "S+", themes: ["joy", "warmth", "success"] },
	{ name: "The Fool", glyph: "F", themes: ["beginnings", "risk", "innocence"] },
	{ name: "The Magician", glyph: "MG", themes: ["will", "skill", "creation"] },
	{ name: "The Hermit", glyph: "H", themes: ["solitude", "reflection", "wisdom"] },
	{ name: "The Lovers", glyph: "L", themes: ["choice", "union", "duality"] },
	{ name: "Death", glyph: "D", themes: ["ending", "transformation", "release"] },
	{ name: "Justice", glyph: "J", themes: ["balance", "truth", "consequence"] },
	{ name: "The World", glyph: "W", themes: ["completion", "wholeness", "travel"] },
	{ name: "Wheel", glyph: "Wh", themes: ["fortune", "cycles", "fate"] },
];

const POSITIONS = ["Past", "Present", "Hidden", "Advice", "Outcome"];

function pickSpread(seed: number) {
	let s = seed;
	const r = () => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
	const indices: number[] = [];
	while (indices.length < 5) {
		const i = Math.floor(r() * CARDS.length);
		if (!indices.includes(i)) indices.push(i);
	}
	return indices.map((i) => CARDS[i]);
}

const ARCHIVE_TEMPLATES = [
	"A door closes; another opens in moonlight.",
	"Trust the voice you nearly silenced.",
	"What you carried in shadow becomes a lantern.",
	"The journey ends where it secretly began.",
	"Stop building; the garden is already grown.",
	"A small kindness will return as a tide.",
	"Listen to the absence between answers.",
];

export default function TheCartomancer() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 9999));
	const spread = useMemo(() => pickSpread(seed), [seed]);
	const [fortune, setFortune] = useState("");
	const [archive, setArchive] = useState<{ text: string; mine: boolean; votes: number }[]>([]);
	const [stage, setStage] = useState<"write" | "vote" | "results">("write");

	const submit = () => {
		if (!fortune.trim()) return;
		// build archive from templates + mine
		let s = seed * 7;
		const r = () => {
			s = (s * 9301 + 49297) % 233280;
			return s / 233280;
		};
		const arr = ARCHIVE_TEMPLATES.slice()
			.sort(() => r() - 0.5)
			.slice(0, 3)
			.map((t) => ({ text: t, mine: false, votes: Math.floor(r() * 20) }));
		arr.push({ text: fortune.trim(), mine: true, votes: 0 });
		arr.sort(() => r() - 0.5);
		setArchive(arr);
		setStage("vote");
	};

	const vote = (idx: number) => {
		setArchive((a) => a.map((e, i) => (i === idx ? { ...e, votes: e.votes + 5 } : e)));
		setStage("results");
	};

	const newReading = () => {
		setSeed(Math.floor(Math.random() * 9999));
		setFortune("");
		setArchive([]);
		setStage("write");
	};

	return (
		<div style={{ background: "linear-gradient(#1a1028, #2a1838)", color: "#e8d8ff", padding: 20, fontFamily: "Georgia, serif", minHeight: 540 }}>
			<h2 style={{ margin: "0 0 4px" }}>The Cartomancer</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
				A spread is drawn for you. Write a short fortune, then judge others' readings.
			</div>
			<div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
				{spread.map((c, i) => (
					<div
						key={i}
						style={{
							width: 110,
							height: 160,
							background: "linear-gradient(160deg, #3a2050, #2a1538)",
							border: "2px solid #d4a",
							borderRadius: 8,
							padding: 6,
							boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
							display: "flex",
							flexDirection: "column",
							justifyContent: "space-between",
							color: "#f6d6ff",
						}}
					>
						<div style={{ fontSize: 11, opacity: 0.8 }}>{POSITIONS[i]}</div>
						<div style={{ fontSize: 32, textAlign: "center" }}>{c.glyph}</div>
						<div style={{ fontSize: 12, textAlign: "center", fontStyle: "italic" }}>{c.name}</div>
					</div>
				))}
			</div>

			{stage === "write" && (
				<div style={{ textAlign: "center" }}>
					<textarea
						value={fortune}
						onChange={(e) => setFortune(e.target.value)}
						placeholder="Write a short fortune (one or two sentences)..."
						style={{ width: "70%", height: 60, padding: 8, background: "#2a1838", color: "#fff", border: "1px solid #553", borderRadius: 4 }}
					/>
					<div>
						<button type="button" onClick={submit} disabled={!fortune.trim()} style={{ marginTop: 8 }}>
							Inscribe fortune
						</button>
					</div>
				</div>
			)}

			{stage === "vote" && (
				<div>
					<div style={{ textAlign: "center", marginBottom: 8 }}>
						Now, which of these readings fits this spread best?
					</div>
					{archive.map((e, i) => (
						<div
							key={i}
							onClick={() => vote(i)}
							style={{
								padding: 10,
								margin: "6px auto",
								maxWidth: 600,
								background: "#3a2540",
								borderRadius: 4,
								cursor: "pointer",
								fontStyle: "italic",
							}}
						>
							"{e.text}"
						</div>
					))}
				</div>
			)}

			{stage === "results" && (
				<div>
					<div style={{ textAlign: "center", marginBottom: 8 }}>Results:</div>
					{archive
						.slice()
						.sort((a, b) => b.votes - a.votes)
						.map((e, i) => (
							<div
								key={i}
								style={{
									padding: 10,
									margin: "6px auto",
									maxWidth: 600,
									background: e.mine ? "#503058" : "#3a2540",
									border: e.mine ? "1px solid #fc6" : "1px solid transparent",
									borderRadius: 4,
									fontStyle: "italic",
								}}
							>
								"{e.text}" <span style={{ float: "right", opacity: 0.8 }}>{e.votes} votes</span>
								{e.mine && <span style={{ marginLeft: 8, color: "#fc6" }}>(yours)</span>}
							</div>
						))}
					<div style={{ textAlign: "center", marginTop: 12 }}>
						<button type="button" onClick={newReading}>
							New reading
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
