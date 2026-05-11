import { useEffect, useMemo, useRef, useState } from "react";

// The Negotiator — seeded resource split. All weights, patience and AI
// personality come from a single seed (no Math.random in setup). Multi-round
// campaign across distinct opponents, each with a different "personality"
// affecting threshold decay, patience, and visible tells.

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

type Resource = { name: string; emoji: string; total: number };
type Offer = Record<string, number>;
type Personality = "stoic" | "greedy" | "fickle" | "patient";

const RESOURCE_TEMPLATE: Array<{ name: string; emoji: string }> = [
	{ name: "apples", emoji: "🍎" },
	{ name: "pears", emoji: "🍐" },
	{ name: "berries", emoji: "🫐" },
	{ name: "nuts", emoji: "🌰" },
	{ name: "honey", emoji: "🍯" },
	{ name: "grain", emoji: "🌾" },
];

const PERSONALITY_LIST: Personality[] = ["stoic", "greedy", "fickle", "patient"];

function makeOpponent(seed: number, opponentIdx: number) {
	const rng = mulberry32(seed ^ (opponentIdx * 0x85ebca6b));
	const personality = PERSONALITY_LIST[Math.floor(rng() * PERSONALITY_LIST.length)];
	const shuffled = [...RESOURCE_TEMPLATE].sort(() => rng() - 0.5).slice(0, 4);
	const resources: Resource[] = shuffled.map((r) => ({
		...r, total: 4 + Math.floor(rng() * 4),
	}));
	const aiWeights: Record<string, number> = {};
	for (const r of resources) aiWeights[r.name] = Math.floor(rng() * 7) - 2;
	const playerWeights: Record<string, number> = {};
	for (const r of resources) playerWeights[r.name] = Math.floor(rng() * 5) + 1;
	let patience = 10;
	let aiThreshold = 18;
	let decay = 2;
	if (personality === "stoic") { patience = 14; aiThreshold = 22; decay = 1; }
	else if (personality === "greedy") { patience = 8; aiThreshold = 26; decay = 1; }
	else if (personality === "fickle") { patience = 12; aiThreshold = 16; decay = 4; }
	else if (personality === "patient") { patience = 18; aiThreshold = 20; decay = 1; }
	patience += Math.floor(rng() * 4);
	return { resources, aiWeights, playerWeights, patience, aiThreshold, decay, personality };
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
	const tone = (freq: number, dur = 0.18, type: OscillatorType = "sine", vol = 0.14) => {
		const ctx = ensure();
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type; o.frequency.value = freq;
		o.connect(g); g.connect(ctx.destination);
		const t = ctx.currentTime;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		o.start(t); o.stop(t + dur + 0.02);
	};
	return tone;
}

