import { useEffect, useMemo, useRef, useState } from "react";

// Tower of Tongues — climb a tower made of invented "language families".
// Every language, word and meaning is procedurally generated from a seed
// via mulberry32: no hardcoded vocabulary. Players learn each family's
// sound-shifts as they climb, because cognates within a family share rules.

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const ONSETS = ["k", "t", "p", "n", "m", "s", "l", "r", "h", "v", "f", "j"];
const VOWELS = ["a", "e", "i", "o", "u"];
const CODAS = ["", "", "", "n", "r", "s", "l", "k", "m"];

const CONCEPTS = [
	"water", "fire", "sun", "moon", "stone", "wind",
	"hand", "eye", "tree", "bird", "fish", "song",
	"sleep", "run", "see", "give", "small", "great",
];

type Lexicon = { lang: string; words: Record<string, string> };

function pickWeighted<T>(rng: () => number, arr: T[]): T {
	return arr[Math.floor(rng() * arr.length)];
}

function makeSyllable(rng: () => number): string {
	return pickWeighted(rng, ONSETS) + pickWeighted(rng, VOWELS) + pickWeighted(rng, CODAS);
}

function makeWord(rng: () => number): string {
	const syllables = 1 + Math.floor(rng() * 2);
	let w = "";
	for (let i = 0; i < syllables; i++) w += makeSyllable(rng);
	return w;
}

function makeLangName(rng: () => number): string {
	const s = makeSyllable(rng) + makeSyllable(rng);
	return s.charAt(0).toUpperCase() + s.slice(1) + "ish";
}

function applyShift(word: string, from: string, to: string): string {
	return word.split(from).join(to);
}

function genFamily(seed: number, langCount: number, conceptCount: number): Lexicon[] {
	const rng = mulberry32(seed);
	const ancestralWords: Record<string, string> = {};
	const concepts = [...CONCEPTS].sort(() => rng() - 0.5).slice(0, conceptCount);
	for (const c of concepts) ancestralWords[c] = makeWord(rng);
	const langs: Lexicon[] = [
		{ lang: makeLangName(rng), words: { ...ancestralWords } },
	];
	for (let i = 1; i < langCount; i++) {
		const pool = ONSETS.concat(VOWELS);
		const from = pickWeighted(rng, pool);
		let to = pickWeighted(rng, pool);
		while (to === from) to = pickWeighted(rng, pool);
		const w: Record<string, string> = {};
		for (const c of concepts) w[c] = applyShift(ancestralWords[c], from, to);
		langs.push({ lang: makeLangName(rng), words: w });
	}
	return langs;
}

type Step = { word: string; lang: string; answer: string; choices: string[] };

function buildStaircase(seed: number, family: Lexicon[]): Step[] {
	const rng = mulberry32(seed ^ 0x9e3779b1);
	const steps: Step[] = [];
	const concepts = Object.keys(family[0].words);
	for (let i = 0; i < family.length; i++) {
		const lang = family[i];
		const order = [...concepts].sort(() => rng() - 0.5).slice(0, 5);
		for (const c of order) {
			const wrong = concepts.filter((x) => x !== c).sort(() => rng() - 0.5).slice(0, 2);
			const choices = [c, ...wrong].sort(() => rng() - 0.5);
			steps.push({ word: lang.words[c], lang: lang.lang, answer: c, choices });
		}
	}
	return steps;
}

