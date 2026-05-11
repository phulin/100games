import { useEffect, useRef, useState } from "react";

// Game 75 — Bell Ringer
// Six bells. Plain Hunt method (real change-ringing). Adjacent-swap permutations.

const N = 6;
const BELL_FREQS = [523, 466, 392, 349, 294, 262]; // C5 down

function plainHuntRows(n: number) {
	// generate the plain hunt rows for n bells (n*2 rows, cycles)
	const rows: number[][] = [];
	let row = Array.from({ length: n }, (_, i) => i + 1);
	rows.push([...row]);
	for (let step = 0; step < n * 2 - 1; step++) {
		// alternate swap pattern: on even steps swap pairs (0,1),(2,3)...
		// on odd steps swap pairs (1,2),(3,4)... keep ends fixed
		const newRow = [...row];
		const offset = step % 2 === 0 ? 0 : 1;
		for (let i = offset; i + 1 < n; i += 2) {
			if (i + 1 < n && !(step % 2 === 1 && (i === 0 || i + 1 === n - 1))) {
				[newRow[i], newRow[i + 1]] = [newRow[i + 1], newRow[i]];
			}
		}
		row = newRow;
		rows.push([...row]);
	}
	return rows;
}

export default function Game075_BellRinger() {
	const [rows] = useState<number[][]>(() => plainHuntRows(N));
	const [rowIdx, setRowIdx] = useState(0);
	const [pos, setPos] = useState(0); // which position to ring next in current row
	const [score, setScore] = useState(0);
	const [mistakes, setMistakes] = useState(0);
	const [done, setDone] = useState(false);
	const [lastRing, setLastRing] = useState<number | null>(null);
	const audio = useRef<AudioContext | null>(null);

	const expectedBell = rows[rowIdx][pos];

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const key = parseInt(e.key);
			if (!isNaN(key) && key >= 1 && key <= N) ring(key);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const ring = (bell: number) => {
		if (done) return;
		playTone(audio, BELL_FREQS[bell - 1]);
		setLastRing(bell);
		if (bell === expectedBell) {
			setScore((s) => s + 1);
			if (pos + 1 >= N) {
				if (rowIdx + 1 >= rows.length) {
					setDone(true);
				} else {
					setRowIdx((r) => r + 1);
					setPos(0);
				}
			} else {
				setPos((p) => p + 1);
			}
		} else {
			setMistakes((m) => m + 1);
		}
	};

	const reset = () => {
		setRowIdx(0);
		setPos(0);
		setScore(0);
		setMistakes(0);
		setDone(false);
		setLastRing(null);
	};

	return (
		<div
			style={{
				width: 900,
				height: 600,
				background: "linear-gradient(180deg,#1e1410,#3c2a1a)",
				color: "#f6e7d2",
				fontFamily: "system-ui, sans-serif",
				padding: 20,
				boxSizing: "border-box",
				userSelect: "none",
			}}
		>
			<div>
				<b>Bell Ringer</b> — Ring bells in the order shown on each row. Press 1–6 or click.
			</div>
			<div style={{ marginTop: 12, fontSize: 13 }}>
				Plain Hunt on {N}. Mistakes: {mistakes} · Correct strokes: {score}
			</div>

			<div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 30 }}>
				{Array.from({ length: N }, (_, i) => i + 1).map((b) => (
					<div
						key={b}
						onClick={() => ring(b)}
						style={{
							width: 80,
							height: 110,
							background:
								lastRing === b ? "#f6c87a" : expectedBell === b && !done ? "#5b4a2a" : "#3a2f20",
							border: "2px solid #a98050",
							borderRadius: "50% 50% 30% 30%",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							cursor: "pointer",
							fontSize: 30,
							fontWeight: "bold",
							color: lastRing === b ? "#1a1006" : "#dcb98a",
							transition: "background 0.15s",
						}}
					>
						{b}
					</div>
				))}
			</div>

			<div style={{ marginTop: 30, fontFamily: "monospace", fontSize: 15 }}>
				<div style={{ opacity: 0.5, marginBottom: 6 }}>Row {rowIdx + 1}/{rows.length}, position {pos + 1}/{N}</div>
				{rows.slice(Math.max(0, rowIdx - 1), rowIdx + 3).map((r, i) => {
					const idx = Math.max(0, rowIdx - 1) + i;
					const isCurrent = idx === rowIdx;
					return (
						<div
							key={idx}
							style={{
								color: isCurrent ? "#fff" : idx < rowIdx ? "#888" : "#dcc",
								fontWeight: isCurrent ? "bold" : "normal",
							}}
						>
							{r.map((n, j) => (
								<span
									key={j}
									style={{
										display: "inline-block",
										width: 30,
										textAlign: "center",
										background: isCurrent && j === pos ? "#b46" : "transparent",
										borderRadius: 4,
									}}
								>
									{n}
								</span>
							))}
						</div>
					);
				})}
			</div>

			{done && (
				<div style={{ textAlign: "center", fontSize: 28, marginTop: 30 }}>
					Method complete! Mistakes: {mistakes}
					<div>
						<button onClick={reset} style={{ marginTop: 8, padding: "6px 12px" }}>
							Again
						</button>
					</div>
				</div>
			)}
		</div>
	);
}

function playTone(ref: React.MutableRefObject<AudioContext | null>, freq: number) {
	try {
		if (!ref.current) ref.current = new AudioContext();
		const ctx = ref.current;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.frequency.value = freq;
		o.type = "triangle";
		g.gain.value = 0.001;
		g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + 0.65);
	} catch {}
}