export default function TheNegotiator() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [opponentIdx, setOpponentIdx] = useState(0);
	const opp = useMemo(() => makeOpponent(seed, opponentIdx), [seed, opponentIdx]);

	const [patience, setPatience] = useState(opp.patience);
	const [aiThreshold, setAiThreshold] = useState(opp.aiThreshold);
	const [round, setRound] = useState(1);
	const [offer, setOffer] = useState<Offer>(() => {
		const o: Offer = {};
		for (const r of opp.resources) o[r.name] = Math.floor(r.total / 2);
		return o;
	});
	const [log, setLog] = useState<string[]>([]);
	const [result, setResult] = useState<"" | "accepted" | "walked">("");
	const [campaignScore, setCampaignScore] = useState(0);
	const [lastDelta, setLastDelta] = useState(0);
	const tone = useAudio();

	useEffect(() => {
		setPatience(opp.patience); setAiThreshold(opp.aiThreshold);
		setRound(1); setResult(""); setLastDelta(0);
		const o: Offer = {};
		for (const r of opp.resources) o[r.name] = Math.floor(r.total / 2);
		setOffer(o);
	}, [opp]);

	const aiValue = (o: Offer) =>
		opp.resources.reduce((acc, r) => acc + o[r.name] * (opp.aiWeights[r.name] ?? 0), 0);
	const playerValue = (o: Offer) =>
		opp.resources.reduce((acc, r) => acc + (r.total - o[r.name]) * opp.playerWeights[r.name], 0);

	const propose = () => {
		if (result) return;
		const av = aiValue(offer);
		if (av >= aiThreshold) {
			setResult("accepted");
			const pv = playerValue(offer);
			setCampaignScore((s) => s + pv);
			setLog((l) => [`R${round}: ${opp.personality} accepts (${av} ≥ ${aiThreshold}) — you ${pv}.`, ...l]);
			tone(660, 0.3);
		} else {
			const delta = aiThreshold - av;
			setLastDelta(delta);
			const newPat = patience - 1;
			const newThresh = Math.max(0, aiThreshold - opp.decay);
			setPatience(newPat); setAiThreshold(newThresh);
			setLog((l) => [`R${round}: ${opp.personality} rejects (${av} < ${aiThreshold}). They sigh.`, ...l]);
			setRound(round + 1);
			tone(220, 0.18, "sawtooth");
			if (newPat <= 0) {
				setResult("walked");
				setLog((l) => ["They walk. Zero this round.", ...l]);
				tone(120, 0.5, "square");
			}
		}
	};

	const adjust = (name: string, delta: number) => {
		if (result) return;
		const r = opp.resources.find((x) => x.name === name);
		if (!r) return;
		const cur = offer[name];
		const next = Math.max(0, Math.min(r.total, cur + delta));
		setOffer({ ...offer, [name]: next });
		tone(800, 0.04, "triangle", 0.06);
	};

	const nextOpponent = () => setOpponentIdx((i) => i + 1);
	const restart = () => {
		setSeed(Math.floor(Math.random() * 1e9));
		setOpponentIdx(0); setCampaignScore(0); setLog([]);
	};

	const pv = playerValue(offer);
	const av = aiValue(offer);

	const tell =
		!result ?
			av >= aiThreshold ? "They are leaning in." :
			av >= aiThreshold - opp.decay ? "They look thoughtful." :
			av >= aiThreshold - opp.decay * 2 ? "They drum their fingers." :
			"They look unconvinced." :
			result === "accepted" ? "Sealed." : "Stormed off.";

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "linear-gradient(180deg,#1d1a26,#0a0a14)",
				color: "#e0d8f0",
				fontFamily: "Georgia, serif",
				padding: 16,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				overflow: "auto",
			}}
		>
			<h2 style={{ margin: 0 }}>The Negotiator</h2>
			<div style={{ fontSize: 12, opacity: 0.7 }}>
				Opponent #{opponentIdx + 1} · {opp.personality} · Campaign: {campaignScore}
			</div>
			<div style={{ display: "flex", gap: 16, marginTop: 10 }}>
				<div style={panelStyle}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>You</div>
					<div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
						Your weights (private):
					</div>
					{opp.resources.map((r) => (
						<div key={r.name} style={{ fontSize: 12, lineHeight: 1.6 }}>
							{r.emoji} {r.name}: {opp.playerWeights[r.name]} × {r.total - offer[r.name]} ={" "}
							{opp.playerWeights[r.name] * (r.total - offer[r.name])}
						</div>
					))}
					<div style={{ marginTop: 6, fontWeight: 600 }}>Your total: {pv}</div>
				</div>
				<div style={panelStyle}>
					<div style={{ fontWeight: 600, marginBottom: 6 }}>AI ({opp.personality})</div>
					<div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
						Their weights (visible):
					</div>
					{opp.resources.map((r) => (
						<div
							key={r.name}
							style={{
								fontSize: 12, lineHeight: 1.6,
								color: opp.aiWeights[r.name] >= 0 ? "#9bcc70" : "#cc7070",
							}}
						>
							{r.emoji} {r.name}: {opp.aiWeights[r.name]} × {offer[r.name]} ={" "}
							{opp.aiWeights[r.name] * offer[r.name]}
						</div>
					))}
					<div style={{ marginTop: 6, fontWeight: 600 }}>
						Their total: {av} / threshold {aiThreshold}
					</div>
					<div style={{ fontSize: 11, opacity: 0.7 }}>
						Patience: {"●".repeat(Math.max(0, patience))}{"○".repeat(Math.max(0, opp.patience - patience))}
					</div>
					<div style={{ fontSize: 11, fontStyle: "italic", marginTop: 4 }}>
						{tell} {lastDelta ? `(off by ${lastDelta} last time)` : ""}
					</div>
				</div>
			</div>
			<div
				style={{
					marginTop: 12,
					display: "grid",
					gridTemplateColumns: "repeat(4, 1fr)",
					gap: 10,
					width: 580,
				}}
			>
				{opp.resources.map((r) => (
					<div
						key={r.name}
						style={{
							background: "rgba(0,0,0,0.4)",
							padding: 8,
							borderRadius: 5,
							textAlign: "center",
						}}
					>
						<div style={{ fontSize: 22 }}>{r.emoji}</div>
						<div style={{ fontSize: 11 }}>{r.name} ({r.total})</div>
						<div
							style={{
								display: "flex",
								justifyContent: "center",
								alignItems: "center",
								gap: 6,
								marginTop: 4,
							}}
						>
							<button type="button" onClick={() => adjust(r.name, -1)} style={tinyBtn}>−</button>
							<div style={{ fontSize: 13, minWidth: 36 }}>
								<span style={{ color: "#9bcc70" }}>{r.total - offer[r.name]}</span>
								/<span style={{ color: "#ffaa7a" }}>{offer[r.name]}</span>
							</div>
							<button type="button" onClick={() => adjust(r.name, 1)} style={tinyBtn}>+</button>
						</div>
						<div style={{ fontSize: 10, opacity: 0.6, marginTop: 2 }}>you / them</div>
					</div>
				))}
			</div>
			<div style={{ marginTop: 12, display: "flex", gap: 8 }}>
				<button
					type="button"
					onClick={propose}
					disabled={!!result}
					style={{
						padding: "8px 18px",
						background: result ? "#444" : "#7a5aa0",
						color: "#fff",
						border: "none",
						borderRadius: 4,
						cursor: result ? "default" : "pointer",
						fontSize: 14,
					}}
				>
					Propose
				</button>
				{result && (
					<button
						type="button"
						onClick={nextOpponent}
						style={{ ...tinyBtn, padding: "8px 14px", background: "#5a7a4a" }}
					>
						Next opponent →
					</button>
				)}
				<button type="button" onClick={restart} style={{ ...tinyBtn, padding: "8px 14px" }}>
					New campaign
				</button>
			</div>
			{result === "accepted" && (
				<div style={{ marginTop: 6, color: "#9bcc70" }}>Deal! +{pv} this round.</div>
			)}
			{result === "walked" && (
				<div style={{ marginTop: 6, color: "#cc7070" }}>They walked. +0 this round.</div>
			)}
			<div
				style={{
					marginTop: 8,
					fontSize: 11,
					opacity: 0.7,
					maxHeight: 70,
					overflowY: "auto",
					width: 580,
				}}
			>
				{log.map((line, _i) => (<div key={line}>{line}</div>))}
			</div>
		</div>
	);
}

const panelStyle: React.CSSProperties = {
	background: "rgba(255,255,255,0.06)",
	padding: 10,
	borderRadius: 6,
	minWidth: 220,
};

const tinyBtn: React.CSSProperties = {
	padding: "4px 10px",
	background: "#3a3050",
	color: "#fff",
	border: "1px solid #5a4a7a",
	borderRadius: 3,
	cursor: "pointer",
	fontSize: 12,
};
