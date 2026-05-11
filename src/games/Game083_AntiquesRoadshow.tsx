import { useEffect, useMemo, useState } from "react";

type Item = {
	name: string;
	hint: string;
	truePrice: number;
	low: number;
	high: number;
};

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

const ADJ = ["Engraved", "Cracked", "Lacquered", "Tarnished", "Hand-stitched", "Carved", "Gilded", "Faded", "Pressed", "Inlaid", "Folded", "Beaded"];
const ERA = ["Victorian", "Mid-century", "Edwardian", "Pre-war", "Depression-era", "Colonial", "Renaissance-revival", "Art-deco", "Federal", "Regency"];
const MAT = ["porcelain", "brass", "walnut", "silver", "ivory-look", "tin", "oak", "leather", "ceramic", "copper", "linen"];
const FORM = ["pocket watch", "vase", "letter opener", "chair", "music box", "decoy", "telescope", "tea caddy", "quilt", "lamp base", "card", "ledger", "snuffbox", "lorgnette"];
const FLAW = ["original chain", "small water damage", "monogrammed", "unsigned", "minor crazing", "two pinholes", "lens intact", "missing key", "faded patches", "slight crease", "professional repair", "all original parts"];

function makeItems(seed: number, count: number): Item[] {
	const rng = mulberry32(seed);
	const items: Item[] = [];
	for (let i = 0; i < count; i++) {
		const adj = ADJ[Math.floor(rng() * ADJ.length)];
		const era = ERA[Math.floor(rng() * ERA.length)];
		const mat = MAT[Math.floor(rng() * MAT.length)];
		const form = FORM[Math.floor(rng() * FORM.length)];
		const flaw = FLAW[Math.floor(rng() * FLAW.length)];
		const matIdx = MAT.indexOf(mat);
		const formIdx = FORM.indexOf(form);
		const eraIdx = ERA.indexOf(era);
		const base = 50 + matIdx * 35 + formIdx * 60 + eraIdx * 40 + Math.floor(rng() * 200);
		const spreadPct = 0.25 + rng() * 0.45;
		const condition = 0.5 + rng();
		const truePrice = Math.max(10, Math.round(base * condition * (0.7 + rng() * 0.9)));
		const low = Math.round(truePrice * (1 - spreadPct));
		const high = Math.round(truePrice * (1 + spreadPct));
		items.push({ name: `${adj} ${era} ${mat} ${form}`, hint: `${flaw}.`, truePrice, low, high });
	}
	return items;
}

