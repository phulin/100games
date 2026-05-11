import { useEffect, useMemo, useState } from "react";

// Game 79 — The Translator
// Procedural fictional-language poems. Each poem has a stable seed-derived poem_id.
// D1-backed gallery: submit/upvote at /api/translator/translations.
// Daily mode: deterministic seed for everyone today.

type Word = { foreign: string; synonyms: string[]; chosen: number };

type Puzzle = {
	id: string;
	title: string;
	gloss: Array<{ foreign: string; meanings: string[] }>;
	lines: string[][];
	target: { rhymeScheme: string; meterHint: string; example: string };
	seed: number;
};

function mulberry32(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const NOUNS: ReadonlyArray<{ syllables: number; meanings: string[] }> = [
	{ syllables: 1, meanings: ["stone", "rock", "boulder"] },
	{ syllables: 1, meanings: ["bird", "swallow", "wing"] },
	{ syllables: 1, meanings: ["sky", "heaven", "blue"] },
	{ syllables: 1, meanings: ["sea", "deep", "tide"] },
	{ syllables: 2, meanings: ["river", "stream", "brook"] },
	{ syllables: 2, meanings: ["mountain", "summit", "peak"] },
	{ syllables: 1, meanings: ["moon", "pearl", "lamp"] },
	{ syllables: 1, meanings: ["sun", "gold", "star"] },
	{ syllables: 1, meanings: ["song", "tune", "cry"] },
	{ syllables: 1, meanings: ["heart", "soul", "core"] },
	{ syllables: 1, meanings: ["fire", "flame", "blaze"] },
	{ syllables: 1, meanings: ["wind", "breath", "gale"] },
	{ syllables: 2, meanings: ["shadow", "phantom", "shade"] },
	{ syllables: 2, meanings: ["forest", "thicket", "woods"] },
	{ syllables: 1, meanings: ["leaf", "blade", "frond"] },
];

const VERBS: ReadonlyArray<{ syllables: number; meanings: string[] }> = [
	{ syllables: 1, meanings: ["sleeps", "rests", "lies"] },
	{ syllables: 1, meanings: ["soars", "flies", "wheels"] },
	{ syllables: 1, meanings: ["sings", "calls", "cries"] },
	{ syllables: 1, meanings: ["burns", "shines", "glows"] },
	{ syllables: 1, meanings: ["falls", "drops", "fades"] },
	{ syllables: 1, meanings: ["climbs", "rises", "mounts"] },
	{ syllables: 1, meanings: ["dreams", "thinks", "mourns"] },
	{ syllables: 1, meanings: ["dances", "sways", "drifts"] },
];

const ADJECTIVES: ReadonlyArray<{ syllables: number; meanings: string[] }> = [
	{ syllables: 1, meanings: ["bright", "shining", "clear"] },
	{ syllables: 1, meanings: ["high", "far", "above"] },
	{ syllables: 1, meanings: ["dark", "deep", "still"] },
	{ syllables: 1, meanings: ["cold", "frozen", "pale"] },
	{ syllables: 1, meanings: ["soft", "gentle", "slow"] },
	{ syllables: 1, meanings: ["lost", "fading", "old"] },
];

const PREPS: ReadonlyArray<{ syllables: number; meanings: string[] }> = [
	{ syllables: 1, meanings: ["beside", "near", "by"] },
	{ syllables: 1, meanings: ["beneath", "under", "below"] },
	{ syllables: 1, meanings: ["beyond", "past", "after"] },
];

const ARTICLES: ReadonlyArray<{ syllables: number; meanings: string[] }> = [
	{ syllables: 1, meanings: ["the"] },
	{ syllables: 1, meanings: ["a", "one"] },
];

const CONS = ["k", "t", "m", "n", "r", "s", "v", "l", "d", "h", "f", "b"];
const VOWS = ["a", "e", "i", "o", "u"];
const DIGRAPHS = ["ai", "oa", "ei", "ou", "ie", "ae"];

function makeForeignWord(rnd: () => number, syllables: number): string {
	let w = "";
	for (let s = 0; s < syllables; s++) {
		if (rnd() > 0.5) w += CONS[Math.floor(rnd() * CONS.length)];
		w += rnd() > 0.7
			? DIGRAPHS[Math.floor(rnd() * DIGRAPHS.length)]
			: VOWS[Math.floor(rnd() * VOWS.length)];
		if (rnd() > 0.7 && s < syllables - 1) w += CONS[Math.floor(rnd() * CONS.length)];
	}
	return w || "lu";
}

const TITLES_A = ["Verse", "Song", "Lament", "Ode", "Whisper", "Chant", "Hymn", "Echo"];
const TITLES_B = ["Stones", "Wings", "Waters", "Shadows", "Stars", "Embers", "Tides", "Echoes", "Reeds"];

function makePuzzle(seed: number): Puzzle {
	const rnd = mulberry32(seed);
	const title =
		TITLES_A[Math.floor(rnd() * TITLES_A.length)] +
		" of " +
		TITLES_B[Math.floor(rnd() * TITLES_B.length)];

	type Slot = { pos: string; meanings: string[]; syllables: number };
	const pickFrom = (
		arr: ReadonlyArray<{ syllables: number; meanings: string[] }>,
		pos: string,
	): Slot => {
		const w = arr[Math.floor(rnd() * arr.length)];
		return { pos, meanings: w.meanings, syllables: w.syllables };
	};

	const patterns: string[][] = [
		["ART", "ADJ", "NOUN", "VERB", "PREP", "ART", "NOUN"],
		["ART", "NOUN", "VERB", "ADJ", "NOUN"],
		["ART", "NOUN", "PREP", "ART", "NOUN", "VERB"],
		["ADJ", "NOUN", "VERB", "ART", "NOUN"],
	];
	const pickPattern = () => patterns[Math.floor(rnd() * patterns.length)];
	const slotFromTag = (tag: string): Slot => {
		switch (tag) {
			case "NOUN":
				return pickFrom(NOUNS, "noun");
			case "VERB":
				return pickFrom(VERBS, "verb");
			case "ADJ":
				return pickFrom(ADJECTIVES, "adj");
			case "PREP":
				return pickFrom(PREPS, "prep");
			default:
				return pickFrom(ARTICLES, "art");
		}
	};
	const lineSlots: Slot[][] = [pickPattern().map(slotFromTag), pickPattern().map(slotFromTag)];

	const dictMap = new Map<string, { foreign: string; meanings: string[] }>();
	const allSlots = [...lineSlots[0], ...lineSlots[1]];
	for (const s of allSlots) {
		const key = s.meanings[0];
		if (!dictMap.has(key)) {
			let foreign = makeForeignWord(rnd, s.syllables);
			const used = new Set([...dictMap.values()].map((v) => v.foreign));
			let tries = 0;
			while (used.has(foreign) && tries < 12) {
				foreign = makeForeignWord(rnd, s.syllables);
				tries++;
			}
			dictMap.set(key, { foreign, meanings: s.meanings });
		}
	}

	const gloss = Array.from(dictMap.values());
	const lines: string[][] = lineSlots.map((line) =>
		line.map((s) => dictMap.get(s.meanings[0])!.foreign),
	);

	const totalSyl = lineSlots[0].reduce((a, s) => a + s.syllables, 0);
	const meter = `Roughly ${totalSyl} syllables per line.`;
	const example = lineSlots
		.map((line) => line.map((s) => s.meanings[0]).join(" "))
		.join(" / ");

	const id = `p-${seed.toString(36)}`;
	return {
		id,
		title,
		gloss,
		lines,
		target: { rhymeScheme: "AA", meterHint: meter, example },
		seed,
	};
}

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
const SEED_HISTORY_KEY = "translator:seeds";
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
	} catch {}
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
	} catch {}
}

