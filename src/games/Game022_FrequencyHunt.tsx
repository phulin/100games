import { useEffect, useMemo, useRef, useState } from "react";

// Tune a radio dial to find hidden stations. Each station, when tuned cleanly,
// reveals a clue. Combine all clues to answer the riddle.

type Station = { freq: number; clue: string; tone: number };
type Puzzle = { question: string; answer: string; stations: Station[] };

const PUZZLES: Puzzle[] = [
	{
		question: "What am I?",
		answer: "ocean",
		stations: [
			{ freq: 91, clue: "I am wide.", tone: 220 },
			{ freq: 96, clue: "I am salty.", tone: 330 },
			{ freq: 101, clue: "I have tides.", tone: 440 },
			{ freq: 106, clue: "Whales live in me.", tone: 550 },
		],
	},
	{
		question: "What am I?",
		answer: "moon",
		stations: [
			{ freq: 89, clue: "I orbit the earth.", tone: 196 },
			{ freq: 94, clue: "I am cratered.", tone: 261 },
			{ freq: 100, clue: "I shine at night.", tone: 329 },
			{ freq: 105, clue: "Tides follow me.", tone: 392 },
		],
	},
	{
		question: "What am I?",
		answer: "clock",
		stations: [
			{ freq: 88, clue: "I have two hands.", tone: 174 },
			{ freq: 93, clue: "I tick.", tone: 233 },
			{ freq: 99, clue: "I keep time.", tone: 294 },
			{ freq: 104, clue: "Twelve marks on my face.", tone: 349 },
		],
	},
];

const MIN_F = 87;
const MAX_F = 108;

export default function FrequencyHunt() {
	const [pIdx, setPIdx] = useState(0);
	const puzzle = PUZZLES[pIdx];
	const [freq, setFreq] = useState((MIN_F + MAX_F) / 2);
	const [found, setFound] = useState<Set<number>>(new Set());
	const [guess, setGuess] = useState("");
	const [result, setResult] = useState<"" | "win" | "lose">("");
	const [score, setScore] = useState(0);

	const audioRef = useRef<AudioContext | null>(null);
	const oscRef = useRef<OscillatorNode | null>(null);
	const gainRef = useRef<GainNode | null>(null);
	const noiseRef = useRef<AudioBufferSourceNode | null>(null);
	const noiseGainRef = useRef<GainNode | null>(null);

	const ensureAudio = () => {
		if (audioRef.current) return audioRef.current;
		const Ctor =
			(window as unknown as { AudioContext: typeof AudioContext }).AudioContext ||
			(
				window as unknown as {
					webkitAudioContext: typeof AudioContext;
				}
			).webkitAudioContext;
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

		// pink-ish noise
		const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
		const data = buf.getChannelData(0);
		for (let i = 0; i < data.length; i++)
			data[i] = (Math.random() * 2 - 1) * 0.5;
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

	// update sound when freq changes
	useEffect(() => {
		const ctx = audioRef.current;
		if (!ctx || !oscRef.current || !gainRef.current || !noiseGainRef.current)
			return;
		// find nearest station and a "tunedness"
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
		const strength = bestStation
			? Math.exp(-(bestDist * bestDist) / (2 * sigma * sigma))
			: 0;
		if (bestStation) oscRef.current.frequency.value = bestStation.tone;
		gainRef.current.gain.setTargetAtTime(strength * 0.18, ctx.currentTime, 0.05);
		noiseGainRef.current.gain.setTargetAtTime(
			(1 - strength) * 0.04,
			ctx.currentTime,
			0.05,
		);
	}, [freq, puzzle]);

	const tunedStation = useMemo(() => {
		for (const s of puzzle.stations) {
			if (Math.abs(s.freq - freq) < 0.25) return s;
		}
		return null;
	}, [freq, puzzle]);

	useEffect(() => {
		if (tunedStation && !found.has(tunedStation.freq)) {
			const next = new Set(found);
			next.add(tunedStation.freq);
			setFound(next);
		}
	}, [tunedStation, found]);

	const submitGuess = () => {
		if (guess.trim().toLowerCase() === puzzle.answer) {
			setResult("win");
			setScore((s) => s + 50 + found.size * 10);
		} else {
			setResult("lose");
		}
	};

	const nextPuzzle = () => {
		setPIdx((i) => (i + 1) % PUZZLES.length);
		setFreq((MIN_F + MAX_F) / 2);
		setFound(new Set());
		setGuess("");
		setResult("");
	};

	// dial visual
	const ticks = [];
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
					<div
						style={{
							position: "absolute",
							left: `calc(${
								((freq - MIN_F) / (MAX_F - MIN_F)) * 100
							}% - 2px)`,
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
			<div style={{ marginTop: 14, fontSize: 13 }}>
				Stations found: {found.size}/{puzzle.stations.length}
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
					onClick={nextPuzzle}
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
			</div>
			{result === "win" && (
				<div style={{ marginTop: 10, color: "#9bcc70" }}>Correct!</div>
			)}
			{result === "lose" && (
				<div style={{ marginTop: 10, color: "#cc7070" }}>
					Not quite. Keep tuning.
				</div>
			)}
			<div style={{ marginTop: 10, fontSize: 13 }}>Score: {score}</div>
		</div>
	);
}
