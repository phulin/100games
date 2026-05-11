import { useEffect, useMemo, useRef, useState } from "react";

// Cuneiform — decipher procedurally generated symbols using a procedural grammar.
// No fixed vocabulary: lexicon is generated per session from syllable parts and
// each word is tagged with a grammatical class (noun/verb/mod).

type WordClass = "noun" | "verb" | "mod";

const SYLL_A = ["ka", "ne", "ru", "shi", "ti", "lu", "an", "en", "ma", "gi", "sa", "u", "ba", "ze"];
const SYLL_B = ["ra", "li", "tu", "shi", "na", "ki", "ash", "il", "ar", "us", "om", "en", "id"];

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function pick<T>(r: () => number, arr: T[]): T {
	return arr[Math.floor(r() * arr.length)];
}

function makeWord(r: () => number, cls: WordClass): string {
	const len = cls === "mod" ? 2 : 2 + (r() < 0.5 ? 1 : 0);
	let w = pick(r, SYLL_A);
	for (let i = 1; i < len; i++) w += pick(r, i % 2 === 0 ? SYLL_A : SYLL_B);
	if (cls === "verb") w += "-" + pick(r, ["s", "n", "t"]);
	return w;
}

function makeGlyph(r: () => number): string {
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

type LexEntry = { word: string; cls: WordClass; glyph: string };

function makeLexicon(seed: number, size: number): LexEntry[] {
	const r = mulberry32(seed);
	const entries: LexEntry[] = [];
	const used = new Set<string>();
	const make = (cls: WordClass) => {
		let w = makeWord(r, cls);
		let tries = 0;
		while (used.has(w) && tries++ < 10) w = makeWord(r, cls);
		used.add(w);
		const r2 = mulberry32(seed * 7919 + entries.length * 31 + 1);
		entries.push({ word: w, cls, glyph: makeGlyph(r2) });
	};
	const nNoun = Math.ceil(size * 0.5);
	const nVerb = Math.ceil(size * 0.25);
	const nMod = size - nNoun - nVerb;
	for (let i = 0; i < nNoun; i++) make("noun");
	for (let i = 0; i < nVerb; i++) make("verb");
	for (let i = 0; i < nMod; i++) make("mod");
	for (let i = entries.length - 1; i > 0; i--) {
		const j = Math.floor(r() * (i + 1));
		[entries[i], entries[j]] = [entries[j], entries[i]];
	}
	return entries;
}

type Tablet = { words: number[]; text: string };

function makeTablet(seed: number, lex: LexEntry[]): Tablet {
	const r = mulberry32(seed);
	const nouns: number[] = [];
	const verbs: number[] = [];
	const mods: number[] = [];
	lex.forEach((e, i) => {
		if (e.cls === "noun") nouns.push(i);
		else if (e.cls === "verb") verbs.push(i);
		else mods.push(i);
	});
	const idx: number[] = [];
	if (r() < 0.55 && mods.length) idx.push(pick(r, mods));
	idx.push(pick(r, nouns));
	idx.push(pick(r, verbs));
	if (r() < 0.4 && mods.length) idx.push(pick(r, mods));
	idx.push(pick(r, nouns));
	if (r() < 0.25 && nouns.length) idx.push(pick(r, nouns));
	const text = idx.map((i) => lex[i].word).join(" ");
	return { words: idx, text };
}

function useAudio() {
	const ctxRef = useRef<AudioContext | null>(null);
	const ensure = () => {
		if (!ctxRef.current) {
			try {
				ctxRef.current = new (window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
			} catch {
				/* no audio */
			}
		}
		return ctxRef.current;
	};
	const click = (idx: number) => {
		const ctx = ensure();
		if (!ctx) return;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = "square";
		o.frequency.value = 200 + (idx % 12) * 35;
		g.gain.setValueAtTime(0.0001, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.005);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + 0.08);
	};
	const success = () => {
		const ctx = ensure();
		if (!ctx) return;
		[523, 659, 880].forEach((f, i) => {
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.type = "triangle";
			o.frequency.value = f;
			g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.08);
			g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01 + i * 0.08);
			g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4 + i * 0.08);
			o.connect(g).connect(ctx.destination);
			o.start(ctx.currentTime + i * 0.08);
			o.stop(ctx.currentTime + 0.5 + i * 0.08);
		});
	};
	const fail = () => {
		const ctx = ensure();
		if (!ctx) return;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = "sawtooth";
		o.frequency.setValueAtTime(220, ctx.currentTime);
		o.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.3);
		g.gain.setValueAtTime(0.12, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + 0.4);
	};
	return { ensure, click, success, fail };
}

type Difficulty = "novice" | "scribe" | "scholar";
const DIFF_CFG: Record<Difficulty, { lexSize: number; tablets: number; revealCost: number }> = {
	novice: { lexSize: 8, tablets: 5, revealCost: 0 },
	scribe: { lexSize: 12, tablets: 7, revealCost: 1 },
	scholar: { lexSize: 16, tablets: 9, revealCost: 2 },
};

