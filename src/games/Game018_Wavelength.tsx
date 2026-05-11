import { useMemo, useState } from "react";

type Spectrum = { left: string; right: string; clues: { word: string; value: number }[] };

const SPECTRA: Spectrum[] = [
	{
		left: "cold",
		right: "hot",
		clues: [
			{ word: "ice", value: 5 },
			{ word: "snow", value: 12 },
			{ word: "cool breeze", value: 30 },
			{ word: "room temperature", value: 50 },
			{ word: "summer day", value: 65 },
			{ word: "sauna", value: 80 },
			{ word: "lava", value: 95 },
			{ word: "campfire", value: 75 },
		],
	},
	{
		left: "quiet",
		right: "loud",
		clues: [
			{ word: "whisper", value: 12 },
			{ word: "library", value: 20 },
			{ word: "conversation", value: 45 },
			{ word: "vacuum cleaner", value: 65 },
			{ word: "rock concert", value: 90 },
			{ word: "jet engine", value: 97 },
			{ word: "alarm clock", value: 70 },
		],
	},
	{
		left: "soft",
		right: "hard",
		clues: [
			{ word: "pillow", value: 8 },
			{ word: "marshmallow", value: 5 },
			{ word: "rubber", value: 40 },
			{ word: "wood", value: 65 },
			{ word: "steel", value: 90 },
			{ word: "diamond", value: 98 },
			{ word: "cheese", value: 25 },
		],
	},
	{
		left: "boring",
		right: "exciting",
		clues: [
			{ word: "watching paint dry", value: 3 },
			{ word: "tax forms", value: 8 },
			{ word: "a walk in the park", value: 35 },
			{ word: "skydiving", value: 92 },
			{ word: "roller coaster", value: 85 },
			{ word: "reading", value: 30 },
		],
	},
	{
		left: "cheap",
		right: "expensive",
		clues: [
			{ word: "penny candy", value: 5 },
			{ word: "lunch", value: 25 },
			{ word: "new car", value: 70 },
			{ word: "mansion", value: 95 },
			{ word: "yacht", value: 92 },
			{ word: "coffee", value: 20 },
		],
	},
];

function pickRound(seed: number) {
	let s = seed;
	const rng = () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
	const spec = SPECTRA[Math.floor(rng() * SPECTRA.length)];
	const clue = spec.clues[Math.floor(rng() * spec.clues.length)];
	const noise = (rng() - 0.5) * 10;
	const target = Math.max(2, Math.min(98, clue.value + noise));
	return { spec, clue: clue.word, target };
}

export default function Game018_Wavelength() {
	const [roundSeed, setRoundSeed] = useState(() => Date.now());
	const round = useMemo(() => pickRound(roundSeed), [roundSeed]);
	const [guess, setGuess] = useState(50);
	const [revealed, setRevealed] = useState(false);
	const [totalScore, setTotalScore] = useState(0);
	const [rounds, setRounds] = useState(0);

	function reveal() {
		const diff = Math.abs(guess - round.target);
		let pts = 0;
		if (diff < 5) pts = 4;
		else if (diff < 10) pts = 3;
		else if (diff < 20) pts = 2;
		else if (diff < 30) pts = 1;
		setTotalScore(totalScore + pts);
		setRounds(rounds + 1);
		setRevealed(true);
	}

	function next() {
		setRoundSeed(Math.floor(Math.random() * 1e9));
		setRevealed(false);
		setGuess(50);
	}

	return (
		<div style={{ background: "#0e1226", color: "#eee", padding: 16, fontFamily: "system-ui", minHeight: 600 }}>
			<h2 style={{ margin: 0 }}>Wavelength</h2>
			<p style={{ opacity: 0.7, margin: "4px 0 12px" }}>
				Where on the spectrum does the clue point? Slide to your guess and reveal.
			</p>
			<div style={{ marginBottom: 12 }}>
				Score: {totalScore} / {rounds * 4}
			</div>
			<div style={{ fontSize: 28, marginBottom: 16, textAlign: "center" }}>"{round.clue}"</div>
			<div style={{ position: "relative", height: 80, margin: "0 40px" }}>
				<div
					style={{
						position: "absolute",
						top: 30,
						left: 0,
						right: 0,
						height: 20,
						background: "linear-gradient(90deg, #2a6ec7, #c72a4f)",
						borderRadius: 10,
					}}
				/>
				{revealed && (
					<div
						style={{
							position: "absolute",
							top: 18,
							left: `${round.target}%`,
							width: 3,
							height: 44,
							background: "#7fc97f",
							transform: "translateX(-1.5px)",
						}}
					/>
				)}
				<div
					style={{
						position: "absolute",
						top: 12,
						left: `${guess}%`,
						width: 4,
						height: 56,
						background: "#ffd166",
						transform: "translateX(-2px)",
					}}
				/>
				<input
					type="range"
					min={0}
					max={100}
					step={0.5}
					value={guess}
					disabled={revealed}
					onChange={(e) => setGuess(parseFloat(e.target.value))}
					style={{ position: "absolute", top: 30, left: 0, right: 0, width: "100%", opacity: 0 }}
				/>
				<div style={{ position: "absolute", top: 60, left: 0 }}>{round.spec.left}</div>
				<div style={{ position: "absolute", top: 60, right: 0 }}>{round.spec.right}</div>
			</div>
			<div style={{ textAlign: "center", marginTop: 20 }}>
				{!revealed ? (
					<button onClick={reveal} style={{ fontSize: 18, padding: "6px 18px" }}>
						Reveal
					</button>
				) : (
					<>
						<div style={{ marginBottom: 12 }}>
							Target was {round.target.toFixed(0)}, you guessed {guess.toFixed(0)}. Distance: {Math.abs(guess - round.target).toFixed(0)}
						</div>
						<button onClick={next} style={{ fontSize: 18, padding: "6px 18px" }}>
							Next clue
						</button>
					</>
				)}
			</div>
		</div>
	);
}