function dailySeed(): number {
	const d = new Date();
	const ymd = d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
	return ymd;
}

class QuillAudio {
	private ctx: AudioContext | null = null;
	private ensure() {
		if (!this.ctx) {
			try {
				this.ctx = new AudioContext();
			} catch {
				return null;
			}
		}
		if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
		return this.ctx;
	}
	tick() {
		const c = this.ensure();
		if (!c) return;
		const o = c.createOscillator();
		const g = c.createGain();
		o.type = "triangle";
		o.frequency.value = 880 + Math.random() * 200;
		g.gain.setValueAtTime(0.0001, c.currentTime);
		g.gain.exponentialRampToValueAtTime(0.04, c.currentTime + 0.005);
		g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.05);
		o.connect(g).connect(c.destination);
		o.start();
		o.stop(c.currentTime + 0.07);
	}
	chime(notes: number[]) {
		const c = this.ensure();
		if (!c) return;
		notes.forEach((f, i) => {
			const o = c.createOscillator();
			const g = c.createGain();
			o.type = "sine";
			o.frequency.value = f;
			const t0 = c.currentTime + i * 0.1;
			g.gain.setValueAtTime(0.0001, t0);
			g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
			g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
			o.connect(g).connect(c.destination);
			o.start(t0);
			o.stop(t0 + 0.6);
		});
	}
}

