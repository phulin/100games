import { useEffect, useRef, useState } from "react";

type Line = { actor: string; text: string; t: number }; // t in seconds

const SCRIPT: Line[] = [
	{ actor: "NARRATOR", text: "The curtain rises on a moonlit garden.", t: 1.0 },
	{ actor: "JULIA", text: "Who dares disturb my reverie?", t: 3.0 },
	{ actor: "YOU", text: "A friend, and nothing more.", t: 5.0 },
	{ actor: "JULIA", text: "Friend? In this hour?", t: 7.0 },
	{ actor: "YOU", text: "Aye — bearing news of import.", t: 9.0 },
	{ actor: "NARRATOR", text: "An owl cries thrice.", t: 11.5 },
	{ actor: "YOU", text: "The king is dead. Long live the queen.", t: 13.5 },
	{ actor: "JULIA", text: "Then we are undone.", t: 16.0 },
	{ actor: "YOU", text: "Or we are reborn.", t: 18.0 },
	{ actor: "NARRATOR", text: "Curtain.", t: 20.0 },
];

const WINDOW = 0.45; // seconds tolerance

export default function Game093_CurtainCall() {
	const [t, setT] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [hits, setHits] = useState<Record<number, number>>({}); // line index -> error in seconds
	const [missed, setMissed] = useState<Set<number>>(new Set());
	const startRef = useRef<number | null>(null);
	const rafRef = useRef<number | null>(null);

	useEffect(() => {
		if (!playing) return;
		function tick(now: number) {
			if (startRef.current == null) startRef.current = now;
			const cur = (now - startRef.current) / 1000;
			setT(cur);
			// mark missed lines
			SCRIPT.forEach((ln, i) => {
				if (ln.actor !== "YOU") return;
				if (cur > ln.t + WINDOW && !(i in hits) && !missed.has(i)) {
					setMissed((m) => new Set(m).add(i));
				}
			});
			if (cur < 22) rafRef.current = requestAnimationFrame(tick);
			else setPlaying(false);
		}
		rafRef.current = requestAnimationFrame(tick);
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
		};
	}, [playing, hits, missed]);

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (e.code !== "Space") return;
			e.preventDefault();
			if (!playing) {
				setPlaying(true);
				startRef.current = null;
				setT(0);
				setHits({});
				setMissed(new Set());
				return;
			}
			// find the nearest unhit YOUR line
			let bestIdx = -1;
			let bestErr = Infinity;
			SCRIPT.forEach((ln, i) => {
				if (ln.actor !== "YOU") return;
				if (i in hits || missed.has(i)) return;
				const err = Math.abs(ln.t - t);
				if (err < bestErr) {
					bestErr = err;
					bestIdx = i;
				}
			});
			if (bestIdx >= 0 && bestErr <= WINDOW) {
				setHits((h) => ({ ...h, [bestIdx]: bestErr }));
			} else if (bestIdx >= 0) {
				// miss-flag
				setMissed((m) => new Set(m).add(bestIdx));
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [playing, t, hits, missed]);

	const totalYour = SCRIPT.filter((l) => l.actor === "YOU").length;
	const hitCount = Object.keys(hits).length;
	const avgErr = hitCount
		? Object.values(hits).reduce((a, b) => a + b, 0) / hitCount
		: 0;
	const score = Math.round(hitCount * 100 - avgErr * 200);

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "Georgia, serif",
				background: "#1a0a14",
				color: "#f4e9d8",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px", fontStyle: "italic" }}>Curtain Call</h2>
			<p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
				Press space to deliver YOUR line at the right beat. Tolerance ±
				{WINDOW.toFixed(2)}s.
			</p>

			<div
				style={{
					background: "#0e0610",
					border: "1px solid #3a2030",
					borderRadius: 6,
					padding: 14,
					minHeight: 360,
				}}
			>
				<div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>
					t = {t.toFixed(2)}s
				</div>
				{SCRIPT.map((ln, i) => {
					const past = t >= ln.t - 0.1;
					const isYou = ln.actor === "YOU";
					const wasHit = i in hits;
					const wasMissed = missed.has(i);
					const active =
						isYou && !wasHit && !wasMissed && Math.abs(ln.t - t) < 0.6;
					return (
						<div
							key={i}
							style={{
								opacity: past ? 1 : 0.3,
								color: isYou
									? wasHit
										? "#a3d977"
										: wasMissed
											? "#e63946"
											: active
												? "#f4d35e"
												: "#f4e9d8"
									: "#cdb38c",
								marginBottom: 6,
								fontWeight: isYou ? 700 : 400,
								fontStyle: ln.actor === "NARRATOR" ? "italic" : "normal",
							}}
						>
							<span
								style={{ display: "inline-block", width: 90, opacity: 0.6 }}
							>
								{ln.actor}:
							</span>
							{ln.text}
							{isYou && wasHit && (
								<span style={{ marginLeft: 8, fontSize: 11 }}>
									(±{hits[i].toFixed(2)}s)
								</span>
							)}
							{isYou && wasMissed && (
								<span style={{ marginLeft: 8, fontSize: 11 }}>(missed)</span>
							)}
						</div>
					);
				})}
			</div>

			<div style={{ marginTop: 12 }}>
				{!playing && t === 0 && (
					<button onClick={() => setPlaying(true)}>
						Begin performance (press Space)
					</button>
				)}
				{!playing && t > 0 && (
					<>
						<strong>Performance complete.</strong> Hit {hitCount}/{totalYour}{" "}
						cues. Avg error {avgErr.toFixed(2)}s. Score:{" "}
						<strong>{score}</strong>
						<button
							onClick={() => {
								setT(0);
								setHits({});
								setMissed(new Set());
								startRef.current = null;
							}}
							style={{ marginLeft: 12 }}
						>
							Encore
						</button>
					</>
				)}
			</div>
		</div>
	);
}
