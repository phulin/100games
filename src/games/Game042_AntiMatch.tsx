import { useEffect, useRef, useState } from "react";

// Anti-Match — reverse match-3. 3 in a row of any color = penalty.

const COLORS = ["#e63946", "#f4a261", "#2a9d8f", "#457b9d", "#b56576"];
const COLS = 5;
const ROWS = 8;

type Cell = number | null;

function newQueue(seed: number, len: number): number[] {
	let s = seed;
	const rng = () => {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		return s / 0x7fffffff;
	};
	return Array.from({ length: len }, () => Math.floor(rng() * COLORS.length));
}

export default function Game042_AntiMatch() {
	const [grid, setGrid] = useState<Cell[][]>(() =>
		Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => null as Cell))
	);
	const [queue, setQueue] = useState<number[]>(() => newQueue(Date.now(), 60));
	const [qIdx, setQIdx] = useState(0);
	const [score, setScore] = useState(0);
	const [penalty, setPenalty] = useState(0);
	const [over, setOver] = useState(false);
	const [flash, setFlash] = useState<string | null>(null);
	const flashTimer = useRef<number | null>(null);

	const current = queue[qIdx];
	const next = queue[qIdx + 1];

	const place = (col: number) => {
		if (over) return;
		const column = grid[col];
		const firstEmpty = column.findIndex((c) => c === null);
		if (firstEmpty === -1) {
			setFlash("Column full!");
			if (flashTimer.current) clearTimeout(flashTimer.current);
			flashTimer.current = window.setTimeout(() => setFlash(null), 800);
			return;
		}
		const newGrid = grid.map((c) => c.slice());
		newGrid[col][firstEmpty] = current;
		// Check 3-in-a-row of same color (vertical/horizontal/diag) including the new piece
		const c = current;
		const x = col;
		const y = firstEmpty;
		const dirs = [
			[1, 0],
			[0, 1],
			[1, 1],
			[1, -1],
		];
		let pen = 0;
		const toClear = new Set<string>();
		for (const [dx, dy] of dirs) {
			// count run length including this cell in both directions
			let run = 1;
			const line = [`${x},${y}`];
			let nx = x + dx;
			let ny = y + dy;
			while (
				nx >= 0 &&
				nx < COLS &&
				ny >= 0 &&
				ny < ROWS &&
				newGrid[nx][ny] === c
			) {
				run++;
				line.push(`${nx},${ny}`);
				nx += dx;
				ny += dy;
			}
			nx = x - dx;
			ny = y - dy;
			while (
				nx >= 0 &&
				nx < COLS &&
				ny >= 0 &&
				ny < ROWS &&
				newGrid[nx][ny] === c
			) {
				run++;
				line.push(`${nx},${ny}`);
				nx -= dx;
				ny -= dy;
			}
			if (run >= 3) {
				pen += run;
				for (const k of line) toClear.add(k);
			}
		}
		if (toClear.size > 0) {
			setPenalty((p) => p + pen);
			setFlash(`-${pen} penalty`);
			if (flashTimer.current) clearTimeout(flashTimer.current);
			flashTimer.current = window.setTimeout(() => setFlash(null), 700);
			for (const k of toClear) {
				const [cx, cy] = k.split(",").map(Number);
				newGrid[cx][cy] = null;
			}
			// gravity: compact each column
			for (let cc = 0; cc < COLS; cc++) {
				const kept = newGrid[cc].filter((v): v is number => v !== null);
				const padded: Cell[] = [...kept];
				while (padded.length < ROWS) padded.push(null);
				newGrid[cc] = padded;
			}
		} else {
			setScore((s) => s + 1);
		}
		setGrid(newGrid);
		setQIdx((i) => i + 1);
		if (qIdx + 1 >= queue.length) {
			setOver(true);
		}
	};

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const n = parseInt(e.key, 10);
			if (n >= 1 && n <= COLS) place(n - 1);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

	const reset = () => {
		setGrid(Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => null as Cell)));
		setQueue(newQueue(Date.now(), 60));
		setQIdx(0);
		setScore(0);
		setPenalty(0);
		setOver(false);
	};

	const cellSize = 60;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#101418",
				color: "#eee",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<h2 style={{ margin: 4 }}>Anti-Match</h2>
			<div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>
				Place marbles — avoid 3-in-a-row. Click a column or press 1–5.
			</div>
			<div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
				<div>
					<div
						style={{
							display: "flex",
							gap: 0,
							marginBottom: 6,
							justifyContent: "center",
						}}
					>
						<div
							style={{
								width: 40,
								height: 40,
								borderRadius: "50%",
								background: COLORS[current],
								border: "2px solid #fff",
							}}
						/>
						<div
							style={{
								width: 30,
								height: 30,
								borderRadius: "50%",
								background: COLORS[next] ?? "#333",
								marginLeft: 12,
								marginTop: 5,
								opacity: 0.6,
							}}
							title="next"
						/>
					</div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: `repeat(${COLS}, ${cellSize}px)`,
							background: "#222",
							border: "2px solid #333",
						}}
					>
						{Array.from({ length: ROWS }).map((_, rRev) => {
							const r = ROWS - 1 - rRev;
							return Array.from({ length: COLS }).map((_, c) => {
								const v = grid[c][r];
								return (
									<div
										key={`${c}-${r}`}
										onClick={() => place(c)}
										style={{
											width: cellSize,
											height: cellSize,
											borderRight: "1px solid #2a2e36",
											borderBottom: "1px solid #2a2e36",
											display: "flex",
											alignItems: "center",
											justifyContent: "center",
											cursor: "pointer",
										}}
									>
										{v !== null && (
											<div
												style={{
													width: cellSize - 14,
													height: cellSize - 14,
													borderRadius: "50%",
													background: COLORS[v],
													boxShadow: "inset -3px -4px 6px rgba(0,0,0,0.4)",
												}}
											/>
										)}
									</div>
								);
							});
						})}
					</div>
				</div>
				<div style={{ minWidth: 180 }}>
					<div style={{ fontSize: 28 }}>{score - penalty}</div>
					<div style={{ opacity: 0.7, fontSize: 13 }}>
						placed: {score} · penalty: {penalty}
					</div>
					<div style={{ marginTop: 12, opacity: 0.7 }}>
						queue {qIdx}/{queue.length}
					</div>
					<div
						style={{
							marginTop: 12,
							display: "flex",
							flexWrap: "wrap",
							gap: 6,
							maxWidth: 160,
						}}
					>
						{queue.slice(qIdx + 2, qIdx + 18).map((cIdx, i) => (
							<div
								key={i}
								style={{
									width: 14,
									height: 14,
									borderRadius: "50%",
									background: COLORS[cIdx],
									opacity: 0.5,
								}}
							/>
						))}
					</div>
					{over && (
						<button type="button" onClick={reset} style={btn}>
							Play again
						</button>
					)}
					{flash && (
						<div style={{ marginTop: 12, color: "#fc6" }}>{flash}</div>
					)}
				</div>
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#2a3045",
	color: "#fff",
	border: "1px solid #445",
	padding: "8px 14px",
	borderRadius: 6,
	cursor: "pointer",
	marginTop: 16,
};
