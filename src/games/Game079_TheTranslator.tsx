import { useEffect, useState } from "react";

// Game 79 — The Translator
// A poem in a fictional language. Glossary gives synonym options.
// Reorder & pick synonyms to produce English that scans and rhymes.
// Community: after submitting, see other players' translations and upvote favorites.

type Word = { foreign: string; synonyms: string[]; chosen: number };

type Puzzle = {
	id: string; // stable poem_id
	title: string;
	gloss: Array<{ foreign: string; meanings: string[] }>;
	lines: string[][]; // foreign words per line
	target: { rhymeScheme: string; meterHint: string; example: string };
};

const PUZZLES: Puzzle[] = [
	{
		id: "verse-of-stones",
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
		id: "song-of-wings",
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

type Entry = {
	id: number;
	poem_id: string;
	text: string;
	author: string | null;
	votes: number;
	created_at: number;
};

const AUTHOR_KEY = "translator:author";
const LOCAL_ENTRIES_KEY = "translator:local-entries";
const LOCAL_VOTES_KEY = "translator:local-votes";
const API = "/api/translator/translations";

function getOrCreateAuthor(): string {
	try {
		const existing = localStorage.getItem(AUTHOR_KEY);
		if (existing) return existing;
		const id =
			"anon-" +
			Math.random().toString(36).slice(2, 8) +
			Math.random().toString(36).slice(2, 6);
		localStorage.setItem(AUTHOR_KEY, id);
		return id;
	} catch {
		return "anon-local";
	}
}

function loadLocalEntries(): Entry[] {
	try {
		const raw = localStorage.getItem(LOCAL_ENTRIES_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function saveLocalEntries(entries: Entry[]) {
	try {
		localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(entries.slice(-200)));
	} catch {
		/* ignore */
	}
}

function loadLocalVotes(): Record<string, true> {
	try {
		const raw = localStorage.getItem(LOCAL_VOTES_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

function saveLocalVotes(votes: Record<string, true>) {
	try {
		localStorage.setItem(LOCAL_VOTES_KEY, JSON.stringify(votes));
	} catch {
		/* ignore */
	}
}

export default function Game079_TheTranslator() {
	const [puzzleIdx, setPuzzleIdx] = useState(0);
	const puzzle = PUZZLES[puzzleIdx];

	const [lines, setLines] = useState<Word[][]>(() =>
		puzzle.lines.map((line) =>
			line.map((f) => {
				const g = puzzle.gloss.find((x) => x.foreign === f)!;
				return { foreign: f, synonyms: g.meanings, chosen: 0 };
			})
		)
	);
	const [score, setScore] = useState<number | null>(null);

	const [author] = useState<string>(() => getOrCreateAuthor());
	const [entries, setEntries] = useState<Entry[]>([]);
	const [submitted, setSubmitted] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [offline, setOffline] = useState(false);
	const [voted, setVoted] = useState<Record<string, true>>(() => loadLocalVotes());
	const [status, setStatus] = useState<string>("");

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
		const a = englishLines[0];
		const b = englishLines[englishLines.length - 1];
		const lastA = a.split(" ").pop()!.toLowerCase();
		const lastB = b.split(" ").pop()!.toLowerCase();
		const rhyme = lastA.slice(-2) === lastB.slice(-2) && lastA !== lastB ? 50 : lastA === lastB ? 20 : 0;
		const meter =
			englishLines.every((l) => Math.abs(l.split(" ").length - englishLines[0].split(" ").length) < 2)
				? 30
				: 10;
		const variety = lines.reduce(
			(s, l) => s + l.filter((w) => w.chosen !== 0).length * 2,
			0
		);
		setScore(rhyme + meter + Math.min(20, variety));
	};

	const fetchEntries = async (poemId: string) => {
		try {
			const res = await fetch(`${API}?poem=${encodeURIComponent(poemId)}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { entries?: Entry[] };
			setEntries(data.entries ?? []);
			setOffline(false);
		} catch {
			// Fallback to local-only entries for this poem.
			const local = loadLocalEntries().filter((e) => e.poem_id === poemId);
			local.sort((a, b) => b.votes - a.votes || b.id - a.id);
			setEntries(local);
			setOffline(true);
		}
	};

	const submit = async () => {
		if (submitting) return;
		const text = englishLines.join("\n").trim();
		if (!text) return;
		setSubmitting(true);
		setStatus("");
		try {
			const res = await fetch(API, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ poem_id: puzzle.id, text, author }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			setOffline(false);
		} catch {
			// localStorage fallback
			const localEntry: Entry = {
				id: -Date.now(),
				poem_id: puzzle.id,
				text,
				author,
				votes: 0,
				created_at: Date.now(),
			};
			const all = loadLocalEntries();
			// Dedupe locally: same author + same poem + same text.
			if (
				!all.some(
					(e) =>
						e.poem_id === localEntry.poem_id &&
						e.author === localEntry.author &&
						e.text === localEntry.text
				)
			) {
				all.push(localEntry);
				saveLocalEntries(all);
			}
			setOffline(true);
		}
		setSubmitted(true);
		setSubmitting(false);
		await fetchEntries(puzzle.id);
		setStatus("Translation submitted.");
	};

	const upvote = async (entry: Entry) => {
		const key = `${puzzle.id}:${entry.id}`;
		if (voted[key]) return;
		// Optimistic
		setEntries((es) =>
			es.map((e) => (e.id === entry.id ? { ...e, votes: e.votes + 1 } : e))
		);
		const nextVoted = { ...voted, [key]: true as const };
		setVoted(nextVoted);
		saveLocalVotes(nextVoted);

		if (entry.id < 0) {
			// Local-only entry — persist vote in localStorage list.
			const all = loadLocalEntries().map((e) =>
				e.id === entry.id ? { ...e, votes: e.votes + 1 } : e
			);
			saveLocalEntries(all);
			return;
		}

		try {
			const res = await fetch(API, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "vote", entry_id: entry.id, author }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { entry?: Entry };
			if (data.entry) {
				setEntries((es) =>
					es
						.map((e) => (e.id === data.entry!.id ? data.entry! : e))
						.sort((a, b) => b.votes - a.votes || b.id - a.id)
				);
			}
		} catch {
			setOffline(true);
		}
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
		setSubmitted(false);
		setEntries([]);
		setStatus("");
	};

	// Refresh entries whenever the poem changes after a submission.
	useEffect(() => {
		if (submitted) {
			fetchEntries(puzzle.id);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [puzzle.id, submitted]);

	const sortedEntries = [...entries].sort(
		(a, b) => b.votes - a.votes || b.id - a.id
	);

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

			<div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
				<button onClick={evaluate} style={btn}>
					Score my translation
				</button>
				<button onClick={submit} style={btn} disabled={submitting}>
					{submitting ? "Submitting…" : submitted ? "Resubmit" : "Submit to gallery"}
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
			{status && (
				<div style={{ fontSize: 12, marginTop: 6, opacity: 0.8 }}>
					{status} {offline && "(offline — saved locally)"}
				</div>
			)}

			{submitted && (
				<div style={{ marginTop: 18 }}>
					<div
						style={{
							fontStyle: "italic",
							opacity: 0.85,
							borderTop: "1px solid #ffffff22",
							paddingTop: 10,
						}}
					>
						Other translations of "{puzzle.title}"
						{offline && " (offline — local only)"}:
					</div>
					{sortedEntries.length === 0 && (
						<div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
							No translations yet. Be the first to share one!
						</div>
					)}
					<div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
						{sortedEntries.map((e) => {
							const key = `${puzzle.id}:${e.id}`;
							const hasVoted = !!voted[key];
							const mine = e.author && e.author === author;
							return (
								<div
									key={e.id}
									style={{
										background: "#0005",
										padding: "8px 10px",
										borderRadius: 6,
										display: "flex",
										gap: 10,
										alignItems: "flex-start",
									}}
								>
									<button
										onClick={() => upvote(e)}
										disabled={hasVoted || !!mine}
										style={{
											...voteBtn,
											opacity: hasVoted || mine ? 0.5 : 1,
											cursor: hasVoted || mine ? "default" : "pointer",
										}}
										title={
											mine
												? "Your own translation"
												: hasVoted
													? "Already upvoted"
													: "Upvote"
										}
									>
										▲ {e.votes}
									</button>
									<div style={{ flex: 1, whiteSpace: "pre-wrap", fontSize: 15 }}>
										{e.text}
										<div style={{ fontSize: 11, opacity: 0.6, marginTop: 4 }}>
											— {e.author ?? "anon"}
											{mine && " (you)"}
										</div>
									</div>
								</div>
							);
						})}
					</div>
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
const voteBtn: React.CSSProperties = {
	background: "#403254",
	color: "#fff",
	border: "none",
	borderRadius: 4,
	padding: "6px 10px",
	fontSize: 13,
	minWidth: 56,
};
