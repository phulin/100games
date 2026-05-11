import { useMemo, useState } from "react";

// A small "reverse chess" puzzle: you are given an endgame-ish position and a
// short tape of past moves. Un-play them back in order. Picking the wrong
// piece-square pair to un-do costs a strike. Three strikes = lose.

type Piece = { color: "w" | "b"; kind: "K" | "Q" | "R" | "B" | "N" | "P" };
type Board = (Piece | null)[][]; // 8 rows, row 0 = rank 8

type ReverseMove = {
	// describes the move that JUST happened; un-doing it means moving the
	// piece on `to` back to `from`, restoring any captured piece on `to`.
	from: [number, number];
	to: [number, number];
	captured?: Piece;
	mover: Piece;
};

type Puzzle = {
	name: string;
	final: Board;
	tape: ReverseMove[]; // last move at index 0, first move at end
};

const emptyBoard = (): Board =>
	Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));

function place(b: Board, r: number, c: number, p: Piece | null) {
	b[r][c] = p;
}

function clone(b: Board): Board {
	return b.map((row) => row.slice());
}

// Hand-curated tiny puzzles. Coordinates are [row, col] with row 0 = rank 8.
function buildPuzzles(): Puzzle[] {
	// Puzzle A: a simple king + pawn ending. Tape:
	//  1. White Kf6-Kg6   2. Black Kf8-Ke8   3. White e5-e6
	const A: Board = emptyBoard();
	place(A, 2, 6, { color: "w", kind: "K" }); // g6
	place(A, 0, 4, { color: "b", kind: "K" }); // e8
	place(A, 2, 4, { color: "w", kind: "P" }); // e6
	const tapeA: ReverseMove[] = [
		{
			mover: { color: "w", kind: "P" },
			from: [3, 4],
			to: [2, 4],
		},
		{
			mover: { color: "b", kind: "K" },
			from: [0, 5],
			to: [0, 4],
		},
		{
			mover: { color: "w", kind: "K" },
			from: [2, 5],
			to: [2, 6],
		},
	];

	// Puzzle B: rook capture rollback.
	const B: Board = emptyBoard();
	place(B, 0, 0, { color: "w", kind: "R" }); // a8
	place(B, 7, 4, { color: "w", kind: "K" }); // e1
	place(B, 0, 7, { color: "b", kind: "K" }); // h8
	const tapeB: ReverseMove[] = [
		{
			mover: { color: "w", kind: "R" },
			from: [0, 3],
			to: [0, 0],
			captured: { color: "b", kind: "R" },
		},
		{
			mover: { color: "b", kind: "K" },
			from: [1, 7],
			to: [0, 7],
		},
		{
			mover: { color: "w", kind: "R" },
			from: [3, 3],
			to: [0, 3],
		},
	];

	// Puzzle C: knight maneuver.
	const C: Board = emptyBoard();
	place(C, 5, 5, { color: "w", kind: "N" }); // f3
	place(C, 7, 4, { color: "w", kind: "K" }); // e1
	place(C, 0, 4, { color: "b", kind: "K" }); // e8
	place(C, 4, 4, { color: "b", kind: "P" }); // e4
	const tapeC: ReverseMove[] = [
		{
			mover: { color: "w", kind: "N" },
			from: [3, 4],
			to: [5, 5],
		},
		{
			mover: { color: "b", kind: "P" },
			from: [3, 4],
			to: [4, 4],
		},
		{
			mover: { color: "w", kind: "N" },
			from: [5, 6],
			to: [3, 4],
			captured: { color: "b", kind: "P" },
		},
	];

	return [
		{ name: "K+P ending", final: A, tape: tapeA },
		{ name: "Rook rollback", final: B, tape: tapeB },
		{ name: "Knight dance", final: C, tape: tapeC },
	];
}

const GLYPH: Record<string, string> = {
	wK: "♔",
	wQ: "♕",
	wR: "♖",
	wB: "♗",
	wN: "♘",
	wP: "♙",
	bK: "♚",
	bQ: "♛",
	bR: "♜",
	bB: "♝",
	bN: "♞",
	bP: "♟",
};

function fileChar(c: number) {
	return "abcdefgh"[c];
}
function rankChar(r: number) {
	return String(8 - r);
}
function sq(r: number, c: number) {
	return fileChar(c) + rankChar(r);
}

