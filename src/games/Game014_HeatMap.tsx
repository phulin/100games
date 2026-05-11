import { useEffect, useRef, useState } from "react";

const SIZE = 12;
const THRESHOLD = 300;
const TICK_MS = 1500;

function emptyGrid() {
	return Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
}

export default function Game014_HeatMap() {
	const [grid, setGrid] = useState<number[][]>(emptyGrid);
	const [tokens, setTokens] = useState(15);
	const [turn, setTurn] = useState(0);
	const [over, setOver] = useState(false);
	const [won, setWon] = useState(false);
	const gridRef = useRef(grid);
	gridRef.current = grid;

	useEffect(() => {
		if (over) return;
		const id = setInterval(() => {
			setGrid((prev) => {
				const next = prev.map((row) => row.slice());
				// spread heat: each cell loses some heat, neighbors gain proportionally
				for (let y = 0; y < SIZE; y++) {
					for (let x = 0; x < SIZE; x++) {
						const v = prev[y][x];
						if (v <= 0) continue;
						const spread = v * 0.12;
						next[y][x] -= spread;
						const neigh = [
							[x - 1, y],
							[x + 1, y],
							[x, y - 1],
							[x, y + 1],
						];
						for (const [nx, ny] of neigh) {
							if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
								next[ny][nx] += spread / 4;
							}
						}
					}
				}
				// add a new hot cell
				const hx = Math.floor(Math.random() * SIZE);
				const hy = Math.floor(Math.random() * SIZE);
				next[hy][hx] += 30;
				let total = 0;
				for (const row of next) for (const v of row) total += Math.max(0, v);
				if (total >= THRESHOLD) {
					setOver(true);
					setWon(false);
				}
				return next;
			});
			setTurn((t) => {
				const nt = t + 1;
				if (nt >= 30 && !over) {
					setOver(true);
					setWon(true);
				}
				return nt;
			});
			setTokens((t) => Math.min(t + 1, 30));
		}, TICK_MS);
		return () => clearInterval(id);
	}, [over]);

	function cool(x: number, y: number) {
		if (over || tokens <= 0) return;
		setGrid((prev) => {
			const next = prev.map((r) => r.slice());
			// reduce target + neighbors
			next[y][x] = Math.max(0, next[y][x] - 25);
			for (const [dx, dy] of [
				[-1, 0],
				[1, 0],
				[0, -1],
				[0, 1],
			]) {
				const nx = x + dx;
				const ny = y + dy;
				if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE) {
					next[ny][nx] = Math.max(0, next[ny][nx] - 12);
				}
			}
			return next;
		});
		setTokens((t) => t - 1);
	}

	function reset() {
		setGrid(emptyGrid());
		setTokens(15);
		setTurn(0);
		setOver(false);
		setWon(false);
	}

	let total = 0;
	for (const row of grid) for (const v of row) total += Math.max(0, v);

	return (
		<div style={{ background: "#0b0b1a", color: "#eee", padding: 16, fontFamily: "system-ui" }}>
			<h2 style={{ margin: 0 }}>Heat Map</h2>
			<p style={{ opacity: 0.7, margin: "4px 0 12px" }}>
				Click cells to drop cooling tokens. Survive 30 turns without total heat hitting {THRESHOLD}.
			</p>
			<div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
				<span>Turn: {turn}/30</span>
				<span>Tokens: {tokens}</span>
				<span>Total heat: {total.toFixed(0)}/{THRESHOLD}</span>
				{over && <button onClick={reset}>Reset</button>}
			</div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: `repeat(${SIZE}, 36px)`,
					gap: 2,
					background: "#222",
					padding: 2,
				}}
			>
				{grid.map((row, y) =>
					row.map((v, x) => {
						const intensity = Math.min(1, v / 40);
						const r = Math.round(40 + intensity * 215);
						const g = Math.round(40 + (1 - intensity) * 80);
						const b = Math.round(60 - intensity * 60);
						return (
							<div
								key={`${x}-${y}`}
								onClick={() => cool(x, y)}
								style={{
									width: 36,
									height: 36,
									background: `rgb(${r}, ${g}, ${b})`,
									cursor: over ? "default" : "pointer",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 10,
									color: "rgba(255,255,255,0.4)",
								}}
							>
								{v > 5 ? Math.round(v) : ""}
							</div>
						);
					}),
				)}
			</div>
			{over && (
				<div style={{ marginTop: 16, fontSize: 20 }}>
					{won ? "You contained the heat!" : "Overheat — city melted."}
				</div>
			)}
		</div>
	);
}
