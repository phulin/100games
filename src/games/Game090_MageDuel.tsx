import { useState } from "react";

// Seven elements with rock-paper-scissors-ish chart (each beats 3, loses to 3).
const ELEMENTS = [
	"Fire",
	"Water",
	"Earth",
	"Air",
	"Lightning",
	"Ice",
	"Void",
] as const;
type Element = (typeof ELEMENTS)[number];

// beats[i] = list of indices that element i beats.
// We use the pattern: i beats (i+1), (i+2), (i+3) mod 7.
function beats(a: number, b: number): "a" | "b" | "tie" {
	if (a === b) return "tie";
	const diff = (b - a + 7) % 7;
	if (diff >= 1 && diff <= 3) return "a";
	return "b";
}

type RoundLog = {
	player: Element;
	ai: Element;
	outcome: "a" | "b" | "tie";
	cascade: number;
};

export default function Game090_MageDuel() {
	const [playerWins, setPlayerWins] = useState(0);
	const [aiWins, setAiWins] = useState(0);
	const [log, setLog] = useState<RoundLog[]>([]);
	const [over, setOver] = useState(false);

	// AI strategy: weighted by history of player picks; slight bias to counter.
	const aiPick = (): Element => {
		if (log.length === 0) {
			return ELEMENTS[Math.floor(Math.random() * 7)];
		}
		// Tally player picks
		const counts = new Array(7).fill(0);
		for (const r of log) counts[ELEMENTS.indexOf(r.player)]++;
		// Predict most likely player pick = argmax counts, with noise
		const noise = Math.random();
		let predicted = 0;
		if (noise < 0.6) {
			let best = -1;
			for (let i = 0; i < 7; i++) if (counts[i] > best) { best = counts[i]; predicted = i; }
		} else {
			predicted = Math.floor(Math.random() * 7);
		}
		// Choose element that beats predicted
		const choices: number[] = [];
		for (let i = 0; i < 7; i++) {
			if (beats(i, predicted) === "a") choices.push(i);
		}
		const pick = choices[Math.floor(Math.random() * choices.length)];
		return ELEMENTS[pick];
	};

	const playRound = (p: Element) => {
		if (over) return;
		const ai = aiPick();
		const pi = ELEMENTS.indexOf(p);
		const ai_i = ELEMENTS.indexOf(ai);
		const outcome = beats(pi, ai_i);
		// Cascade: if last round had same outcome, multiplier.
		const last = log[log.length - 1];
		const cascade = last && last.outcome === outcome && outcome !== "tie" ? 2 : 1;
		const r: RoundLog = { player: p, ai, outcome, cascade };
		const newLog = [...log, r];
		setLog(newLog);
		let pw = playerWins;
		let aw = aiWins;
		if (outcome === "a") pw += cascade;
		else if (outcome === "b") aw += cascade;
		setPlayerWins(pw);
		setAiWins(aw);
		if (pw >= 5 || aw >= 5 || newLog.length >= 9) {
			setOver(true);
		}
	};

	const reset = () => {
		setPlayerWins(0);
		setAiWins(0);
		setLog([]);
		setOver(false);
	};

	const elementColor = (e: Element) => {
		const map: Record<Element, string> = {
			Fire: "#e94560",
			Water: "#3060d0",
			Earth: "#8a6030",
			Air: "#a0c8e0",
			Lightning: "#f0d030",
			Ice: "#a0e0ff",
			Void: "#603080",
		};
		return map[e];
	};

	return (
		<div
			style={{
				fontFamily: "Georgia, serif",
				color: "#eee",
				background: "linear-gradient(135deg,#0a0518,#1a0830)",
				padding: 16,
				minHeight: 600,
			}}
		>
			<h2 style={{ margin: 0 }}>90. Mage Duel</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
				Best of 9. Pick an element; the AI picks at the same time. Each element
				beats the next three in the wheel. Cascades double points.
			</div>
			<div style={{ display: "flex", gap: 16 }}>
				<div
					style={{
						background: "#1a0830",
						padding: 12,
						borderRadius: 6,
						minWidth: 220,
					}}
				>
					<div>
						You: <strong>{playerWins}</strong>
					</div>
					<div>
						Adversary: <strong>{aiWins}</strong>
					</div>
					<div>Rounds: {log.length}/9</div>
					{over && (
						<div style={{ marginTop: 8, fontSize: 18 }}>
							{playerWins > aiWins
								? "Victory."
								: playerWins < aiWins
									? "Defeat."
									: "Draw."}
						</div>
					)}
					<button
						type="button"
						onClick={reset}
						style={{ ...btn, marginTop: 8 }}
					>
						Reset duel
					</button>
				</div>
				<div style={{ flex: 1 }}>
					<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
						{ELEMENTS.map((e) => (
							<button
								key={e}
								type="button"
								disabled={over}
								onClick={() => playRound(e)}
								style={{
									...btn,
									background: elementColor(e),
									color: "#111",
									minWidth: 80,
									fontSize: 16,
								}}
							>
								{e}
							</button>
						))}
					</div>
					<div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
						Wheel order: Fire → Water → Earth → Air → Lightning → Ice → Void →
						Fire. Each beats the next three.
					</div>
					<div style={{ marginTop: 12 }}>
						<div style={{ fontSize: 13, marginBottom: 4 }}>Combat log</div>
						<div
							style={{
								background: "#0e0420",
								border: "1px solid #553060",
								padding: 8,
								maxHeight: 240,
								overflow: "auto",
								fontSize: 13,
							}}
						>
							{log.length === 0 && (
								<div style={{ opacity: 0.6 }}>No rounds yet.</div>
							)}
							{log.map((r, i) => (
								<div key={i} style={{ marginBottom: 4 }}>
									#{i + 1}:{" "}
									<span style={{ color: elementColor(r.player) }}>
										{r.player}
									</span>{" "}
									vs{" "}
									<span style={{ color: elementColor(r.ai) }}>{r.ai}</span> —{" "}
									{r.outcome === "tie"
										? "Tie"
										: r.outcome === "a"
											? `You win${r.cascade > 1 ? ` ×${r.cascade} cascade!` : ""}`
											: `You lose${r.cascade > 1 ? ` ×${r.cascade} cascade!` : ""}`}
								</div>
							))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "8px 14px",
	background: "#553060",
	color: "#fff",
	border: "1px solid #885090",
	borderRadius: 4,
	cursor: "pointer",
	fontFamily: "Georgia, serif",
};