export default function BackwardsChess() {
	const puzzles = useMemo(buildPuzzles, []);
	const [pIdx, setPIdx] = useState(0);
	const [board, setBoard] = useState<Board>(() => clone(puzzles[0].final));
	const [tapeIdx, setTapeIdx] = useState(0); // index into puzzles[pIdx].tape
	const [selected, setSelected] = useState<[number, number] | null>(null);
	const [strikes, setStrikes] = useState(0);
	const [score, setScore] = useState(0);
	const [msg, setMsg] = useState("Un-play the most recent move first.");
	const puzzle = puzzles[pIdx];
	const won = tapeIdx >= puzzle.tape.length;

	const loadPuzzle = (i: number) => {
		const p = puzzles[i % puzzles.length];
		setPIdx(i % puzzles.length);
		setBoard(clone(p.final));
		setTapeIdx(0);
		setSelected(null);
		setMsg("Un-play the most recent move first.");
	};

	const onSquare = (r: number, c: number) => {
		if (won || strikes >= 3) return;
		const next = puzzle.tape[tapeIdx];
		if (!selected) {
			if (board[r][c]) setSelected([r, c]);
			return;
		}
		const [sr, sc] = selected;
		// Click same square: deselect.
		if (sr === r && sc === c) {
			setSelected(null);
			return;
		}
		// Player asserts: the piece on (sr,sc) was just moved here from (r,c).
		// So we need: next.to == (sr,sc) and next.from == (r,c).
		const isCorrect =
			next.to[0] === sr &&
			next.to[1] === sc &&
			next.from[0] === r &&
			next.from[1] === c &&
			board[r][c] === null;
		if (!isCorrect) {
			setStrikes((s) => s + 1);
			setMsg(`No — that's not the last move. (strike ${strikes + 1}/3)`);
			setSelected(null);
			return;
		}
		const nb = clone(board);
		nb[r][c] = nb[sr][sc];
		nb[sr][sc] = next.captured ?? null;
		setBoard(nb);
		setTapeIdx((t) => t + 1);
		setSelected(null);
		setScore((s) => s + 10);
		setMsg(
			`Reversed ${next.mover.color === "w" ? "White" : "Black"}'s ${
				next.mover.kind
			}: ${sq(sr, sc)} ← ${sq(r, c)}.`,
		);
	};

	const lost = strikes >= 3 && !won;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#1b1410",
				color: "#e8dcc6",
				fontFamily: "Georgia, serif",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				padding: 16,
				boxSizing: "border-box",
			}}
		>
			<div style={{ textAlign: "center" }}>
				<h2 style={{ margin: 0 }}>Backwards Chess</h2>
				<div style={{ fontSize: 13, opacity: 0.75 }}>
					Click the destination square of the last move, then its origin, to
					un-play it.
				</div>
			</div>
			<div
				style={{
					display: "flex",
					gap: 24,
					marginTop: 14,
					alignItems: "flex-start",
				}}
			>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(8, 52px)",
						gridTemplateRows: "repeat(8, 52px)",
						border: "3px solid #6b4a2a",
					}}
				>
					{board.flatMap((row, r) =>
						row.map((p, c) => {
							const light = (r + c) % 2 === 0;
							const sel = selected && selected[0] === r && selected[1] === c;
							return (
								<div
									key={`${r}-${c}`}
									onClick={() => onSquare(r, c)}
									style={{
										width: 52,
										height: 52,
										background: sel
											? "#d4a04a"
											: light
												? "#e8d6b3"
												: "#8a5a36",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontSize: 38,
										color: p?.color === "w" ? "#fff" : "#111",
										cursor: "pointer",
										userSelect: "none",
										textShadow:
											p?.color === "w"
												? "0 0 2px #000, 0 0 2px #000"
												: "0 0 2px #fff",
									}}
								>
									{p ? GLYPH[p.color + p.kind] : ""}
								</div>
							);
						}),
					)}
				</div>
				<div style={{ minWidth: 220 }}>
					<div style={{ fontSize: 14, marginBottom: 8 }}>
						Puzzle: <b>{puzzle.name}</b>
					</div>
					<div style={{ fontSize: 14 }}>Score: {score}</div>
					<div style={{ fontSize: 14 }}>Strikes: {strikes}/3</div>
					<div style={{ fontSize: 14, marginTop: 8 }}>
						Moves to reverse: {puzzle.tape.length - tapeIdx}
					</div>
					<div
						style={{
							marginTop: 10,
							padding: 8,
							background: "#2a1f17",
							borderRadius: 4,
							fontSize: 13,
							minHeight: 60,
						}}
					>
						{msg}
					</div>
					{won && (
						<div style={{ marginTop: 10, color: "#9bcc70", fontWeight: 600 }}>
							Solved! +20 bonus.
						</div>
					)}
					{lost && (
						<div style={{ marginTop: 10, color: "#cc7070", fontWeight: 600 }}>
							Too many strikes.
						</div>
					)}
					<button
						type="button"
						onClick={() => {
							if (won) setScore((s) => s + 20);
							loadPuzzle(pIdx + 1);
							setStrikes(0);
						}}
						style={{
							marginTop: 12,
							padding: "6px 12px",
							background: "#6b4a2a",
							color: "#fff",
							border: "none",
							borderRadius: 3,
							cursor: "pointer",
						}}
					>
						Next puzzle
					</button>
					<button
						type="button"
						onClick={() => loadPuzzle(pIdx)}
						style={{
							marginLeft: 8,
							marginTop: 12,
							padding: "6px 12px",
							background: "#3a2a1f",
							color: "#fff",
							border: "1px solid #6b4a2a",
							borderRadius: 3,
							cursor: "pointer",
						}}
					>
						Reset
					</button>
				</div>
			</div>
		</div>
	);
}