let audioCtx: AudioContext | null = null;
function blip(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.05) {
	if (typeof window === "undefined") return;
	try {
		if (!audioCtx)
			audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
	} catch { return; }
	const ctx = audioCtx; if (!ctx) return;
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
function gavel() {
	blip(110, 0.25, "triangle", 0.18);
	setTimeout(() => blip(80, 0.18, "sine", 0.12), 60);
}

const ITEMS_PER_ROUND = 4;

export default function Game083_AntiquesRoadshow() {
	const [seed, setSeed] = useState(() => dailySeed());
	const [round, setRound] = useState(1);
	const items = useMemo(() => makeItems(seed + round * 1009, ITEMS_PER_ROUND), [seed, round]);
	const [bids, setBids] = useState<string[]>(() => new Array(ITEMS_PER_ROUND).fill(""));
	const [reveal, setReveal] = useState(false);
	const [totalErr, setTotalErr] = useState(0);
	const [streakInBand, setStreakInBand] = useState(0);
	const [history, setHistory] = useState<{ round: number; err: number; inBand: number }[]>([]);

	useEffect(() => {
		setBids(new Array(ITEMS_PER_ROUND).fill(""));
		setReveal(false);
	}, [seed, round]);

	const computeRound = () => {
		let err = 0; let inBand = 0;
		bids.forEach((b, i) => {
			const v = parseFloat(b) || 0;
			err += Math.abs(v - items[i].truePrice);
			if (v >= items[i].low && v <= items[i].high) inBand++;
		});
		return { err, inBand };
	};

	const submit = () => {
		const { err, inBand } = computeRound();
		setTotalErr(totalErr + err);
		setReveal(true);
		setStreakInBand(inBand === ITEMS_PER_ROUND ? streakInBand + 1 : 0);
		setHistory((h) => [...h, { round, err, inBand }]);
		gavel();
	};

	const next = () => setRound(round + 1);

	const reset = () => {
		setRound(1);
		setTotalErr(0);
		setStreakInBand(0);
		setHistory([]);
		setReveal(false);
	};
	const newSeed = () => { setSeed(Math.floor(Math.random() * 1e9)); reset(); };
	const daily = () => { setSeed(dailySeed()); reset(); };

	const roundStats = useMemo(() => (reveal ? computeRound() : { err: 0, inBand: 0 }), [reveal, bids, items]);

	return (
		<div style={{ fontFamily: "Georgia, serif", color: "#f0e6d2", background: "#1a0f08", padding: 20, minHeight: 600 }}>
			<h2 style={{ margin: 0 }}>83. Antiques Roadshow</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 12 }}>
				Price each item. Land within the expert's band for a streak. Lowest total absolute error wins.
			</div>
			<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
				<div>Round {round}</div>
				<div>Seed #{seed}</div>
				<div>Cumulative error: ${totalErr.toLocaleString()}</div>
				<div>In-band streak: {streakInBand}</div>
			</div>
			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
				{items.map((it, i) => {
					const v = parseFloat(bids[i]) || 0;
					const err = reveal ? Math.abs(v - it.truePrice) : 0;
					const inBand = reveal && v >= it.low && v <= it.high;
					return (
						<div key={i} style={{ background: "#2c1810", padding: 12, borderRadius: 6, border: reveal ? `1px solid ${inBand ? "#a0d080" : "#a05050"}` : "1px solid #5a3a20" }}>
							<div style={{ fontWeight: "bold", textTransform: "capitalize" }}>{it.name}</div>
							<div style={{ fontSize: 13, fontStyle: "italic", opacity: 0.85 }}>{it.hint}</div>
							<div style={{ marginTop: 8 }}>
								$<input
									type="number"
									value={bids[i]}
									disabled={reveal}
									onChange={(e) => { const b = bids.slice(); b[i] = e.target.value; setBids(b); }}
									style={{ width: 100, background: "#1a0f08", color: "#f0e6d2", border: "1px solid #5a3a20", padding: 4 }}
								/>
							</div>
							{reveal && (
								<div style={{ marginTop: 6, fontSize: 13 }}>
									Actual: ${it.truePrice.toLocaleString()} (band ${it.low.toLocaleString()}-${it.high.toLocaleString()}) · off by ${err.toLocaleString()} {inBand ? "✓" : ""}
								</div>
							)}
						</div>
					);
				})}
			</div>
			<div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
				{!reveal ? (
					<button type="button" onClick={submit} style={btn}>Submit prices</button>
				) : (
					<>
						<div style={{ alignSelf: "center" }}>
							Round error: ${roundStats.err.toLocaleString()} · in-band {roundStats.inBand}/{ITEMS_PER_ROUND}
						</div>
						<button type="button" onClick={next} style={btn}>Next round</button>
					</>
				)}
				<button type="button" onClick={reset} style={btn}>Reset</button>
				<button type="button" onClick={daily} style={btn}>Daily</button>
				<button type="button" onClick={newSeed} style={btn}>New seed</button>
			</div>
			{history.length > 0 && (
				<div style={{ marginTop: 18 }}>
					<div style={{ fontSize: 12, opacity: 0.8 }}>History</div>
					<table style={{ borderCollapse: "collapse", marginTop: 6, fontSize: 13 }}>
						<thead>
							<tr style={{ opacity: 0.7 }}>
								<th style={th}>Round</th>
								<th style={th}>Error</th>
								<th style={th}>In-band</th>
							</tr>
						</thead>
						<tbody>
							{history.map((h) => (
								<tr key={h.round}>
									<td style={td}>{h.round}</td>
									<td style={td}>${h.err.toLocaleString()}</td>
									<td style={td}>{h.inBand}/{ITEMS_PER_ROUND}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "6px 12px",
	background: "#5a3a20",
	color: "#fff",
	border: "1px solid #8a5a30",
	borderRadius: 4,
	cursor: "pointer",
	fontFamily: "Georgia, serif",
};
const th: React.CSSProperties = { textAlign: "left", padding: "4px 12px 4px 0", borderBottom: "1px solid #5a3a20" };
const td: React.CSSProperties = { padding: "4px 12px 4px 0" };
