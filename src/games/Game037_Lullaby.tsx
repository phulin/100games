import { useEffect, useRef, useState } from "react";

// Soothe a baby by playing notes. Each baby has a target 3-note sequence (soothing pattern).
// Each note played adds/removes calm based on how it advances toward the pattern.
// Play right next note: +calm; wrong note: -calm. Reach 100 calm to win.

const NOTES = ["C", "D", "E", "F", "G", "A", "B"];
const FREQS: Record<string, number> = {
	C: 261.63,
	D: 293.66,
	E: 329.63,
	F: 349.23,
	G: 392.0,
	A: 440.0,
	B: 493.88,
};

function genPattern() {
	return Array.from({ length: 3 }, () => NOTES[Math.floor(Math.random() * NOTES.length)]);
}

export default function Lullaby() {
	const [pattern, setPattern] = useState<string[]>(genPattern);
	const [matched, setMatched] = useState(0); // 0..3
	const [calm, setCalm] = useState(50);
	const [history, setHistory] = useState<{ note: string; good: boolean }[]>([]);
	const [won, setWon] = useState(false);
	const audioRef = useRef<AudioContext | null>(null);

	const playNote = (note: string) => {
		if (!audioRef.current) audioRef.current = new AudioContext();
		const ctx = audioRef.current;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.frequency.value = FREQS[note];
		osc.type = "sine";
		gain.gain.setValueAtTime(0.0001, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
		osc.connect(gain).connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + 0.7);
	};

	const press = (note: string) => {
		if (won) return;
		playNote(note);
		const expected = pattern[matched];
		const good = note === expected;
		setHistory((h) => [...h.slice(-9), { note, good }]);
		if (good) {
			setMatched((m) => {
				const nm = m + 1;
				if (nm >= pattern.length) {
					setCalm((c) => Math.min(100, c + 25));
					// new sub-pattern continues; cycle
					return 0;
				}
				return nm;
			});
			setCalm((c) => Math.min(100, c + 5));
		} else {
			setMatched(0);
			setCalm((c) => Math.max(0, c - 8));
		}
	};

	useEffect(() => {
		if (calm >= 100) setWon(true);
	}, [calm]);

	useEffect(() => {
		// gentle decay when no input
		const id = setInterval(() => {
			setCalm((c) => Math.max(0, c - 0.5));
		}, 1000);
		return () => clearInterval(id);
	}, []);

	const reset = () => {
		setPattern(genPattern());
		setMatched(0);
		setCalm(50);
		setHistory([]);
		setWon(false);
	};

	// Discovered hints
	const hint = history.length === 0 ? "Try notes to find what soothes." : "Reading the baby's reaction...";

	const babyFace = won ? "ZZZ" : calm > 80 ? ":)" : calm > 40 ? ":|" : ":(";
	const cry = !won && calm < 30;

	return (
		<div style={{ background: "#f8e8f0", color: "#333", padding: 20, fontFamily: "sans-serif", minHeight: 540 }}>
			<h2 style={{ margin: "0 0 4px", color: "#553" }}>Lullaby</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
				Play notes to find the 3-note sequence that soothes this baby. Reach 100 calm.
			</div>
			<div
				style={{
					margin: "0 auto",
					width: 200,
					height: 200,
					borderRadius: "50%",
					background: cry ? "#f6b" : "#fcd",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: 56,
					color: "#553",
					boxShadow: "inset -8px -8px 24px rgba(0,0,0,0.08)",
					transition: "background 0.4s",
				}}
			>
				{babyFace}
			</div>
			<div style={{ textAlign: "center", marginTop: 16 }}>
				<div style={{ width: 300, margin: "0 auto", background: "#eee", height: 16, borderRadius: 8, overflow: "hidden" }}>
					<div
						style={{
							width: `${calm}%`,
							height: "100%",
							background: "linear-gradient(90deg, #88c, #aef)",
							transition: "width 0.3s",
						}}
					/>
				</div>
				<div style={{ fontSize: 12, marginTop: 4 }}>Calm: {Math.floor(calm)}/100 · Progress: {matched}/{pattern.length}</div>
				{won && <div style={{ color: "#383", fontSize: 18, marginTop: 8 }}>Sleeping soundly...</div>}
			</div>
			<div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 16 }}>
				{NOTES.map((n) => (
					<button
						key={n}
						type="button"
						onClick={() => press(n)}
						style={{
							width: 50,
							height: 120,
							background: "#fff",
							border: "1px solid #999",
							borderRadius: 6,
							fontSize: 18,
							cursor: "pointer",
						}}
					>
						{n}
					</button>
				))}
			</div>
			<div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 12, fontSize: 14 }}>
				{history.map((h, i) => (
					<span key={i} style={{ color: h.good ? "#383" : "#a33" }}>
						{h.note}
					</span>
				))}
			</div>
			<div style={{ textAlign: "center", marginTop: 8, fontSize: 11, opacity: 0.6 }}>{hint}</div>
			<div style={{ textAlign: "center", marginTop: 12 }}>
				<button type="button" onClick={reset}>
					New baby
				</button>
			</div>
		</div>
	);
}
