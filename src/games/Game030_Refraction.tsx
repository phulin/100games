import { useEffect, useMemo, useRef, useState } from "react";

// Grid-based light puzzle. A white beam enters from the left edge. A "prism"
// splits it into 3 colored beams (R/G/B) traveling in 3 directions. "Mirrors"
// reflect a beam. Each colored beam must hit its matching target.

type CellType =
	| "empty"
	| "prism" // splits white into R up-right, G right, B down-right (relative)
	| "mirrorNE" // /  : right↔up, left↔down
	| "mirrorNW"; // \ : right↔down, left↔up

type Cell = { type: CellType };

type Dir = 0 | 1 | 2 | 3; // 0=right,1=down,2=left,3=up
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

type Beam = { x: number; y: number; dir: Dir; color: "R" | "G" | "B" | "W" };

const GRID_W = 12;
const GRID_H = 8;

type Target = { x: number; y: number; color: "R" | "G" | "B" };
type Level = {
	entry: { x: number; y: number; dir: Dir };
	targets: Target[];
	wallSet: Set<string>;
};

function makeLevel(_seed: number): Level {
	const targets: Target[] = [
		{ x: GRID_W - 1, y: 1, color: "R" },
		{ x: GRID_W - 1, y: 4, color: "G" },
		{ x: GRID_W - 1, y: 6, color: "B" },
	];
	return {
		entry: { x: 0, y: 3, dir: 0 },
		targets,
		wallSet: new Set<string>(),
	};
}

function traceBeams(level: Level, grid: Cell[][]): Beam[] {
	const out: Beam[] = [];
	const stack: Beam[] = [
		{ x: level.entry.x, y: level.entry.y, dir: level.entry.dir, color: "W" },
	];
	const seen = new Set<string>();
	let steps = 0;
	while (stack.length && steps < 500) {
		steps++;
		const b = stack.pop()!;
		let { x, y, dir, color } = b;
		while (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
			const key = `${x},${y},${dir},${color}`;
			if (seen.has(key)) break;
			seen.add(key);
			out.push({ x, y, dir, color });
			const cell = grid[y][x];
			if (cell.type === "prism" && color === "W") {
				// Split into R/G/B along three directions relative to incoming dir.
				// We'll send R = (dir-1) mod 4, G = dir, B = (dir+1) mod 4
				const dR = ((dir + 3) % 4) as Dir;
				const dG = dir;
				const dB = ((dir + 1) % 4) as Dir;
				stack.push({ x: x + DX[dR], y: y + DY[dR], dir: dR, color: "R" });
				stack.push({ x: x + DX[dG], y: y + DY[dG], dir: dG, color: "G" });
				stack.push({ x: x + DX[dB], y: y + DY[dB], dir: dB, color: "B" });
				break;
			}
			if (cell.type === "mirrorNE") {
				// /
				// right (0) -> up (3); up (3) -> right (0); left (2) -> down (1); down (1) -> left (2)
				const map: Record<Dir, Dir> = { 0: 3, 1: 2, 2: 1, 3: 0 } as Record<
					Dir,
					Dir
				>;
				dir = map[dir];
			} else if (cell.type === "mirrorNW") {
				// \
				const map: Record<Dir, Dir> = { 0: 1, 1: 0, 2: 3, 3: 2 } as Record<
					Dir,
					Dir
				>;
				dir = map[dir];
			}
			x += DX[dir];
			y += DY[dir];
		}
	}
	return out;
}

const TOOLS: { label: string; type: CellType; icon: string }[] = [
	{ label: "Empty", type: "empty", icon: "·" },
	{ label: "Prism", type: "prism", icon: "△" },
	{ label: "Mirror /", type: "mirrorNE", icon: "/" },
	{ label: "Mirror \\", type: "mirrorNW", icon: "\\" },
];