function useAudio() {
	const ctxRef = useRef<AudioContext | null>(null);
	const ensure = () => {
		if (ctxRef.current) return ctxRef.current;
		const Ctor =
			(window as unknown as { AudioContext: typeof AudioContext }).AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		ctxRef.current = new Ctor();
		return ctxRef.current;
	};
	useEffect(() => () => { ctxRef.current?.close(); }, []);
	const blip = (freq: number, dur = 0.12, type: OscillatorType = "sine") => {
		const ctx = ensure();
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.value = freq;
		o.connect(g); g.connect(ctx.destination);
		const t = ctx.currentTime;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(0.18, t + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		o.start(t); o.stop(t + dur + 0.02);
	};
	return { blip };
}

export default function TowerOfTongues() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [difficulty, setDifficulty] = useState<"short" | "tall" | "epic">("tall");
	const langCount = difficulty === "short" ? 3 : difficulty === "tall" ? 5 : 8;
	const conceptCount = difficulty === "short" ? 5 : difficulty === "tall" ? 7 : 10;
	const family = useMemo(() => genFamily(seed, langCount, conceptCount), [seed, langCount, conceptCount]);
	const steps = useMemo(() => buildStaircase(seed, family), [seed, family]);

	const [stepIdx, setStepIdx] = useState(0);
	const [score, setScore] = useState(0);
	const [streak, setStreak] = useState(0);
	const [bestStreak, setBestStreak] = useState(0);
	const [strikes, setStrikes] = useState(0);
	const [msg, setMsg] = useState("Listen for the pattern. Same family, shifted sounds.");
	const [hintUsed, setHintUsed] = useState(false);
	const [revealedHint, setRevealedHint] = useState<string | null>(null);
	const [startMs] = useState(() => Date.now());
	const { blip } = useAudio();

	const cur = steps[stepIdx];
	const done = stepIdx >= steps.length;

	const restart = (newSeed?: number) => {
		const s = newSeed ?? Math.floor(Math.random() * 1e9);
		setSeed(s);
		setStepIdx(0); setScore(0); setStreak(0); setBestStreak(0);
		setStrikes(0); setHintUsed(false); setRevealedHint(null);
		setMsg("New tower. Listen for the pattern.");
	};

	const pick = (c: string) => {
		if (done) return;
		if (c === cur.answer) {
			const bonus = streak >= 3 ? 5 : 0;
			setScore((s) => s + 10 + bonus);
			setStreak((s) => {
				const ns = s + 1;
				setBestStreak((b) => Math.max(b, ns));
				return ns;
			});
			setMsg(bonus ? `Yes! Streak bonus +${bonus}.` : "Yes! Step up.");
			setStepIdx((i) => i + 1);
			setRevealedHint(null);
			blip(440 + (stepIdx % 12) * 30, 0.16, "sine");
		} else {
			setStrikes((x) => x + 1);
			setStreak(0);
			setMsg(`Not quite — "${cur.word}" meant "${cur.answer}".`);
			blip(180, 0.2, "square");
		}
	};

	const hint = () => {
		if (done || !cur) return;
		setHintUsed(true);
		const langIdx = family.findIndex((l) => l.lang === cur.lang);
		if (langIdx > 0) {
			const prev = family[langIdx - 1];
			setRevealedHint(`In ${prev.lang} this concept is "${prev.words[cur.answer]}".`);
		} else {
			setRevealedHint(`First language — no cognate to compare yet.`);
		}
		setScore((s) => Math.max(0, s - 3));
	};

	const elapsed = Math.floor((Date.now() - startMs) / 1000);
	const totalSteps = steps.length;

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
				overflow: "auto",
			}}
		>
			<h2 style={{ margin: 0 }}>Tower of Tongues</h2>
			<div style={{ fontSize: 12, opacity: 0.7 }}>
				Seed {seed} · {family.length} languages · {totalSteps} steps
			</div>
			<div style={{ display: "flex", gap: 6, marginTop: 6 }}>
				{(["short", "tall", "epic"] as const).map((d) => (
					<button
						type="button"
						key={d}
						onClick={() => { setDifficulty(d); restart(); }}
						style={{
							padding: "4px 10px",
							background: difficulty === d ? "#d4a04a" : "#3a2a1f",
							color: difficulty === d ? "#000" : "#f0e6d0",
							border: "1px solid #6b4a2a",
							borderRadius: 3,
							cursor: "pointer",
							fontSize: 12,
						}}
					>
						{d}
					</button>
				))}
				<button
					type="button"
					onClick={() => restart()}
					style={{
						padding: "4px 10px",
						background: "#3a2a1f",
						color: "#f0e6d0",
						border: "1px solid #6b4a2a",
						borderRadius: 3,
						cursor: "pointer",
						fontSize: 12,
					}}
				>
					New tower
				</button>
			</div>
			{!done && cur && (
				<div style={{ marginTop: 14, textAlign: "center" }}>
					<div style={{ fontSize: 13, opacity: 0.7 }}>
						Step {stepIdx + 1} / {totalSteps} · {cur.lang}
					</div>
					<div style={{ fontSize: 40, marginTop: 6, fontStyle: "italic" }}>{cur.word}</div>
				</div>
			)}
			<div
				style={{
					marginTop: 12,
					position: "relative",
					width: 520,
					height: 280,
				}}
			>
				{steps.map((s, idx) => {
					const isCur = idx === stepIdx;
					const isDone = idx < stepIdx;
					if (idx > stepIdx + 4 || idx < stepIdx - 4) return null;
					const rel = idx - stepIdx;
					return (
						<div
							key={`step-${idx}`}
							style={{
								position: "absolute",
								top: 120 - rel * 44,
								left: 80 + rel * 18,
								width: 360,
								height: 36,
								background: isCur ? "#d4a04a" : isDone ? "#5a8c3a" : "#3a2a1f",
								borderRadius: 4,
								border: "1px solid #6b4a2a",
								display: "flex",
								alignItems: "center",
								padding: "0 14px",
								fontSize: 14,
								color: isCur ? "#000" : "#f0e6d0",
								boxShadow: isCur ? "0 0 12px rgba(255,200,80,0.6)" : "none",
								transition: "all 0.3s",
								opacity: isDone ? 0.85 : 1,
							}}
						>
							{isDone ? `✓ ${s.word} = ${s.answer}` : isCur ? `${s.word} (${s.lang})` : "•••"}
						</div>
					);
				})}
			</div>
			{!done && cur && (
				<div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
					{cur.choices.map((c) => (
						<button
							type="button"
							key={c}
							onClick={() => pick(c)}
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
			{!done && (
				<button
					type="button"
					onClick={hint}
					disabled={hintUsed}
					style={{
						marginTop: 10,
						padding: "6px 12px",
						background: hintUsed ? "#444" : "#7a5a3a",
						color: "#fff",
						border: "none",
						borderRadius: 3,
						cursor: hintUsed ? "default" : "pointer",
						fontSize: 12,
					}}
				>
					Hint (−3)
				</button>
			)}
			{revealedHint && (
				<div style={{ marginTop: 6, fontSize: 12, color: "#ffd28c" }}>{revealedHint}</div>
			)}
			<div style={{ marginTop: 10, fontStyle: "italic", minHeight: 20 }}>{msg}</div>
			<div style={{ fontSize: 12 }}>
				Score: {score} · Streak: {streak} (best {bestStreak}) · Strikes: {strikes} · {elapsed}s
			</div>
			{done && (
				<div style={{ marginTop: 10, color: "#9bcc70", fontSize: 16 }}>
					Tower complete! Final: {score} in {elapsed}s
				</div>
			)}
		</div>
	);
}
