import { useEffect, useRef, useState } from "react";

// A 12-second performance. Sequence of beats; at each beat, a prompt
// type appears. The player must click the prompt within the window.
// Hitting correctly raises "force strength"; missing or wrong-time raises
// "suspicion". At the end, audience picks card based on (force - suspicion).

type Prompt = {
	t: number; // time in seconds within performance
	type: "tap" | "wave" | "snap";
	label: string;
};

const PERFORMANCE: Prompt[] = [
	{ t: 1.0, type: "wave", label: "Wave hand (mis-direct)" },
	{ t: 2.5, type: "tap", label: "Tap deck (cue card)" },
	{ t: 4.0, type: "snap", label: "Snap (force)" },
	{ t: 5.5, type: "wave", label: "Wave hand (continue mis-direct)" },
	{ t: 7.2, type: "tap", label: "Tap (secure card)" },
	{ t: 9.0, type: "snap", label: "Snap (reveal cue)" },
	{ t: 10.5, type: "tap", label: "Tap (final hold)" },
];

const WINDOW = 0.6; // seconds

const CARDS = ["A♠", "K♥", "Q♣", "J♦", "10♠", "9♥", "7♣", "3♦"];
const FORCED = "K♥";

export default function Game086_Sleight() {
	const [running, setRunning] = useState(false);
	const [time, setTime] = useState(0);
	const [hits, setHits] = useState<{ idx: number; ok: boolean }[]>([]);
	const [done, setDone] = useState(false);
	const [pick, setPick] = useState<string | null>(null);
	const startRef = useRef(0);

	useEffect(() => {
		if (!running) return;
		startRef.current = performance.now();
		let raf = 0;
		const tick = (t: number) => {
			const elapsed = (t - startRef.current) / 1000;
			setTime(elapsed);
			if (elapsed > 12) {
				setRunning(false);
				setDone(true);
				// audience picks: force = #hits, suspicion = #misses + #wrongclicks tracked via hits.length
				const goodHits = hits.filter((h) => h.ok).length;
				const conf = goodHits / PERFORMANCE.length;
				// Probability of picking forced card based on confidence
				const r = Math.random();
				if (r < 0.15 + conf * 0.8) setPick(FORCED);
				else setPick(CARDS[Math.floor(Math.random() * CARDS.length)]);
				return;
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [running]);

	const clickPrompt = (idx: number) => {
		if (!running) return;
		if (hits.some((h) => h.idx === idx)) return;
		const p = PERFORMANCE[idx];
		const ok = Math.abs(time - p.t) < WINDOW;
		setHits([...hits, { idx, ok }]);
	};

	const reset = () => {
		setRunning(false);
		setTime(0);
		setHits([]);
		setDone(false);
		setPick(null);
	};

	const goodHits = hits.filter((h) => h.ok).length;
	const suspicion = hits.length - goodHits + (PERFORMANCE.length - goodHits);

	return (
		<div
			style={{
				fontFamily: "Georgia, serif",
				color: "#eee",
				background: "linear-gradient(to bottom,#1a0820,#2a0830)",
				padding: 20,
				minHeight: 600,
			}}
		>
			<h2 style={{ margin: 0 }}>86. Sleight</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
				Click each prompt at exactly the right moment (±{WINDOW}s) to force the
				audience to pick the {FORCED}.
			</div>
			<div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
				<button
					type="button"
					onClick={() => {
						reset();
						setRunning(true);
					}}
					style={btn}
					disabled={running}
				>
					Begin performance
				</button>
				<button type="button" onClick={reset} style={btn}>
					Reset
				</button>
				<div style={{ alignSelf: "center" }}>
					Time {time.toFixed(2)}s · Hits {goodHits}/{PERFORMANCE.length}
				</div>
			</div>
			{/* timeline */}
			<div
				style={{
					position: "relative",
					height: 80,
					background: "#1a0830",
					border: "1px solid #553060",
					borderRadius: 6,
					margin: "8px 0",
				}}
			>
				{PERFORMANCE.map((p, i) => {
					const x = (p.t / 12) * 100;
					const h = hits.find((hh) => hh.idx === i);
					const inWin =
						running && Math.abs(time - p.t) < WINDOW && !h;
					return (
						<button
							key={i}
							type="button"
							onClick={() => clickPrompt(i)}
							style={{
								position: "absolute",
								left: `${x}%`,
								top: 10,
								transform: "translateX(-50%)",
								padding: "4px 6px",
								background: h
									? h.ok
										? "#3c8"
										: "#c44"
									: inWin
										? "#fa3"
										: "#553060",
								color: "#fff",
								border: "1px solid #aaa",
								borderRadius: 4,
								fontSize: 11,
								cursor: "pointer",
								whiteSpace: "nowrap",
							}}
						>
							{p.label}
						</button>
					);
				})}
				{/* playhead */}
				<div
					style={{
						position: "absolute",
						left: `${(time / 12) * 100}%`,
						top: 0,
						bottom: 0,
						width: 2,
						background: "#fff",
					}}
				/>
			</div>
			<div style={{ marginTop: 12 }}>
				<div style={{ fontSize: 13, marginBottom: 4 }}>Audience confidence:</div>
				<div
					style={{
						width: 300,
						height: 10,
						background: "#333",
						borderRadius: 5,
					}}
				>
					<div
						style={{
							width: `${Math.max(0, 100 - suspicion * 10)}%`,
							height: "100%",
							background: "#3c8",
							borderRadius: 5,
						}}
					/>
				</div>
			</div>
			{done && (
				<div
					style={{
						marginTop: 20,
						padding: 16,
						background: "#0e0420",
						border: "1px solid #553060",
						borderRadius: 6,
					}}
				>
					<div style={{ fontSize: 20 }}>
						Audience picks: <strong>{pick}</strong>
					</div>
					<div style={{ fontSize: 14, marginTop: 4 }}>
						{pick === FORCED
							? "Perfect force. They never suspected."
							: "They picked freely. The trick collapsed."}
					</div>
				</div>
			)}
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "6px 12px",
	background: "#553060",
	color: "#fff",
	border: "1px solid #885090",
	borderRadius: 4,
	cursor: "pointer",
	fontFamily: "Georgia, serif",
};