export default function Game079_TheTranslator() {
	const [mode, setMode] = useState<"daily" | "random">("random");
	const [seed, setSeed] = useState<number>(() => (Math.random() * 1e9) | 0);
	const effectiveSeed = mode === "daily" ? dailySeed() : seed;
	const puzzle = useMemo(() => makePuzzle(effectiveSeed), [effectiveSeed]);

	const [lines, setLines] = useState<Word[][]>(() =>
		puzzle.lines.map((line) =>
			line.map((f) => {
				const g = puzzle.gloss.find((x) => x.foreign === f)!;
				return { foreign: f, synonyms: g.meanings, chosen: 0 };
			}),
		),
	);
	const [score, setScore] = useState<number | null>(null);

	const [author] = useState<string>(() => getOrCreateAuthor());
	const [entries, setEntries] = useState<Entry[]>([]);
	const [submitted, setSubmitted] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [offline, setOffline] = useState(false);
	const [voted, setVoted] = useState<Record<string, true>>(() => loadLocalVotes());
	const [status, setStatus] = useState<string>("");
	const audio = useMemo(() => new QuillAudio(), []);

	useEffect(() => {
		setLines(
			puzzle.lines.map((line) =>
				line.map((f) => {
					const g = puzzle.gloss.find((x) => x.foreign === f)!;
					return { foreign: f, synonyms: g.meanings, chosen: 0 };
				}),
			),
		);
		setScore(null);
		setSubmitted(false);
		setEntries([]);
		setStatus("");
		try {
			const raw = localStorage.getItem(SEED_HISTORY_KEY);
			const list: number[] = raw ? JSON.parse(raw) : [];
			if (!list.includes(effectiveSeed)) {
				list.push(effectiveSeed);
				localStorage.setItem(SEED_HISTORY_KEY, JSON.stringify(list.slice(-100)));
			}
		} catch {}
	}, [puzzle, effectiveSeed]);

	const setSyn = (li: number, wi: number, ci: number) => {
		audio.tick();
		setLines((ls) =>
			ls.map((line, i) =>
				i === li ? line.map((w, j) => (j === wi ? { ...w, chosen: ci } : w)) : line,
			),
		);
	};

	const move = (li: number, wi: number, dir: -1 | 1) => {
		audio.tick();
		setLines((ls) =>
			ls.map((line, i) => {
				if (i !== li) return line;
				const j = wi + dir;
				if (j < 0 || j >= line.length) return line;
				const cp = [...line];
				[cp[wi], cp[j]] = [cp[j], cp[wi]];
				return cp;
			}),
		);
	};

	const englishLines = lines.map((line) => line.map((w) => w.synonyms[w.chosen]).join(" "));

	const evaluate = () => {
		const a = englishLines[0];
		const b = englishLines[englishLines.length - 1];
		const lastA = a.split(" ").pop()!.toLowerCase();
		const lastB = b.split(" ").pop()!.toLowerCase();
		const rhyme =
			lastA.slice(-2) === lastB.slice(-2) && lastA !== lastB
				? 50
				: lastA === lastB
					? 20
					: 0;
		const meter = englishLines.every(
			(l) => Math.abs(l.split(" ").length - englishLines[0].split(" ").length) < 2,
		)
			? 30
			: 10;
		const variety = lines.reduce(
			(s, l) => s + l.filter((w) => w.chosen !== 0).length * 2,
			0,
		);
		const s = rhyme + meter + Math.min(20, variety);
		setScore(s);
		audio.chime(s >= 70 ? [523, 659, 784] : s >= 40 ? [440, 523] : [330]);
	};

	const fetchEntries = async (poemId: string) => {
		try {
			const res = await fetch(`${API}?poem=${encodeURIComponent(poemId)}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { entries?: Entry[] };
			setEntries(data.entries ?? []);
			setOffline(false);
		} catch {
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
			const localEntry: Entry = {
				id: -Date.now(),
				poem_id: puzzle.id,
				text,
				author,
				votes: 0,
				created_at: Date.now(),
			};
			const all = loadLocalEntries();
			if (
				!all.some(
					(e) =>
						e.poem_id === localEntry.poem_id &&
						e.author === localEntry.author &&
						e.text === localEntry.text,
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
		audio.chime([523, 659, 784, 988]);
	};

	const upvote = async (entry: Entry) => {
		const key = `${puzzle.id}:${entry.id}`;
		if (voted[key]) return;
		audio.tick();
		setEntries((es) =>
			es.map((e) => (e.id === entry.id ? { ...e, votes: e.votes + 1 } : e)),
		);
		const nextVoted = { ...voted, [key]: true as const };
		setVoted(nextVoted);
		saveLocalVotes(nextVoted);

		if (entry.id < 0) {
			const all = loadLocalEntries().map((e) =>
				e.id === entry.id ? { ...e, votes: e.votes + 1 } : e,
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
						.sort((a, b) => b.votes - a.votes || b.id - a.id),
				);
			}
		} catch {
			setOffline(true);
		}
	};

	const newPoem = () => {
		setMode("random");
		setSeed((Math.random() * 1e9) | 0);
	};

	const dailyMode = () => {
		setMode("daily");
	};

	useEffect(() => {
		if (submitted) fetchEntries(puzzle.id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [puzzle.id, submitted]);

	const sortedEntries = [...entries].sort(
		(a, b) => b.votes - a.votes || b.id - a.id,
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
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
				<h2 style={{ margin: 0 }}>The Translator</h2>
				<div style={{ fontSize: 12, opacity: 0.7 }}>
					Mode: {mode === "daily" ? "Daily" : "Random"} · poem {puzzle.id}
				</div>
			</div>
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
				<div style={{ fontSize: 11, opacity: 0.55, marginTop: 4 }}>
					Glossary words: {puzzle.gloss.length}
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
								onClick={() => setSyn(li, wi, (w.chosen + 1) % w.synonyms.length)}
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
				<button onClick={newPoem} style={btn}>
					New poem
				</button>
				<button
					onClick={dailyMode}
					style={{ ...btn, opacity: mode === "daily" ? 0.5 : 1 }}
					disabled={mode === "daily"}
				>
					Daily poem
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
