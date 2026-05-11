import { useMemo, useState } from "react";

const GRID = 16;
const PALETTE = [
	"#1a1a2e",
	"#e94560",
	"#f5c518",
	"#0f3460",
	"#16a085",
	"#ecf0f1",
	"#8e44ad",
	"#d35400",
];

function makeTarget(seed: number): number[] {
	// Generate a "shape": a colored disc and a colored stripe.
	const rng = (s: number) => {
		let x = (s * 9301 + 49297) % 233280;
		return () => {
			x = (x * 9301 + 49297) % 233280;
			return x / 233280;
		};
	};
	const r = rng(seed);
	const bg = Math.floor(r() * PALETTE.length);
	const cx = 4 + Math.floor(r() * (GRID - 8));
	const cy = 4 + Math.floor(r() * (GRID - 8));
	const rad = 3 + Math.floor(r() * 3);
	const disc = (Math.floor(r() * PALETTE.length) + 1) % PALETTE.length;
	const stripeY = Math.floor(r() * GRID);
	const stripeCol = (Math.floor(r() * PALETTE.length) + 2) % PALETTE.length;
	const g = new Array<number>(GRID * GRID).fill(bg);
	for (let y = 0; y < GRID; y++) {
		for (let x = 0; x < GRID; x++) {
			if (Math.abs(y - stripeY) <= 0) g[y * GRID + x] = stripeCol;
			const dx = x - cx;
			const dy = y - cy;
			if (dx * dx + dy * dy <= rad * rad) g[y * GRID + x] = disc;
		}
	}
	return g;
}

export default function Game082_Mosaic() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 9999));
	const target = useMemo(() => makeTarget(seed), [seed]);
	const [board, setBoard] = useState<(number | null)[]>(() =>
		new Array(GRID * GRID).fill(null),
	);
	const [color, setColor] = useState(0);
	const [budget, setBudget] = useState(GRID * GRID - 30);

	const place = (i: number) => {
		if (board[i] === color) return;
		const b = board.slice();
		if (b[i] === null) {
			if (budget <= 0) return;
			setBudget(budget - 1);
		}
		b[i] = color;
		setBoard(b);
	};
	const erase = (i: number) => {
		const b = board.slice();
		if (b[i] !== null) {
			b[i] = null;
			setBoard(b);
			setBudget(budget + 1);
		}
	};

	const score = useMemo(() => {
		let match = 0;
		let placed = 0;
		for (let i = 0; i < board.length; i++) {
			if (board[i] !== null) {
				placed++;
				if (board[i] === target[i]) match++;
			}
		}
		const total = GRID * GRID;
		return { match, placed, pct: ((match / total) * 100) | 0 };
	}, [board, target]);

	const reset = () => {
		setBoard(new Array(GRID * GRID).fill(null));
		setBudget(GRID * GRID - 30);
	};
	const newPuzzle = () => {
		setSeed(Math.floor(Math.random() * 9999));
		reset();
	};

	const cell = 22;

	return (
		<div
			style={{
				fontFamily: "system-ui, sans-serif",
				color: "#eee",
				background: "#15151c",
				padding: 16,
				minHeight: 600,
			}}
		>
			<h2 style={{ margin: 0 }}>82. Mosaic</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Click to place a tile. Right-click to erase. Approximate the target with
				a limited budget.
			</div>
			<div style={{ display: "flex", gap: 24 }}>
				<div>
					<div style={{ fontSize: 12, marginBottom: 4 }}>Target</div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: `repeat(${GRID}, ${cell}px)`,
						}}
					>
						{target.map((c, i) => (
							<div
								key={i}
								style={{
									width: cell,
									height: cell,
									background: PALETTE[c],
								}}
							/>
						))}
					</div>
				</div>
				<div>
					<div style={{ fontSize: 12, marginBottom: 4 }}>
						Your mosaic — budget {budget} — match {score.pct}%
					</div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: `repeat(${GRID}, ${cell}px)`,
						}}
					>
						{board.map((c, i) => (
							<div
								key={i}
								onClick={() => place(i)}
								onContextMenu={(e) => {
									e.preventDefault();
									erase(i);
								}}
								style={{
									width: cell,
									height: cell,
									background: c === null ? "#222" : PALETTE[c],
									border: "1px solid #111",
									cursor: "pointer",
								}}
							/>
						))}
					</div>
				</div>
			</div>
			<div
				style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}
			>
				{PALETTE.map((p, i) => (
					<button
						key={i}
						type="button"
						onClick={() => setColor(i)}
						style={{
							width: 28,
							height: 28,
							background: p,
							border:
								i === color ? "2px solid #fff" : "2px solid transparent",
							cursor: "pointer",
						}}
					/>
				))}
				<button type="button" onClick={reset} style={btn}>
					Clear
				</button>
				<button type="button" onClick={newPuzzle} style={btn}>
					New puzzle
				</button>
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "6px 12px",
	background: "#234",
	color: "#fff",
	border: "1px solid #456",
	borderRadius: 4,
	cursor: "pointer",
};