export default function Game044_Cuneiform() {
	const [diff, setDiff] = useState<Difficulty>("novice");
	const [sessionSeed, setSessionSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const cfg = DIFF_CFG[diff];

	const lex = useMemo(() => makeLexicon(sessionSeed, cfg.lexSize), [sessionSeed, cfg.lexSize]);
	const tablets = useMemo(
		() => Array.from({ length: cfg.tablets }, (_, i) => makeTablet(sessionSeed * 31 + i + 1, lex)),
		[sessionSeed, cfg.tablets, lex]
	);

	const [known, setKnown] = useState<Record<number, boolean>>({});
	const [active, setActive] = useState(0);
	const [guesses, setGuesses] = useState<Record<number, string>>({});
	const [solved, setSolved] = useState<boolean[]>(() => Array.from({ length: cfg.tablets }, () => false));
	const [score, setScore] = useState(0);
	const [feedback, setFeedback] = useState<string | null>(null);
	const audio = useAudio();

	useEffect(() => {
		const firstNoun = lex.findIndex((e) => e.cls === "noun");
		const firstVerb = lex.findIndex((e) => e.cls === "verb");
		const firstMod = lex.findIndex((e) => e.cls === "mod");
		setKnown(() => {
			const k: Record<number, boolean> = {};
			if (firstNoun >= 0) k[firstNoun] = true;
			if (firstVerb >= 0) k[firstVerb] = true;
			if (firstMod >= 0) k[firstMod] = true;
			return k;
		});
		setSolved(Array.from({ length: cfg.tablets }, () => false));
		setGuesses({});
		setActive(0);
		setScore(0);
	}, [lex, cfg.tablets]);

	const tablet = tablets[active] ?? tablets[0];

	const reveal = (wordIdx: number) => {
		if (known[wordIdx]) return;
		if (score - cfg.revealCost < -5) {
			setFeedback(`Score too low to reveal (cost ${cfg.revealCost}). Solve a tablet first.`);
			audio.fail();
			return;
		}
		setScore((s) => s - cfg.revealCost);
		setKnown((k) => ({ ...k, [wordIdx]: true }));
		audio.click(wordIdx);
	};

	const checkSolved = () => {
		const guess = (guesses[active] ?? "").trim().toLowerCase();
		const target = tablet.text.toLowerCase();
		if (guess === target) {
			if (!solved[active]) {
				const unknownInTablet = tablet.words.filter((w) => !known[w]).length;
				const reward = 10 + unknownInTablet * 5;
				setScore((s) => s + reward);
				setSolved((arr) => arr.map((v, i) => (i === active ? true : v)));
				setKnown((k) => {
					const nk = { ...k };
					tablet.words.forEach((w) => {
						nk[w] = true;
					});
					return nk;
				});
				setFeedback(`Correct! +${reward} (auto-revealed ${unknownInTablet} new)`);
				audio.success();
			} else {
				setFeedback("Already solved.");
			}
		} else {
			const gWords = guess.split(/\s+/).filter(Boolean);
			const tWords = target.split(/\s+/);
			let correctPos = 0;
			for (let i = 0; i < Math.min(gWords.length, tWords.length); i++) {
				if (gWords[i] === tWords[i]) correctPos++;
			}
			setFeedback(
				`Not quite. ${correctPos}/${tWords.length} positions correct, length ${gWords.length} vs ${tWords.length}.`
			);
			audio.fail();
		}
	};

	const restart = (d: Difficulty = diff) => {
		setDiff(d);
		setSessionSeed(Math.floor(Math.random() * 1e9));
		setFeedback(null);
	};

	const classColor = (cls: WordClass) =>
		cls === "noun" ? "#2d6" : cls === "verb" ? "#d62" : "#6cd";

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
			onClick={() => audio.ensure()}
		>
			<h2 style={{ margin: 2 }}>Cuneiform</h2>
			<div style={{ fontSize: 13, opacity: 0.75, textAlign: "center", maxWidth: 700 }}>
				Procedural lexicon, fresh each session. Grammar: [MOD] NOUN VERB [MOD] NOUN. Click a glyph to reveal it
				(cost {cfg.revealCost} pts).
			</div>
			<div style={{ display: "flex", gap: 8, marginTop: 6 }}>
				{(Object.keys(DIFF_CFG) as Difficulty[]).map((d) => (
					<button
						key={d}
						type="button"
						onClick={() => restart(d)}
						style={{
							background: d === diff ? "#5a3d18" : "#7d5a30",
							color: "#fff",
							border: "none",
							padding: "4px 8px",
							borderRadius: 4,
							cursor: "pointer",
						}}
					>
						{d}
					</button>
				))}
				<button type="button" onClick={() => restart(diff)} style={btn}>
					New session
				</button>
			</div>
			<div style={{ display: "flex", gap: 14, marginTop: 10 }}>
				<div style={{ flex: 1 }}>
					<div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
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
							<svg key={i} width={52} height={52} viewBox="0 0 32 32" style={{ background: "#c2a978", borderRadius: 4 }}>
								<g dangerouslySetInnerHTML={{ __html: lex[w].glyph }} />
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
								boxSizing: "border-box",
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter") checkSolved();
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
						{feedback && <div style={{ marginTop: 6, fontSize: 13 }}>{feedback}</div>}
					</div>
				</div>
				<div style={{ width: 260 }}>
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
						{lex.map((entry, i) => (
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
									borderLeft: known[i] ? `4px solid ${classColor(entry.cls)}` : "4px solid transparent",
								}}
								title={known[i] ? `${entry.word} (${entry.cls})` : `Click to reveal (cost ${cfg.revealCost})`}
							>
								<svg width={36} height={36} viewBox="0 0 32 32">
									<g dangerouslySetInnerHTML={{ __html: entry.glyph }} />
								</svg>
								<div style={{ fontSize: 11 }}>{known[i] ? entry.word : "??"}</div>
							</div>
						))}
					</div>
					<div style={{ marginTop: 8, fontSize: 11, opacity: 0.75 }}>
						Legend: <span style={{ color: classColor("noun") }}>■</span> noun ·{" "}
						<span style={{ color: classColor("verb") }}>■</span> verb ·{" "}
						<span style={{ color: classColor("mod") }}>■</span> mod
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
