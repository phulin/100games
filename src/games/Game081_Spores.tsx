import { useEffect, useMemo, useRef, useState } from "react";

const COLS = 30;
const ROWS = 20;
const CELL = 22;
const TICK_MS = 700;
const FIREBREAKS = 25;

type Cell = "empty" | "spore" | "burning" | "firebreak" | "target" | "burnt";

function seedGrid(): Cell[] {
	const g: Cell[] = new Array(COLS * ROWS).fill("empty");
	// initial spore source(s)
	const sources = 2;
	for (let i = 0; i < sources; i++) {
		const x = Math.floor(Math.random() * 4);
		const y = Math.floor(Math.random() * ROWS);
		g[y * COLS + x] = "burning";
	}
	// targets scattered on right side
	for (let i = 0; i < 5; i++) {
		const x = Math.floor(COLS / 2 + Math.random() * (COLS / 2 - 2)) + 1;
		const y = Math.floor(Math.random() * ROWS);
		if (g[y * COLS + x] === "empty") g[y * COLS + x] = "target";
	}
	return g;
}

export default function Game081_Spores() {
	const [grid, setGrid] = useState<Cell[]>(() => seedGrid());
	const [breaks, setBreaks] = useState(FIREBREAKS);
	const [tick, setTick] = useState(0);
	const [running, setRunning] = useState(false);
	const [ended, setEnded] = useState<null | { saved: number; total: number }>(
		null,
	);
	const gridRef = useRef(grid);
	gridRef.current = grid;

	const totalTargets = useMemo(
		() => grid.filter((c) => c === "target").length,
		// only count from initial seeding
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[],
	);

	useEffect(() => {
		if (!running) return;
		const id = setInterval(() => {
			const g = gridRef.current.slice();
			let anyBurning = false;
			const newBurns: number[] = [];
			for (let y = 0; y < ROWS; y++) {
				for (let x = 0; x < COLS; x++) {
					const i = y * COLS + x;
					if (g[i] !== "burning") continue;
					anyBurning = true;
					const neigh = [
						[1, 0],
						[-1, 0],
						[0, 1],
						[0, -1],
					];
					for (const [dx, dy] of neigh) {
						const nx = x + dx;
						const ny = y + dy;
						if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
						const ni = ny * COLS + nx;
						const c = g[ni];
						if (c === "empty" || c === "target") {
							if (Math.random() < 0.7) newBurns.push(ni);
						}
					}
				}
			}
			// existing burning -> burnt
			for (let i = 0; i < g.length; i++) {
				if (g[i] === "burning") g[i] = "burnt";
			}
			for (const i of newBurns) {
				g[i] = "burning";
			}
			setGrid(g);
			setTick((t) => t + 1);
			if (!anyBurning || newBurns.length === 0) {
				const saved = g.filter((c) => c === "target").length;
				setRunning(false);
				setEnded({ saved, total: totalTargets });
			}
		}, TICK_MS);
		return () => clearInterval(id);
	}, [running, totalTargets]);

	const placeBreak = (i: number) => {
		if (running || ended) return;
		const c = grid[i];
		if (c === "empty") {
			if (breaks <= 0) return;
			const g = grid.slice();
			g[i] = "firebreak";
			setGrid(g);
			setBreaks(breaks - 1);
		} else if (c === "firebreak") {
			const g = grid.slice();
			g[i] = "empty";
			setGrid(g);
			setBreaks(breaks + 1);
		}
	};

	const reset = () => {
		setGrid(seedGrid());
		setBreaks(FIREBREAKS);
		setTick(0);
		setEnded(null);
		setRunning(false);
	};

	const colorFor = (c: Cell) => {
		switch (c) {
			case "empty":
				return "#1f2a1a";
			case "spore":
				return "#5a8a3a";
			case "burning":
				return "#d04a2e";
			case "burnt":
				return "#3a2a22";
			case "firebreak":
				return "#cfa45a";
			case "target":
				return "#3ec1c8";
		}
	};

	return (
		<div
			style={{
				fontFamily: "system-ui, sans-serif",
				color: "#e6e6e6",
				background: "#0c130a",
				padding: 16,
				minHeight: 600,
			}}
		>
			<h2 style={{ margin: 0 }}>81. Spores</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Click cells to place firebreaks (gold). Protect the teal targets. Then
				Start to release the fungus.
			</div>
			<div
				style={{
					display: "flex",
					gap: 16,
					alignItems: "center",
					marginBottom: 8,
				}}
			>
				<div>Firebreaks left: {breaks}</div>
				<div>Tick: {tick}</div>
				<button
					type="button"
					onClick={() => setRunning(true)}
					disabled={running || !!ended}
					style={btn}
				>
					Start
				</button>
				<button type="button" onClick={reset} style={btn}>
					Reset
				</button>
				{ended && (
					<strong>
						Saved {ended.saved}/{ended.total} targets
					</strong>
				)}
			</div>
			<div
				style={{
					display: "grid",
					gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
					gap: 1,
					background: "#000",
					width: "fit-content",
				}}
			>
				{grid.map((c, i) => (
					<div
						key={i}
						onClick={() => placeBreak(i)}
						style={{
							width: CELL,
							height: CELL,
							background: colorFor(c),
							cursor: running || ended ? "default" : "pointer",
						}}
					/>
				))}
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
