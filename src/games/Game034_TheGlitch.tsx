import { useEffect, useMemo, useState } from "react";

// 4x4 latin-square-like puzzle: each row and column must contain 1..4 exactly once.
// The board starts mostly filled; player fills the remaining cells.
// One cell is "corrupted" - it silently displays a wrong value when read by player edits
// (or rejects the correct value). Player must identify the corrupted cell.

type Cell = { value: number; given: boolean };

const N = 4;

function genSolution(): number[][] {
	// random latin square: start from base, shuffle rows then cols
	const base = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => ((r + c) % N) + 1));
	const shuffle = <T,>(arr: T[]) => {
		const a = [...arr];
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	};
	const rows = shuffle(base);
	const cols: number[][] = Array.from({ length: N }, (_, c) => rows.map((r) => r[c]));
	const colsShuffled = shuffle(cols);
	const out: number[][] = Array.from({ length: N }, (_, r) =>
		Array.from({ length: N }, (_, c) => colsShuffled[c][r]),
	);
	return out;
}

export default function TheGlitch() {
	const [seed, setSeed] = useState(0);
	const solution = useMemo(() => genSolution(), [seed]);
	const [glitchCell] = useMemo(() => {
		// pick a non-given cell as glitch source
		const c = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)];
		return [c as [number, number]];
	}, [seed]);
	const [glitchMode] = useMemo(() => {
		// "swap": shows wrong number even when correct entered
		// "reject": refuses correct value
		const modes = ["swap", "reject"] as const;
		return [modes[Math.floor(Math.random() * modes.length)]];
	}, [seed]);

	const [cells, setCells] = useState<Cell[][]>(() => {
		// fill ~half as givens
		return Array.from({ length: N }, (_, r) =>
			Array.from({ length: N }, (_, c) => {
				const given = Math.random() < 0.5;
				return { value: given ? solution[r][c] : 0, given };
			}),
		);
	});
	const [accusing, setAccusing] = useState(false);
	const [verdict, setVerdict] = useState<string | null>(null);

	useEffect(() => {
		// regenerate cells when seed changes
		setCells(
			Array.from({ length: N }, (_, r) =>
				Array.from({ length: N }, (_, c) => {
					const given = Math.random() < 0.5;
					return { value: given ? solution[r][c] : 0, given };
				}),
			),
		);
		setVerdict(null);
		setAccusing(false);
	}, [seed, solution]);

	const setVal = (r: number, c: number, v: number) => {
		setCells((cs) => {
			const ng = cs.map((row) => row.map((x) => ({ ...x })));
			if (ng[r][c].given) return cs;
			// apply glitch
			if (r === glitchCell[0] && c === glitchCell[1]) {
				if (glitchMode === "swap" && v === solution[r][c]) {
					// store wrong value (shifted)
					ng[r][c].value = (v % N) + 1;
					return ng;
				}
				if (glitchMode === "reject" && v === solution[r][c]) {
					ng[r][c].value = 0;
					return ng;
				}
			}
			ng[r][c].value = v;
			return ng;
		});
	};

	const handleCellClick = (r: number, c: number) => {
		if (accusing) {
			if (r === glitchCell[0] && c === glitchCell[1]) {
				setVerdict(`CORRECT! The glitch was at (${r + 1}, ${c + 1}), mode: ${glitchMode}.`);
			} else {
				setVerdict(`Wrong. That cell behaves normally. Glitch was at (${glitchCell[0] + 1}, ${glitchCell[1] + 1}).`);
			}
			setAccusing(false);
		}
	};

	const isSolved = useMemo(() => {
		for (let r = 0; r < N; r++) {
			const row = new Set(cells[r].map((x) => x.value));
			if (row.has(0) || row.size !== N) return false;
		}
		for (let c = 0; c < N; c++) {
			const col = new Set(cells.map((row) => row[c].value));
			if (col.has(0) || col.size !== N) return false;
		}
		return true;
	}, [cells]);

	return (
		<div style={{ background: "#0f0f1a", color: "#eee", padding: 16, fontFamily: "monospace" }}>
			<h2 style={{ margin: "0 0 4px" }}>The Glitch</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Solve the latin-square (1-4 each row/col). One cell secretly misbehaves. Find it.
			</div>
			<div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
				<button type="button" onClick={() => setSeed((s) => s + 1)}>
					New
				</button>
				<button type="button" onClick={() => setAccusing((a) => !a)}>
					{accusing ? "Cancel accuse" : "Accuse cell"}
				</button>
				{verdict && <div style={{ color: verdict.startsWith("CORRECT") ? "#7f7" : "#f77" }}>{verdict}</div>}
			</div>
			<div style={{ display: "inline-block", border: "2px solid #555" }}>
				{cells.map((row, r) => (
					<div key={r} style={{ display: "flex" }}>
						{row.map((cell, c) => (
							<div
								key={c}
								onClick={() => handleCellClick(r, c)}
								style={{
									width: 60,
									height: 60,
									border: "1px solid #333",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									background: cell.given ? "#222" : accusing ? "#321a1a" : "#1a1a2a",
									cursor: accusing ? "pointer" : "default",
								}}
							>
								{cell.given ? (
									<span style={{ fontSize: 22, color: "#aaa" }}>{cell.value}</span>
								) : (
									<select
										value={cell.value}
										onChange={(e) => setVal(r, c, Number(e.target.value))}
										style={{
											background: "transparent",
											color: "#fff",
											border: "none",
											fontSize: 22,
											textAlign: "center",
											fontFamily: "monospace",
										}}
									>
										<option value={0}>·</option>
										<option value={1}>1</option>
										<option value={2}>2</option>
										<option value={3}>3</option>
										<option value={4}>4</option>
									</select>
								)}
							</div>
						))}
					</div>
				))}
			</div>
			<div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
				{isSolved ? "Latin square complete." : "Fill all cells; rows/cols must be 1-4."}
			</div>
		</div>
	);
}
