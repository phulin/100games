import { useMemo, useState } from "react";

// Split a pile of resources. AI has visible weights (e.g., apples=3, pears=-1)
// and a hidden patience meter. You alternate offers. AI rejects if total value
// to it < its current threshold (decays each round). Player tries to keep most
// value for themselves while still getting AI to accept.

type Resource = { name: string; emoji: string; total: number };
type Offer = Record<string, number>; // resource name → how many to AI

const RESOURCES: Resource[] = [
	{ name: "apples", emoji: "🍎", total: 6 },
	{ name: "pears", emoji: "🍐", total: 6 },
	{ name: "berries", emoji: "🫐", total: 6 },
	{ name: "nuts", emoji: "🌰", total: 6 },
];

export default function TheNegotiator() {
	const [aiWeights] = useState<Record<string, number>>(() => {
		const w: Record<string, number> = {};
		for (const r of RESOURCES) {
			// visible weights: -2 to +4
			w[r.name] = Math.floor(Math.random() * 7) - 2;
		}
		return w;
	});
	const playerWeights = useMemo<Record<string, number>>(() => {
		const w: Record<string, number> = {};
		for (const r of RESOURCES) {
			w[r.name] = Math.floor(Math.random() * 5) + 1;
		}
		return w;
	}, []);
	const [patience, setPatience] = useState<number>(() => 10 + Math.floor(Math.random() * 8));
	const [round, setRound] = useState(1);
	const [aiThreshold, setAiThreshold] = useState<number>(20);
	const [offer, setOffer] = useState<Offer>(() => {
		const o: Offer = {};
		for (const r of RESOURCES) o[r.name] = Math.floor(r.total / 2);
		return o;
	});
	const [log, setLog] = useState<string[]>([]);
	const [result, setResult] = useState<"" | "accepted" | "walked">("");
	const [playerScore, setPlayerScore] = useState(0);

	const aiValue = (o: Offer) =>
		RESOURCES.reduce((acc, r) => acc + o[r.name] * (aiWeights[r.name] ?? 0), 0);
	const playerValue = (o: Offer) =>
		RESOURCES.reduce(
			(acc, r) => acc + (r.total - o[r.name]) * playerWeights[r.name],
			0,
		);

	const propose = () => {
		if (result) return;
		const av = aiValue(offer);
		if (av >= aiThreshold) {
			setResult("accepted");
			const pv = playerValue(offer);
			setPlayerScore(pv);
			setLog((l) => [
				`Round ${round}: AI accepts (their value ${av} ≥ ${aiThreshold}).`,
				...l,
			]);
		} else {
			// AI rejects, patience drops, threshold lowers
			const newPat = patience - 1;
			const newThresh = Math.max(0, aiThreshold - 2);
			setPatience(newPat);
			setAiThreshold(newThresh);
			setLog((l) => [
				`Round ${round}: AI rejects (their value ${av} < ${aiThreshold}). They sigh.`,
				...l,
			]);
			setRound(round + 1);
			if (newPat <= 0) {
				setResult("walked");
				setLog((l) => [
					"AI walks away from the table. You get nothing.",
					...l,
				]);
				setPlayerScore(0);
			}
		}
	};

	const adjust = (name: string, delta: number) => {
		if (result) return;
		const r = RESOURCES.find((x) => x.name === name);
		if (!r) return;
		const cur = offer[name];
		const next = Math.max(0, Math.min(r.total, cur + delta));
		setOffer({ ...offer, [name]: next });
	};

	const reset = () => {
		window.location.reload();
	};

	const pv = playerValue(offer);
	const av = aiValue(offer);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "linear-gradient(180deg,#1d1a26,#0a0a14)",
				color: "#e0d8f0",
				fontFamily: "Georgia, serif",
				padding: 20,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
			}}
		>
			<h2 style={{ margin: 0 }}>The Negotiator</h2>
			<div style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
				Adjust the split, then propose. AI accepts if their value clears their
				threshold.
			</div>
			<div style={{ display: "flex", gap: 16 }}>
				<div
					style={{
						background: "rgba(255,255,255,0.06)",
						padding: 12,
						borderRadius: 6,
						minWidth: 240,
					}}
				>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>You</div>
					<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
						Your weights (private):
					</div>
					{RESOURCES.map((r) => (
						<div key={r.name} style={{ fontSize: 13, lineHeight: 1.6 }}>
							{r.emoji} {r.name}: {playerWeights[r.name]} × {r.total - offer[r.name]} ={" "}
							{playerWeights[r.name] * (r.total - offer[r.name])}
						</div>
					))}
					<div style={{ marginTop: 8, fontWeight: 600 }}>
						Your total: {pv}
					</div>
				</div>
				<div
					style={{
						background: "rgba(255,255,255,0.06)",
						padding: 12,
						borderRadius: 6,
						minWidth: 240,
					}}
				>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>AI</div>
					<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
						Their weights (visible):
					</div>
					{RESOURCES.map((r) => (
						<div
							key={r.name}
							style={{
								fontSize: 13,
								lineHeight: 1.6,
								color: aiWeights[r.name] >= 0 ? "#9bcc70" : "#cc7070",
							}}
						>
							{r.emoji} {r.name}: {aiWeights[r.name]} × {offer[r.name]} ={" "}
							{aiWeights[r.name] * offer[r.name]}
						</div>
					))}
					<div style={{ marginTop: 8, fontWeight: 600 }}>
						Their total: {av} / threshold {aiThreshold}
					</div>
					<div style={{ fontSize: 12, opacity: 0.7 }}>
						Patience: {"●".repeat(Math.max(0, patience))}{"○".repeat(Math.max(0, 15 - patience))}
					</div>
				</div>
			</div>
			<div
				style={{
					marginTop: 16,
					display: "grid",
					gridTemplateColumns: "repeat(4, 1fr)",
					gap: 12,
					width: 600,
				}}
			>
				{RESOURCES.map((r) => (
					<div
						key={r.name}
						style={{
							background: "rgba(0,0,0,0.4)",
							padding: 10,
							borderRadius: 5,
							textAlign: "center",
						}}
					>
						<div style={{ fontSize: 24 }}>{r.emoji}</div>
						<div style={{ fontSize: 12 }}>{r.name}</div>
						<div
							style={{
								display: "flex",
								justifyContent: "center",
								alignItems: "center",
								gap: 6,
								marginTop: 4,
							}}
						>
							<button
								type="button"
								onClick={() => adjust(r.name, -1)}
								style={tinyBtn}
							>
								−
							</button>
							<div style={{ fontSize: 14, minWidth: 36 }}>
								<span style={{ color: "#9bcc70" }}>
									{r.total - offer[r.name]}
								</span>
								/
								<span style={{ color: "#ffaa7a" }}>{offer[r.name]}</span>
							</div>
							<button
								type="button"
								onClick={() => adjust(r.name, 1)}
								style={tinyBtn}
							>
								+
							</button>
						</div>
						<div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
							you / them
						</div>
					</div>
				))}
			</div>
			<button
				type="button"
				onClick={propose}
				disabled={!!result}
				style={{
					marginTop: 16,
					padding: "10px 20px",
					background: result ? "#444" : "#7a5aa0",
					color: "#fff",
					border: "none",
					borderRadius: 4,
					cursor: result ? "default" : "pointer",
					fontSize: 15,
				}}
			>
				Propose deal
			</button>
			{result === "accepted" && (
				<div style={{ marginTop: 10, color: "#9bcc70", fontSize: 16 }}>
					Deal! Final score: {playerScore}
				</div>
			)}
			{result === "walked" && (
				<div style={{ marginTop: 10, color: "#cc7070", fontSize: 16 }}>
					They walked. Score: 0
				</div>
			)}
			{result && (
				<button type="button" onClick={reset} style={tinyBtn}>
					Play again
				</button>
			)}
			<div
				style={{
					marginTop: 12,
					fontSize: 12,
					opacity: 0.7,
					maxHeight: 80,
					overflowY: "auto",
					width: 600,
				}}
			>
				{log.map((line, _i) => (
					<div key={line}>{line}</div>
				))}
			</div>
		</div>
	);
}

const tinyBtn: React.CSSProperties = {
	padding: "4px 10px",
	background: "#3a3050",
	color: "#fff",
	border: "1px solid #5a4a7a",
	borderRadius: 3,
	cursor: "pointer",
	fontSize: 12,
};
