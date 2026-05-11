import { useEffect, useState } from "react";

// Game 58: Memory Tide
// A grid of shells briefly reveals symbols then "the tide comes in" hiding them.
// Match pairs before time runs out.

type Card = { id: number; sym: string; revealed: boolean; matched: boolean };

const SYMS = ["★", "✿", "♠", "♣", "♥", "♦", "✦", "✪", "❀", "✸"];

function makeDeck(level: number): Card[] {
	const pairs = Math.min(SYMS.length, 4 + level);
	const arr: Card[] = [];
	let id = 0;
	for (let i = 0; i < pairs; i++) {
		arr.push({ id: id++, sym: SYMS[i], revealed: false, matched: false });
		arr.push({ id: id++, sym: SYMS[i], revealed: false, matched: false });
	}
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

export default function MemoryTide() {
	const [level, setLevel] = useState(1);
	const [deck, setDeck] = useState<Card[]>(() => makeDeck(1));
	const [flipped, setFlipped] = useState<number[]>([]);
	const [score, setScore] = useState(0);
	const [time, setTime] = useState(30);
	const [preview, setPreview] = useState(true);
	const [over, setOver] = useState(false);

	useEffect(() => {
		// Show all briefly at level start
		setPreview(true);
		const id = setTimeout(() => setPreview(false), 2500 + level * 200);
		return () => clearTimeout(id);
	}, [deck, level]);

	useEffect(() => {
		if (preview || over) return;
		const id = setInterval(() => {
			setTime((t) => {
				const nt = t - 0.1;
				if (nt <= 0) {
					setOver(true);
					return 0;
				}
				return nt;
			});
		}, 100);
		return () => clearInterval(id);
	}, [preview, over]);

	useEffect(() => {
		if (flipped.length === 2) {
			const [a, b] = flipped;
			const ca = deck[a];
			const cb = deck[b];
			if (ca.sym === cb.sym) {
				setTimeout(() => {
					setDeck((d) => d.map((c, i) => (i === a || i === b ? { ...c, matched: true, revealed: true } : c)));
					setFlipped([]);
					setScore((s) => s + 10);
				}, 350);
			} else {
				setTimeout(() => {
					setDeck((d) => d.map((c, i) => (i === a || i === b ? { ...c, revealed: false } : c)));
					setFlipped([]);
				}, 700);
			}
		}
	}, [flipped, deck]);

	useEffect(() => {
		if (deck.length > 0 && deck.every((c) => c.matched) && !over) {
			setScore((s) => s + Math.round(time * 5 + level * 20));
			const lv = level + 1;
			setTimeout(() => {
				setLevel(lv);
				setDeck(makeDeck(lv));
				setTime(30 + lv * 2);
				setFlipped([]);
			}, 800);
		}
	}, [deck, time, level, over]);

	function flip(i: number) {
		if (preview || over) return;
		if (flipped.length >= 2) return;
		if (deck[i].matched || deck[i].revealed) return;
		setDeck((d) => d.map((c, k) => (k === i ? { ...c, revealed: true } : c)));
		setFlipped((f) => [...f, i]);
	}

	function reset() {
		setLevel(1);
		setDeck(makeDeck(1));
		setScore(0);
		setTime(30);
		setOver(false);
		setFlipped([]);
	}

	const cols = Math.ceil(Math.sqrt(deck.length * 1.4));
	const tideY = preview ? -200 : 0;

	return (
		<div style={{ background: "linear-gradient(#06283a,#0d4a66)", color: "#dff5ff", padding: 14, minHeight: 600, fontFamily: "'Trebuchet MS', sans-serif", position: "relative", overflow: "hidden" }}>
			<h2 style={{ margin: 0 }}>Memory Tide</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Memorize the shells before the tide comes in. Match pairs to clear the board.
			</div>
			<div style={{ display: "flex", gap: 16, marginTop: 4 }}>
				<div>Level: {level}</div>
				<div>Score: {score}</div>
				<div>Time: {time.toFixed(1)}s</div>
				{over && (
					<button type="button" onClick={reset} style={{ background: "#3aa0c0", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
						Restart
					</button>
				)}
			</div>
			<div
				style={{
					marginTop: 16,
					display: "grid",
					gridTemplateColumns: `repeat(${cols}, 80px)`,
					gap: 10,
					justifyContent: "center",
					position: "relative",
					zIndex: 2,
				}}
			>
				{deck.map((c, i) => (
					<button
						key={c.id}
						type="button"
						onClick={() => flip(i)}
						style={{
							width: 80,
							height: 80,
							borderRadius: 12,
							border: "2px solid #fff3",
							background: c.matched ? "#7be0a0" : preview || c.revealed ? "#fff8e7" : "#1a3a5a",
							color: c.matched ? "#0a3a18" : "#3a2818",
							fontSize: 36,
							cursor: preview || over ? "default" : "pointer",
							boxShadow: "inset 0 -8px 14px #0003",
						}}
					>
						{preview || c.revealed || c.matched ? c.sym : ""}
					</button>
				))}
			</div>
			{/* Tide overlay */}
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: `calc(100% + ${tideY}px)`,
					height: 800,
					background: "linear-gradient(to bottom, rgba(60,150,200,0.0), rgba(40,100,140,0.6))",
					transition: "top 1.5s ease-in-out",
					pointerEvents: "none",
				}}
			/>
		</div>
	);
}
