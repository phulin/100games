import { useEffect, useMemo, useState } from "react";

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function dailySeed() {
	const d = new Date();
	return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

type Puzzle = {
	words: string[];
	target: string[];
	accept: string[][];
	prompt: string;
};

const PUNCT_OPTIONS = ["", ",", ".", ";", "-"];

type Template = { build: (rng: () => number) => Puzzle };

const SUBJECT_LISTS = [
	["my family", "my pets", "my friends", "my plants"],
	["the dean", "the regent", "the panel", "the council"],
	["dawn", "dusk", "the bell", "the watch"],
];
const VERBS = ["eats", "calls", "marks", "tends", "guards"];
const NOUNS = ["shoots", "leaves", "letters", "shadows", "harvests"];

const TEMPLATES: Template[] = [
	{
		build: (rng) => {
			const names = ["grandma", "boss", "captain", "Uncle Ned", "the chef"];
			const name = names[Math.floor(rng() * names.length)];
			return {
				words: ["Let's", "eat", name],
				target: ["", ",", "."],
				accept: [[""], [","], [".", "!"]],
				prompt: `Invite ${name} to dinner (don't eat ${name}).`,
			};
		},
	},
	{
		build: (rng) => {
			const list = SUBJECT_LISTS[Math.floor(rng() * SUBJECT_LISTS.length)];
			const a = list[0];
			const b = list[1];
			const verb = ["cooking", "naming", "drawing", "painting"][Math.floor(rng() * 4)];
			const aw = a.split(" ");
			const bw = b.split(" ");
			const words = ["I", "like", verb, ...aw, "and", ...bw];
			const len = words.length;
			const target = new Array(len).fill("");
			target[2] = ",";
			target[len - 1] = ".";
			const accept: string[][] = new Array(len).fill(0).map(() => [""]);
			accept[2] = [","];
			accept[len - 1] = [".", "!"];
			return { words, target, accept, prompt: "List things I like (not a cannibal)." };
		},
	},
	{
		build: (rng) => {
			const subj = ["panda", "scribe", "raven", "novice"][Math.floor(rng() * 4)];
			const verb = VERBS[Math.floor(rng() * VERBS.length)];
			const a = NOUNS[Math.floor(rng() * NOUNS.length)];
			let b = NOUNS[Math.floor(rng() * NOUNS.length)];
			while (b === a) b = NOUNS[Math.floor(rng() * NOUNS.length)];
			const commaVariant = rng() < 0.5;
			const words = ["The", subj, verb, a, "and", b];
			if (commaVariant) {
				return {
					words,
					target: ["", "", ",", "", "", "."],
					accept: [[""], [""], [","], [""], [""], [".", "!"]],
					prompt: `The ${subj} performs three actions in sequence.`,
				};
			}
			return {
				words,
				target: ["", "", "", "", "", "."],
				accept: [[""], [""], [""], [""], [""], [".", "!"]],
				prompt: `The ${subj} ${verb} ${a} (noun, not verb) and ${b}.`,
			};
		},
	},
	{
		build: (rng) => {
			const a1 = ["Time", "Smoke", "Wind"][Math.floor(rng() * 3)];
			const a2 = ["flies", "rises", "moves"][Math.floor(rng() * 3)];
			const b1 = ["fruit", "dust", "snow"][Math.floor(rng() * 3)];
			const b2 = "settles";
			return {
				words: [a1, a2, "like", "an", "arrow", b1, "flies", "like", "a", "banana"],
				target: ["", "", "", "", ";", "", "", "", "", "."],
				accept: [[""], [""], [""], [""], [";", "."], [""], [""], [""], [""], [".", "!"]],
				prompt: `Two parallel observations: ${a1.toLowerCase()} ${a2}, ${b1} ${b2}.`,
			};
		},
	},
	{
		build: (rng) => {
			const title = ["doctor", "captain", "friend", "stranger"][Math.floor(rng() * 4)];
			return {
				words: ["Hello", title, "we", "meet", "again"],
				target: ["", ",", "", "", "."],
				accept: [[""], [","], [","], [""], [".", "!"]],
				prompt: `Greet ${title} directly, then comment.`,
			};
		},
	},
];

function makePuzzle(seed: number): Puzzle {
	const rng = mulberry32(seed);
	const t = TEMPLATES[Math.floor(rng() * TEMPLATES.length)];
	return t.build(rng);
}

let audioCtx: AudioContext | null = null;
function blip(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.04) {
	if (typeof window === "undefined") return;
	try {
		if (!audioCtx)
			audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
	} catch {
		return;
	}
	const ctx = audioCtx;
	if (!ctx) return;
	const o = ctx.createOscillator();
	const g = ctx.createGain();
	o.type = type;
	o.frequency.value = freq;
	g.gain.value = gain;
	g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
	o.connect(g).connect(ctx.destination);
	o.start();
	o.stop(ctx.currentTime + dur);
}
function tick() {
	blip(1800 + Math.random() * 400, 0.04, "square", 0.04);
}

export default function Game085_Punctuation() {
	const [seed, setSeed] = useState(() => dailySeed());
	const puzzle = useMemo(() => makePuzzle(seed), [seed]);
	const [marks, setMarks] = useState<string[]>(() => new Array(puzzle.target.length).fill(""));
	const [checked, setChecked] = useState(false);
	const [streak, setStreak] = useState(0);
	const [hintRevealed, setHintRevealed] = useState<number | null>(null);
	const [solvedCount, setSolvedCount] = useState(0);

	useEffect(() => {
		setMarks(new Array(puzzle.target.length).fill(""));
		setChecked(false);
		setHintRevealed(null);
	}, [puzzle]);

	const cycle = (i: number) => {
		const m = marks.slice();
		const cur = PUNCT_OPTIONS.indexOf(m[i]);
		m[i] = PUNCT_OPTIONS[(cur + 1) % PUNCT_OPTIONS.length];
		setMarks(m);
		if (checked) setChecked(false);
		tick();
	};

	const correct = useMemo(
		() => marks.length === puzzle.accept.length && marks.every((m, i) => puzzle.accept[i].includes(m)),
		[marks, puzzle],
	);

	const hint = () => {
		for (let i = 0; i < puzzle.accept.length; i++) {
			if (!puzzle.accept[i].includes(marks[i])) {
				const m = marks.slice();
				m[i] = puzzle.accept[i][0];
				setMarks(m);
				setHintRevealed(i);
				blip(660, 0.1, "sine", 0.05);
				return;
			}
		}
	};

	const check = () => {
		if (checked && correct) return;
		setChecked(true);
		if (correct) {
			setStreak(streak + 1);
			setSolvedCount(solvedCount + 1);
			blip(880, 0.18, "triangle", 0.07);
			setTimeout(() => blip(1320, 0.22, "triangle", 0.06), 100);
		} else {
			setStreak(0);
			blip(180, 0.2, "sawtooth", 0.05);
		}
	};

	const next = () => setSeed(Math.floor(Math.random() * 1e9));
	const reset = () => {
		setMarks(new Array(puzzle.target.length).fill(""));
		setChecked(false);
		setHintRevealed(null);
	};
	const daily = () => setSeed(dailySeed());

	return (
		<div style={{ fontFamily: "Georgia, serif", color: "#222", background: "#f4eedb", padding: 24, minHeight: 600 }}>
			<h2 style={{ margin: 0 }}>85. Punctuation</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
				Click the slots between words to cycle punctuation. Make the sentence mean the target. Seed #{seed} · Streak {streak} · Solved {solvedCount}
			</div>
			<div style={{ padding: 12, background: "#fff7e0", border: "1px solid #c0a060", marginBottom: 16 }}>
				<strong>Target meaning:</strong> {puzzle.prompt}
			</div>
			<div style={{ fontSize: 26, lineHeight: 1.8, display: "flex", flexWrap: "wrap", alignItems: "center" }}>
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
								border: hintRevealed === i ? "2px solid #c08020" : "1px dashed #888",
								background:
									checked && puzzle.accept[i]?.includes(marks[i])
										? "#c8f0c0"
										: checked
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
			<div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
				<button type="button" onClick={check} style={btn}>Check</button>
				<button type="button" onClick={hint} style={btn}>Hint</button>
				<button type="button" onClick={reset} style={btn}>Clear</button>
				<button type="button" onClick={next} style={btn}>New puzzle</button>
				<button type="button" onClick={daily} style={btn}>Daily</button>
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
