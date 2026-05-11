import { useEffect, useState } from "react";

// Game 78 — Tally
// Herd of animals flashes for half a second. Estimate count.

const ANIMALS = ["🐑", "🐄", "🐐", "🦌", "🐓"];

type Round = { animal: string; count: number; positions: Array<{ x: number; y: number }> };

function makeRound(): Round {
	const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
	const count = 5 + Math.floor(Math.random() * 90);
	const positions: Array<{ x: number; y: number }> = [];
	for (let i = 0; i < count; i++) {
		positions.push({
			x: 40 + Math.random() * 780,
			y: 100 + Math.random() * 380,
		});
	}
	return { animal, count, positions };
}

export default function Game078_Tally() {
	const [round, setRound] = useState<Round>(() => makeRound());
	const [phase, setPhase] = useState<"ready" | "flash" | "guess" | "result">("ready");
	const [guess, setGuess] = useState("");
	const [history, setHistory] = useState<Array<{ guess: number; actual: number }>>([]);
	const [stats, setStats] = useState({ n: 0, meanErr: 0 });

	useEffect(() => {
		if (phase !== "flash") return;
		const t = setTimeout(() => setPhase("guess"), 500);
		return () => clearTimeout(t);
	}, [phase]);

	const start = () => {
		setRound(makeRound());
		setGuess("");
		setPhase("flash");
	};

	const submit = () => {
		const g = parseInt(guess);
		if (isNaN(g)) return;
		const h = [{ guess: g, actual: round.count }, ...history].slice(0, 12);
		setHistory(h);
		const errs = h.map((r) => Math.abs(r.guess - r.actual) / r.actual);
		const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
		setStats({ n: h.length, meanErr: mean });
		setPhase("result");
	};

	const accuracyScore = stats.n > 0 ? Math.max(0, Math.round((1 - stats.meanErr) * 100)) : 0;

	return (
		<div
			style={{
				width: 900,
				height: 600,
				background: "linear-gradient(180deg,#6a9a3a,#3a6a25)",
				color: "#fff",
				fontFamily: "system-ui, sans-serif",
				position: "relative",
				userSelect: "none",
				overflow: "hidden",
			}}
		>
			<div style={{ position: "absolute", top: 8, left: 12, zIndex: 10 }}>
				<b>Tally</b> — A herd flashes briefly. Estimate the count.
			</div>
			<div style={{ position: "absolute", top: 8, right: 12, zIndex: 10, textAlign: "right" }}>
				Rounds: {stats.n} · Accuracy: {accuracyScore}%
			</div>

			{phase === "flash" && (
				<>
					{round.positions.map((p, i) => (
						<div
							key={i}
							style={{
								position: "absolute",
								left: p.x,
								top: p.y,
								fontSize: 22,
							}}
						>
							{round.animal}
						</div>
					))}
				</>
			)}

			{phase === "ready" && (
				<div style={{ textAlign: "center", marginTop: 220 }}>
					<button
						onClick={start}
						style={{
							fontSize: 28,
							padding: "14px 40px",
							cursor: "pointer",
							borderRadius: 10,
							border: "none",
							background: "#fff",
							color: "#3a6a25",
							fontWeight: "bold",
						}}
					>
						Begin
					</button>
					<div style={{ marginTop: 12 }}>Click to flash the herd.</div>
				</div>
			)}

			{phase === "guess" && (
				<div style={{ textAlign: "center", marginTop: 200 }}>
					<div style={{ fontSize: 24 }}>How many {round.animal}?</div>
					<input
						autoFocus
						value={guess}
						onChange={(e) => setGuess(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && submit()}
						style={{
							fontSize: 28,
							padding: "8px 12px",
							marginTop: 12,
							width: 100,
							textAlign: "center",
						}}
					/>
					<div>
						<button onClick={submit} style={{ marginTop: 12, padding: "8px 20px", fontSize: 14 }}>
							Submit
						</button>
					</div>
				</div>
			)}

			{phase === "result" && (
				<div style={{ textAlign: "center", marginTop: 180 }}>
					<div style={{ fontSize: 32 }}>
						{round.animal} Actual: <b>{round.count}</b>
					</div>
					<div style={{ fontSize: 22, marginTop: 8 }}>
						You guessed: <b>{history[0].guess}</b> (off by{" "}
						{Math.abs(history[0].guess - round.count)})
					</div>
					<button onClick={start} style={{ marginTop: 16, padding: "10px 24px", fontSize: 16 }}>
						Next round
					</button>
				</div>
			)}

			<div
				style={{
					position: "absolute",
					bottom: 12,
					left: 12,
					right: 12,
					fontSize: 12,
					background: "rgba(0,0,0,0.3)",
					padding: 6,
					borderRadius: 6,
				}}
			>
				<b>History:</b>{" "}
				{history.map((r, i) => (
					<span key={i} style={{ marginRight: 10 }}>
						{r.guess}/{r.actual}
					</span>
				))}
			</div>
		</div>
	);
}