export default function Refraction() {
	const level = useMemo(() => makeLevel(1), []);
	const [grid, setGrid] = useState<Cell[][]>(() =>
		Array.from({ length: GRID_H }, () =>
			Array.from({ length: GRID_W }, () => ({ type: "empty" }) as Cell),
		),
	);
	const [tool, setTool] = useState<CellType>("prism");
	const beams = useMemo(() => traceBeams(level, grid), [grid, level]);

	const setCell = (x: number, y: number) => {
		if (x === level.entry.x && y === level.entry.y) return;
		if (level.targets.some((t) => t.x === x && t.y === y)) return;
		const ng = grid.map((row) => row.map((c) => ({ ...c })));
		ng[y][x] = { type: tool };
		setGrid(ng);
	};

	const hits = level.targets.map(
		(t) =>
			beams.some(
				(b) => b.x === t.x && b.y === t.y && b.color === t.color,
			),
	);
	const won = hits.every(Boolean);

	const cellSize = 44;

	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	useEffect(() => {
		const ctx = canvasRef.current?.getContext("2d");
		if (!ctx) return;
		const W = GRID_W * cellSize;
		const H = GRID_H * cellSize;
		ctx.clearRect(0, 0, W, H);
		// draw beams as little lines from cell center toward dir
		for (const b of beams) {
			const cx = b.x * cellSize + cellSize / 2;
			const cy = b.y * cellSize + cellSize / 2;
			const nx = cx + DX[b.dir] * cellSize * 0.55;
			const ny = cy + DY[b.dir] * cellSize * 0.55;
			ctx.strokeStyle =
				b.color === "R"
					? "#ff5050"
					: b.color === "G"
						? "#50ff80"
						: b.color === "B"
							? "#5090ff"
							: "#ffffff";
			ctx.lineWidth = b.color === "W" ? 4 : 3;
			ctx.shadowBlur = 8;
			ctx.shadowColor = ctx.strokeStyle;
			ctx.beginPath();
			ctx.moveTo(cx - DX[b.dir] * cellSize * 0.55, cy - DY[b.dir] * cellSize * 0.55);
			ctx.lineTo(nx, ny);
			ctx.stroke();
			ctx.shadowBlur = 0;
		}
	}, [beams]);

	const reset = () => {
		setGrid(
			Array.from({ length: GRID_H }, () =>
				Array.from({ length: GRID_W }, () => ({ type: "empty" }) as Cell),
			),
		);
	};

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "radial-gradient(circle,#0a0a14,#000)",
				color: "#e8e8f0",
				fontFamily: "monospace",
				padding: 16,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
			}}
		>
			<h2 style={{ margin: 0 }}>Refraction</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Place a prism to split the white beam. Mirrors redirect. Each colored
				beam must hit its target.
			</div>
			<div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
				{TOOLS.map((t) => (
					<button
						type="button"
						key={t.type}
						onClick={() => setTool(t.type)}
						style={{
							padding: "6px 12px",
							background: tool === t.type ? "#5a8cff" : "#222",
							color: "#fff",
							border: "1px solid #555",
							borderRadius: 3,
							cursor: "pointer",
							fontFamily: "monospace",
						}}
					>
						{t.icon} {t.label}
					</button>
				))}
				<button
					type="button"
					onClick={reset}
					style={{
						padding: "6px 12px",
						background: "#333",
						color: "#fff",
						border: "1px solid #555",
						borderRadius: 3,
						cursor: "pointer",
					}}
				>
					Clear
				</button>
			</div>
			<div
				style={{
					position: "relative",
					width: GRID_W * cellSize,
					height: GRID_H * cellSize,
					border: "1px solid #333",
					background: "#050510",
				}}
			>
				{/* grid */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: `repeat(${GRID_W}, ${cellSize}px)`,
						gridTemplateRows: `repeat(${GRID_H}, ${cellSize}px)`,
					}}
				>
					{grid.flatMap((row, y) =>
						row.map((cell, x) => {
							const isEntry = x === level.entry.x && y === level.entry.y;
							const tgt = level.targets.find((t) => t.x === x && t.y === y);
							return (
								<div
									key={`${x}-${y}`}
									onClick={() => setCell(x, y)}
									style={{
										width: cellSize,
										height: cellSize,
										border: "1px solid rgba(80,80,120,0.2)",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontSize: 24,
										cursor: "pointer",
										background: tgt
											? tgt.color === "R"
												? "rgba(255,80,80,0.25)"
												: tgt.color === "G"
													? "rgba(80,255,128,0.25)"
													: "rgba(80,144,255,0.25)"
											: isEntry
												? "rgba(255,255,255,0.15)"
												: "transparent",
										color:
											cell.type === "prism"
												? "#ffd28c"
												: cell.type === "mirrorNE" ||
													  cell.type === "mirrorNW"
													? "#8cccff"
													: "#444",
									}}
								>
									{cell.type === "prism"
										? "△"
										: cell.type === "mirrorNE"
											? "/"
											: cell.type === "mirrorNW"
												? "\\"
												: tgt
													? "◎"
													: isEntry
														? "→"
														: ""}
								</div>
							);
						}),
					)}
				</div>
				{/* beam overlay */}
				<canvas
					ref={canvasRef}
					width={GRID_W * cellSize}
					height={GRID_H * cellSize}
					style={{
						position: "absolute",
						left: 0,
						top: 0,
						pointerEvents: "none",
					}}
				/>
			</div>
			<div style={{ marginTop: 10, display: "flex", gap: 14 }}>
				{level.targets.map((t, i) => (
					<div
						key={t.color}
						style={{
							padding: "4px 10px",
							borderRadius: 3,
							border: `2px solid ${
								t.color === "R" ? "#ff5050" : t.color === "G" ? "#50ff80" : "#5090ff"
							}`,
							color: hits[i] ? "#9bcc70" : "#ccc",
						}}
					>
						{t.color}: {hits[i] ? "✓" : "—"}
					</div>
				))}
			</div>
			{won && (
				<div style={{ marginTop: 8, color: "#9bcc70", fontSize: 16 }}>
					All beams routed!
				</div>
			)}
		</div>
	);
}
