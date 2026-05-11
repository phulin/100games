import { useMemo, useState } from "react";

// Cross-stitch: pattern is a grid of cells with optional colors (max 2 colors here).
// Player places stitches by clicking; must form a continuous path within a color thread.
// New thread = starting a new color OR breaking continuity (rest button).

const N = 8;
type Cell = "" | "r" | "b"; // empty, red, blue
type Pattern = Cell[][];

function makePattern(): Pattern {
	const p: Pattern = Array.from({ length: N }, () => Array<Cell>(N).fill(""));
	// simple heart-ish shape
	const positions = [
		[1, 2, "r"],
		[1, 5, "r"],
		[2, 1, "r"],
		[2, 3, "r"],
		[2, 4, "r"],
		[2, 6, "r"],
		[3, 1, "r"],
		[3, 6, "r"],
		[4, 2, "r"],
		[4, 5, "r"],
		[5, 3, "r"],
		[5, 4, "r"],
		// blue accent
		[6, 3, "b"],
		[6, 4, "b"],
		[5, 1, "b"],
		[5, 6, "b"],
	] as const;
	for (const [r, c, k] of positions) p[r][c] = k as Cell;
	return p;
}

function adjacent(a: [number, number], b: [number, number]): boolean {
	const dr = Math.abs(a[0] - b[0]),
		dc = Math.abs(a[1] - b[1]);
	return dr + dc === 1 || (dr === 1 && dc === 1);
}

export default function Game098_Stitchwork() {
	const target = useMemo(() => makePattern(), []);
	const [board, setBoard] = useState<Pattern>(() =>
		Array.from({ length: N }, () => Array<Cell>(N).fill("")),
	);
	const [thread, setThread] = useState<"r" | "b">("r");
	const [lastPos, setLastPos] = useState<[number, number] | null>(null);
	const [threads, setThreads] = useState(1);
	const [error, setError] = useState<string>("");

	function place(r: number, c: number) {
		if (board[r][c]) {
			setError("already stitched there");
			return;
		}
		if (lastPos && !adjacent([r, c], lastPos)) {
			setError(`not adjacent — start a new thread to skip`);
			return;
		}
		if (target[r][c] !== thread) {
			setError(`target wants ${target[r][c] || "empty"} here, not ${thread}`);
			return;
		}
		const nb = board.map((row) => row.slice());
		nb[r][c] = thread;
		setBoard(nb);
		setLastPos([r, c]);
		setError("");
	}
	function newThread(t: "r" | "b") {
		setThread(t);
		setLastPos(null);
		setThreads((n) => n + 1);
	}
	function reset() {
		setBoard(Array.from({ length: N }, () => Array<Cell>(N).fill("")));
		setThread("r");
		setLastPos(null);
		setThreads(1);
		setError("");
	}

	const complete = board.every((row, r) =>
		row.every((c, ci) => c === target[r][ci]),
	);
	const totalNeeded = target.flat().filter(Boolean).length;
	const placedCount = board.flat().filter(Boolean).length;

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "system-ui",
				background: "#fff7f0",
				color: "#3a2014",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px" }}>Stitchwork</h2>
			<p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
				Reproduce the pattern. You may only place stitches adjacent to your last
				one (incl. diagonal). Start a new thread to skip.
			</p>

			<div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
				<div>
					<div style={{ fontSize: 12, marginBottom: 4 }}>Target</div>
					<Grid grid={target} faded />
				</div>
				<div>
					<div style={{ fontSize: 12, marginBottom: 4 }}>Your work</div>
					<Grid grid={board} onClick={place} lastPos={lastPos} />
				</div>
				<div style={{ width: 200 }}>
					<div style={{ marginBottom: 8 }}>
						<strong>Thread:</strong>{" "}
						<button
							onClick={() => newThread("r")}
							style={{
								background: thread === "r" ? "#e63946" : "#fdd",
								color: thread === "r" ? "#fff" : "#600",
								marginRight: 4,
							}}
						>
							Red
						</button>
						<button
							onClick={() => newThread("b")}
							style={{
								background: thread === "b" ? "#2a6df4" : "#ddf",
								color: thread === "b" ? "#fff" : "#006",
							}}
						>
							Blue
						</button>
					</div>
					<div>
						Threads used: <strong>{threads}</strong>
					</div>
					<div>
						Progress: {placedCount}/{totalNeeded}
					</div>
					<div
						style={{
							minHeight: 24,
							color: "#c0392b",
							fontSize: 12,
							marginTop: 6,
						}}
					>
						{error}
					</div>
					<button onClick={reset} style={{ marginTop: 8 }}>
						Reset
					</button>
					{complete && (
						<div
							style={{
								marginTop: 12,
								padding: 10,
								background: "#dff5d8",
								borderRadius: 4,
							}}
						>
							<strong>Complete!</strong> Used {threads} threads (lower is finer
							work).
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function Grid({
	grid,
	onClick,
	lastPos,
	faded,
}: {
	grid: Pattern;
	onClick?: (r: number, c: number) => void;
	lastPos?: [number, number] | null;
	faded?: boolean;
}) {
	return (
		<div
			style={{
				display: "inline-block",
				background: "#f1e0c8",
				padding: 4,
				border: "1px solid #b8a47a",
				borderRadius: 4,
			}}
		>
			{grid.map((row, r) => (
				<div key={r} style={{ display: "flex" }}>
					{row.map((c, ci) => {
						const last = lastPos && lastPos[0] === r && lastPos[1] === ci;
						const color =
							c === "r" ? "#e63946" : c === "b" ? "#2a6df4" : "transparent";
						return (
							<div
								key={ci}
								onClick={() => onClick?.(r, ci)}
								style={{
									width: 28,
									height: 28,
									border: "1px solid #d0bf99",
									background:
										faded && c ? `${color}55` : last ? "#fff4a1" : "#fff",
									cursor: onClick ? "pointer" : "default",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								{c && !faded && (
									<span style={{ color, fontSize: 22, lineHeight: 1 }}>✕</span>
								)}
								{c && faded && (
									<span
										style={{
											color: c === "r" ? "#a00" : "#024",
											fontSize: 22,
											lineHeight: 1,
										}}
									>
										✕
									</span>
								)}
							</div>
						);
					})}
				</div>
			))}
		</div>
	);
}
