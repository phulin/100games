import { useEffect, useMemo, useRef, useState } from "react";

// Tune a radio dial to find hidden stations. Each station, when tuned cleanly,
// reveals a clue. Combine all clues to answer the riddle.
//
// Puzzles are procedurally generated from a seed: we keep a small pool of
// THINGS (each one a name plus a stock of self-referential clues), then the
// generator picks which subject, which N clues, scatters them across the band
// and assigns unique tones. The actual riddle for any given seed is computed,
// not hard-coded. A daily seed makes the puzzle shared across visitors.

// ---------- seeded RNG ----------
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
function hashSeed(s: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

type Station = { freq: number; clue: string; tone: number };
type Puzzle = {
	question: string;
	answer: string;
	stations: Station[];
	seed: number;
};

// "Things" are subjects to be guessed. Each has a stock of plausible
// self-referential clues. This is reference vocabulary; the actual puzzle is
// assembled procedurally from the seed.
type Thing = { name: string; clues: string[] };
const THINGS: Thing[] = [
	{
		name: "ocean",
		clues: [
			"I am wide.",
			"I am salty.",
			"I have tides.",
			"Whales live in me.",
			"Ships cross me.",
			"I touch every shore.",
		],
	},
	{
		name: "moon",
		clues: [
			"I orbit a world.",
			"I am cratered.",
			"I shine at night.",
			"Tides follow me.",
			"I am sometimes full.",
			"Footprints rest on me.",
		],
	},
	{
		name: "clock",
		clues: [
			"I have two hands but no fingers.",
			"I tick.",
			"I keep time.",
			"Twelve marks on my face.",
			"I never sleep.",
			"I rule the trains.",
		],
	},
	{
		name: "river",
		clues: [
			"I run but have no legs.",
			"I am fresh, not salty.",
			"I find the sea.",
			"Fish swim in me.",
			"I cut through stone.",
			"Bridges cross my back.",
		],
	},
	{
		name: "mirror",
		clues: [
			"I show you yourself.",
			"I am flat and silvered.",
			"I lie, left for right.",
			"I break to bad luck.",
			"I hang on walls.",
			"I see no light of my own.",
		],
	},
	{
		name: "candle",
		clues: [
			"I shrink as I work.",
			"I have a wick.",
			"I am born of wax.",
			"I dance in drafts.",
			"I burn from one end.",
			"I keep vigil.",
		],
	},
	{
		name: "book",
		clues: [
			"I have a spine but no bones.",
			"I am bound in pages.",
			"I speak without voice.",
			"I open and close.",
			"I am shelved.",
			"My words don't move.",
		],
	},
	{
		name: "wind",
		clues: [
			"I am felt, not seen.",
			"I move the leaves.",
			"I have no body.",
			"I howl and whisper.",
			"I fill sails.",
			"I bring weather.",
		],
	},
	{
		name: "egg",
		clues: [
			"I have a shell.",
			"I break only once.",
			"I am laid, not made.",
			"I roll but don't bounce.",
			"I hide a life.",
			"I cook in many ways.",
		],
	},
	{
		name: "shadow",
		clues: [
			"I follow you everywhere in sun.",
			"I have no weight.",
			"I lengthen at dusk.",
			"I copy your shape.",
			"I vanish in the dark.",
			"I lie on the ground.",
		],
	},
];

const MIN_F = 87;
const MAX_F = 108;

function generatePuzzle(seed: number, stationCount: number): Puzzle {
	const rng = mulberry32(seed);
	const thing = THINGS[Math.floor(rng() * THINGS.length)];
	const n = Math.min(stationCount, thing.clues.length);

	const clueIdx: number[] = [];
	const remaining = thing.clues.map((_c, i) => i);
	for (let i = 0; i < n; i++) {
		const j = Math.floor(rng() * remaining.length);
		clueIdx.push(remaining[j]);
		remaining.splice(j, 1);
	}

	const usable = MAX_F - MIN_F - 2;
	const gap = usable / n;
	const freqs: number[] = [];
	for (let i = 0; i < n; i++) {
		const center = MIN_F + 1 + gap * (i + 0.5);
		const jitter = (rng() - 0.5) * Math.min(gap * 0.5, 1.6);
		freqs.push(Math.round((center + jitter) * 10) / 10);
	}

	const tonePool = [196, 233, 261, 294, 329, 349, 392, 440, 494, 523, 587, 659];
	for (let i = tonePool.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[tonePool[i], tonePool[j]] = [tonePool[j], tonePool[i]];
	}

	const stations: Station[] = clueIdx.map((ci, i) => ({
		freq: freqs[i],
		clue: thing.clues[ci],
		tone: tonePool[i % tonePool.length],
	}));

	return { question: "What am I?", answer: thing.name, stations, seed };
}

function dailySeed(): number {
	const d = new Date();
	const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
	return hashSeed("freq-daily:" + key);
}

const BEST_KEY = "freqhunt_best_by_seed";
function loadBest(): Record<string, number> {
	try {
		return JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
	} catch {
		return {};
	}
}
function saveBest(map: Record<string, number>) {
	try {
		localStorage.setItem(BEST_KEY, JSON.stringify(map));
	} catch {
		/* ignore */
	}
}

export default function FrequencyHunt() {
	const [seed, setSeed] = useState<number>(() => dailySeed());
	const [seedInput, setSeedInput] = useState("");
	const [stationCount, setStationCount] = useState(4);
	const puzzle = useMemo(
		() => generatePuzzle(seed, stationCount),
		[seed, stationCount],
	);

	const [freq, setFreq] = useState((MIN_F + MAX_F) / 2);
	const [found, setFound] = useState<Set<number>>(new Set());
	const [guess, setGuess] = useState("");
	const [result, setResult] = useState<"" | "win" | "lose">("");
	const [score, setScore] = useState(0);
	const [bestMap, setBestMap] = useState<Record<string, number>>(() =>
		loadBest(),
	);

	const audioRef = useRef<AudioContext | null>(null);
	const oscRef = useRef<OscillatorNode | null>(null);
	const gainRef = useRef<GainNode | null>(null);
	const noiseRef = useRef<AudioBufferSourceNode | null>(null);
	const noiseGainRef = useRef<GainNode | null>(null);

	const ensureAudio = () => {
		if (audioRef.current) return audioRef.current;
		const Ctor =
			(window as unknown as { AudioContext: typeof AudioContext })
				.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext;
		const ctx = new Ctor();
		audioRef.current = ctx;

		const osc = ctx.createOscillator();
		osc.type = "sine";
		osc.frequency.value = 440;
		const g = ctx.createGain();
		g.gain.value = 0;
		osc.connect(g);
		g.connect(ctx.destination);
		osc.start();
		oscRef.current = osc;
		gainRef.current = g;

		const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
		const data = buf.getChannelData(0);
		const r = mulberry32(0xc0ffee);
		for (let i = 0; i < data.length; i++) data[i] = (r() * 2 - 1) * 0.5;
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.loop = true;
		const ng = ctx.createGain();
		ng.gain.value = 0.0;
		src.connect(ng);
		ng.connect(ctx.destination);
		src.start();
		noiseRef.current = src;
		noiseGainRef.current = ng;
		return ctx;
	};

	useEffect(() => {
		return () => {
			audioRef.current?.close();
		};
	}, []);

	useEffect(() => {
		setFreq((MIN_F + MAX_F) / 2);
		setFound(new Set());
		setGuess("");
		setResult("");
	}, [puzzle]);

	const [strength, setStrength] = useState(0);

	useEffect(() => {
		const ctx = audioRef.current;
		let bestDist = 999;
		let bestStation: Station | null = null;
		for (const s of puzzle.stations) {
			const d = Math.abs(s.freq - freq);
			if (d < bestDist) {
				bestDist = d;
				bestStation = s;
			}
		}
		const sigma = 0.35;
		const str = bestStation
			? Math.exp(-(bestDist * bestDist) / (2 * sigma * sigma))
			: 0;
		setStrength(str);
		if (ctx && oscRef.current && gainRef.current && noiseGainRef.current) {
			if (bestStation) oscRef.current.frequency.value = bestStation.tone;
			gainRef.current.gain.setTargetAtTime(str * 0.18, ctx.currentTime, 0.05);
			noiseGainRef.current.gain.setTargetAtTime(
				(1 - str) * 0.04,
				ctx.currentTime,
				0.05,
			);
		}
	}, [freq, puzzle]);

	const tunedStation = useMemo(() => {
		// Pick the *closest* station within tolerance, not whichever one
		// happens to come first in array order. Without this, tuning
		// between two nearby stations could lock onto the wrong clue.
		let best: Station | null = null;
		let bestDist = 0.25;
		for (const s of puzzle.stations) {
			const d = Math.abs(s.freq - freq);
			if (d < bestDist) {
				bestDist = d;
				best = s;
			}
		}
		return best;
	}, [freq, puzzle]);

	useEffect(() => {
		if (tunedStation && !found.has(tunedStation.freq)) {
			const next = new Set(found);
			next.add(tunedStation.freq);
			setFound(next);
		}
	}, [tunedStation, found]);

	const submitGuess = () => {
		ensureAudio();
		// Once the puzzle is solved, ignore further submissions. Without
		// this guard, clicking Answer repeatedly after winning would keep
		// awarding `gained` points each time.
		if (result === "win") return;
		if (guess.trim().toLowerCase() === puzzle.answer) {
			setResult("win");
			const gained = 50 + found.size * 10;
			setScore((s) => s + gained);
			const key = String(puzzle.seed);
			if ((bestMap[key] ?? 0) < gained) {
				const m = { ...bestMap, [key]: gained };
				setBestMap(m);
				saveBest(m);
			}
		} else {
			setResult("lose");
		}
	};

	const scanToNearest = () => {
		let bestDist = 999;
		let bestStation: Station | null = null;
		for (const s of puzzle.stations) {
			if (found.has(s.freq)) continue;
			const d = Math.abs(s.freq - freq);
			if (d < bestDist) {
				bestDist = d;
				bestStation = s;
			}
		}
		if (!bestStation) return;
		setFreq(bestStation.freq);
	};

	const newRandom = () => setSeed((Math.random() * 1e9) >>> 0);
	const newDaily = () => setSeed(dailySeed());
	const applySeed = () => {
		const s = seedInput.trim();
		if (!s) return;
		setSeed(hashSeed(s));
	};

	const ticks: React.ReactNode[] = [];
	for (let f = MIN_F; f <= MAX_F; f++)
		ticks.push(
			<div
				key={f}
				style={{
					position: "absolute",
					left: `${((f - MIN_F) / (MAX_F - MIN_F)) * 100}%`,
					top: 0,
					height: 18,
					width: 1,
					background: "#999",
				}}
			>
				<span
					style={{
						position: "absolute",
						top: 20,
						left: -10,
						fontSize: 10,
						color: "#bbb",
					}}
				>
					{f}
				</span>
			</div>,
		);

	const foundMarks = Array.from(found).map((f) => (
		<div
			key={`fm-${f}`}
			style={{
				position: "absolute",
				left: `${((f - MIN_F) / (MAX_F - MIN_F)) * 100}%`,
				top: -2,
				width: 2,
				height: 64,
				background: "rgba(155,204,112,0.45)",
				pointerEvents: "none",
			}}
		/>
	));

	const bestKey = String(puzzle.seed);
	const bestForSeed = bestMap[bestKey] ?? 0;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#15171a",
				color: "#e2e2e2",
				fontFamily: "monospace",
				padding: 20,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				overflow: "auto",
			}}
			onClick={() => ensureAudio()}
		>
			<h2 style={{ margin: 0 }}>Frequency Hunt</h2>
			<div style={{ fontSize: 12, opacity: 0.7 }}>
				Drag the dial to tune in stations. Click anywhere to enable audio.
			</div>
			<div
				style={{
					marginTop: 30,
					width: 700,
					maxWidth: "100%",
					position: "relative",
				}}
			>
				<div
					style={{
						position: "relative",
						height: 60,
						background: "#222",
						border: "1px solid #444",
						borderRadius: 6,
					}}
				>
					{ticks}
					{foundMarks}
					<div
						style={{
							position: "absolute",
							left: `calc(${((freq - MIN_F) / (MAX_F - MIN_F)) * 100}% - 2px)`,
							top: -8,
							width: 4,
							height: 60,
							background: "#ff8c3a",
							boxShadow: "0 0 8px #ff8c3a",
						}}
					/>
				</div>
				<input
					type="range"
					min={MIN_F * 100}
					max={MAX_F * 100}
					value={Math.round(freq * 100)}
					onChange={(e) => setFreq(Number(e.target.value) / 100)}
					style={{ width: "100%", marginTop: 24 }}
				/>
				<div style={{ textAlign: "center", fontSize: 22, marginTop: 4 }}>
					{freq.toFixed(1)} MHz
				</div>
				<div
					style={{
						marginTop: 4,
						height: 6,
						background: "#222",
						borderRadius: 3,
						overflow: "hidden",
					}}
				>
					<div
						style={{
							width: `${Math.round(strength * 100)}%`,
							height: "100%",
							background:
								strength > 0.7
									? "#9bcc70"
									: strength > 0.3
										? "#ffd28c"
										: "#666",
							transition: "width 80ms linear",
						}}
					/>
				</div>
			</div>
			<div
				style={{
					minHeight: 40,
					marginTop: 12,
					fontStyle: "italic",
					color: tunedStation ? "#ffd28c" : "#888",
				}}
			>
				{tunedStation ? `"${tunedStation.clue}"` : "...static..."}
			</div>
			<div style={{ marginTop: 4, fontSize: 13 }}>
				Stations found: {found.size}/{puzzle.stations.length}
				<button
					type="button"
					onClick={scanToNearest}
					style={{
						marginLeft: 10,
						padding: "2px 8px",
						background: "#333",
						color: "#fff",
						border: "1px solid #555",
						borderRadius: 3,
						cursor: "pointer",
						fontSize: 12,
					}}
				>
					Scan
				</button>
			</div>
			<div style={{ marginTop: 14 }}>
				<div style={{ fontSize: 14, marginBottom: 6 }}>
					Riddle: <b>{puzzle.question}</b>
				</div>
				<input
					type="text"
					value={guess}
					onChange={(e) => setGuess(e.target.value)}
					placeholder="your answer"
					style={{
						padding: "6px 8px",
						background: "#222",
						color: "#fff",
						border: "1px solid #555",
						borderRadius: 3,
					}}
				/>
				<button
					type="button"
					onClick={submitGuess}
					style={{
						marginLeft: 8,
						padding: "6px 12px",
						background: "#ff8c3a",
						color: "#000",
						border: "none",
						borderRadius: 3,
						cursor: "pointer",
					}}
				>
					Answer
				</button>
				<button
					type="button"
					onClick={newRandom}
					style={{
						marginLeft: 8,
						padding: "6px 12px",
						background: "#333",
						color: "#fff",
						border: "1px solid #555",
						borderRadius: 3,
						cursor: "pointer",
					}}
				>
					New
				</button>
				<button
					type="button"
					onClick={newDaily}
					style={{
						marginLeft: 8,
						padding: "6px 12px",
						background: "#333",
						color: "#fff",
						border: "1px solid #555",
						borderRadius: 3,
						cursor: "pointer",
					}}
				>
					Daily
				</button>
			</div>
			<div
				style={{
					marginTop: 8,
					display: "flex",
					gap: 6,
					alignItems: "center",
					fontSize: 12,
					flexWrap: "wrap",
					justifyContent: "center",
				}}
			>
				<input
					type="text"
					value={seedInput}
					onChange={(e) => setSeedInput(e.target.value)}
					placeholder="custom seed"
					style={{
						padding: "4px 6px",
						background: "#222",
						color: "#fff",
						border: "1px solid #555",
						borderRadius: 3,
						fontFamily: "inherit",
					}}
				/>
				<button
					type="button"
					onClick={applySeed}
					style={{
						padding: "4px 10px",
						background: "#333",
						color: "#fff",
						border: "1px solid #555",
						borderRadius: 3,
						cursor: "pointer",
					}}
				>
					Use seed
				</button>
				Stations:
				{[3, 4, 5, 6].map((n) => (
					<button
						key={n}
						type="button"
						onClick={() => setStationCount(n)}
						style={{
							padding: "2px 8px",
							background: stationCount === n ? "#ff8c3a" : "#333",
							color: stationCount === n ? "#000" : "#fff",
							border: "1px solid #555",
							borderRadius: 3,
							cursor: "pointer",
						}}
					>
						{n}
					</button>
				))}
			</div>
			{result === "win" && (
				<div style={{ marginTop: 10, color: "#9bcc70" }}>Correct!</div>
			)}
			{result === "lose" && (
				<div style={{ marginTop: 10, color: "#cc7070" }}>
					Not quite. Keep tuning.
				</div>
			)}
			<div style={{ marginTop: 10, fontSize: 13 }}>
				Score: {score} · Best for this seed: {bestForSeed} · Seed:{" "}
				<code>{puzzle.seed.toString(36)}</code>
			</div>
		</div>
	);
}
