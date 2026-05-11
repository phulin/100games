import { useEffect, useMemo, useRef, useState } from "react";

// A small "reverse chess" puzzle: you are given an endgame-ish position and a
// short tape of past moves. Un-play them back in order. Picking the wrong
// piece-square pair to un-do costs a strike. Three strikes = lose.
//
// All puzzles are procedurally generated from a seed: we place a few pieces on
// an empty board, then simulate a short forward sequence of legal-ish moves
// (king single steps, knight L-jumps, rook/bishop/queen slides with path
// clearance, pawn one-step pushes with optional capture). The "tape" we hand
// the player is the reverse of what we generated, so same seed = same puzzle.

// ---------- seeded RNG (mulberry32) ----------
function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hashSeed(s: string): number {
	let h = 2166136261 >>> 0;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

type Piece = { color: "w" | "b"; kind: "K" | "Q" | "R" | "B" | "N" | "P" };
type Board = (Piece | null)[][]; // 8 rows, row 0 = rank 8

type ReverseMove = {
	from: [number, number];
	to: [number, number];
	captured?: Piece;
	mover: Piece;
};

type Puzzle = {
	name: string;
	final: Board;
	tape: ReverseMove[];
};

const emptyBoard = (): Board =>
	Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => null));

function clone(b: Board): Board {
	return b.map((row) => row.slice());
}

const inBoard = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

function moveCandidates(
	piece: Piece,
	r: number,
	c: number,
): [number, number][] {
	const out: [number, number][] = [];
	const add = (dr: number, dc: number) => {
		const nr = r + dr;
		const nc = c + dc;
		if (inBoard(nr, nc)) out.push([nr, nc]);
	};
	switch (piece.kind) {
		case "K":
			for (let dr = -1; dr <= 1; dr++)
				for (let dc = -1; dc <= 1; dc++) if (dr || dc) add(dr, dc);
			break;
		case "N":
			for (const [dr, dc] of [
				[-2, -1],
				[-2, 1],
				[-1, -2],
				[-1, 2],
				[1, -2],
				[1, 2],
				[2, -1],
				[2, 1],
			] as const)
				add(dr, dc);
			break;
		case "R":
			for (let k = 1; k < 8; k++) {
				add(0, k);
				add(0, -k);
				add(k, 0);
				add(-k, 0);
			}
			break;
		case "B":
			for (let k = 1; k < 8; k++) {
				add(k, k);
				add(k, -k);
				add(-k, k);
				add(-k, -k);
			}
			break;
		case "Q":
			for (let k = 1; k < 8; k++) {
				add(0, k);
				add(0, -k);
				add(k, 0);
				add(-k, 0);
				add(k, k);
				add(k, -k);
				add(-k, k);
				add(-k, -k);
			}
			break;
		case "P": {
			const dir = piece.color === "w" ? -1 : 1;
			add(dir, 0);
			add(dir, -1);
			add(dir, 1);
			break;
		}
	}
	return out;
}

function pathClear(
	b: Board,
	sr: number,
	sc: number,
	tr: number,
	tc: number,
) {
	const dr = Math.sign(tr - sr);
	const dc = Math.sign(tc - sc);
	let r = sr + dr;
	let c = sc + dc;
	while (r !== tr || c !== tc) {
		if (b[r][c]) return false;
		r += dr;
		c += dc;
	}
	return true;
}

function generatePuzzle(seed: number, depth: number): Puzzle {
	const rng = mulberry32(seed);
	const pick = <T,>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

	const start: Board = emptyBoard();
	const used = new Set<string>();
	const placeUnique = (
		p: Piece,
		allowed?: (r: number, c: number) => boolean,
	) => {
		for (let tries = 0; tries < 80; tries++) {
			const r = Math.floor(rng() * 8);
			const c = Math.floor(rng() * 8);
			const k = `${r},${c}`;
			if (used.has(k)) continue;
			if (allowed && !allowed(r, c)) continue;
			used.add(k);
			start[r][c] = p;
			return [r, c] as [number, number];
		}
		return null;
	};

	const wkPos = placeUnique({ color: "w", kind: "K" });
	placeUnique(
		{ color: "b", kind: "K" },
		(r, c) =>
			!!wkPos && Math.max(Math.abs(r - wkPos[0]), Math.abs(c - wkPos[1])) >= 3,
	);

	const extras: Piece["kind"][] = ["R", "N", "B", "P", "Q"];
	const extraCount = 2 + Math.floor(rng() * 2);
	for (let i = 0; i < extraCount; i++) {
		const kind = pick(extras);
		const color: "w" | "b" = rng() < 0.5 ? "w" : "b";
		const allowed = (r: number, _c: number) =>
			kind !== "P" || (r >= 1 && r <= 6);
		placeUnique({ color, kind }, allowed);
	}

	const forward: ReverseMove[] = [];
	const b = clone(start);
	let turn: "w" | "b" = rng() < 0.5 ? "w" : "b";

	for (let m = 0; m < depth; m++) {
		const own: [number, number, Piece][] = [];
		for (let r = 0; r < 8; r++)
			for (let c = 0; c < 8; c++) {
				const p = b[r][c];
				if (p && p.color === turn) own.push([r, c, p]);
			}
		if (own.length === 0) break;

		let played = false;
		for (let attempt = 0; attempt < 40 && !played; attempt++) {
			const [sr, sc, piece] = pick(own);
			const cand = moveCandidates(piece, sr, sc);
			if (cand.length === 0) continue;
			const [tr, tc] = pick(cand);
			const target = b[tr][tc];
			if (target && target.color === piece.color) continue;
			if (target && target.kind === "K") continue;
			if (piece.kind === "P") {
				const forwardOne =
					piece.color === "w" ? sr - 1 === tr : sr + 1 === tr;
				if (!forwardOne) continue;
				const isDiag = sc !== tc;
				if (isDiag) {
					if (!target) continue;
				} else {
					if (target) continue;
				}
			}
			if (piece.kind === "R" || piece.kind === "B" || piece.kind === "Q") {
				if (!pathClear(b, sr, sc, tr, tc)) continue;
			}
			const captured = target ?? undefined;
			b[tr][tc] = piece;
			b[sr][sc] = null;
			forward.push({
				mover: piece,
				from: [sr, sc],
				to: [tr, tc],
				captured: captured ?? undefined,
			});
			played = true;
		}
		if (!played) break;
		turn = turn === "w" ? "b" : "w";
	}

	const tape = forward.slice().reverse();
	const name = `Puzzle #${seed.toString(36).slice(-4)} (${tape.length} ply)`;
	return { name, final: b, tape };
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

function dailySeed(): number {
	const d = new Date();
	const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
	return hashSeed("bchess-daily:" + key);
}

export default function BackwardsChess() {
	const [seedInput, setSeedInput] = useState("");
	const [seed, setSeed] = useState<number>(() => dailySeed());
	const [depth, setDepth] = useState(3);

	const puzzle = useMemo(() => {
		let p = generatePuzzle(seed, depth);
		let bump = 0;
		while (p.tape.length === 0 && bump < 8) {
			p = generatePuzzle(seed + ++bump, depth);
		}
		return p;
	}, [seed, depth]);

	const [board, setBoard] = useState<Board>(() => clone(puzzle.final));
	const [tapeIdx, setTapeIdx] = useState(0);
	const [selected, setSelected] = useState<[number, number] | null>(null);
	const [strikes, setStrikes] = useState(0);
	const [score, setScore] = useState(0);
	const [msg, setMsg] = useState("Un-play the most recent move first.");
	const [hintUsed, setHintUsed] = useState(0);
	const [hintFlash, setHintFlash] = useState<Set<string>>(new Set());

	useEffect(() => {
		setBoard(clone(puzzle.final));
		setTapeIdx(0);
		setSelected(null);
		setStrikes(0);
		setHintUsed(0);
		setMsg("Un-play the most recent move first.");
		setHintFlash(new Set());
	}, [puzzle]);

	const won = tapeIdx >= puzzle.tape.length && puzzle.tape.length > 0;
	const lost = strikes >= 3 && !won;

	const audioRef = useRef<AudioContext | null>(null);
	const ensureAudio = () => {
		if (audioRef.current) return audioRef.current;
		const Ctor =
			(window as unknown as { AudioContext: typeof AudioContext })
				.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext;
		audioRef.current = new Ctor();
		return audioRef.current;
	};
	useEffect(
		() => () => {
			audioRef.current?.close();
		},
		[],
	);
	const beep = (
		freq: number,
		dur = 0.1,
		type: OscillatorType = "sine",
		vol = 0.15,
	) => {
		const ctx = audioRef.current;
		if (!ctx) return;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = type;
		osc.frequency.value = freq;
		g.gain.value = vol;
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
		osc.connect(g);
		g.connect(ctx.destination);
		osc.start();
		osc.stop(ctx.currentTime + dur);
	};

	const onSquare = (r: number, c: number) => {
		ensureAudio();
		if (won || lost) return;
		const next = puzzle.tape[tapeIdx];
		if (!selected) {
			if (board[r][c]) {
				setSelected([r, c]);
				beep(660, 0.05, "triangle", 0.08);
			}
			return;
		}
		const [sr, sc] = selected;
		if (sr === r && sc === c) {
			setSelected(null);
			return;
		}
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
			beep(140, 0.18, "sawtooth", 0.2);
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
		beep(523, 0.06, "sine", 0.12);
		setTimeout(() => beep(659, 0.06, "sine", 0.12), 60);
		setTimeout(() => beep(784, 0.08, "sine", 0.12), 120);
	};

	const useHint = () => {
		ensureAudio();
		if (won || lost) return;
		const next = puzzle.tape[tapeIdx];
		if (!next) return;
		const k1 = `${next.to[0]},${next.to[1]}`;
		const k2 = `${next.from[0]},${next.from[1]}`;
		setHintFlash(new Set([k1, k2]));
		setHintUsed((h) => h + 1);
		setScore((s) => Math.max(0, s - 5));
		setMsg("Hint: destination and origin highlighted.");
		setTimeout(() => setHintFlash(new Set()), 1500);
		beep(880, 0.08, "triangle", 0.1);
	};

	const undoLast = () => {
		if (tapeIdx === 0) return;
		const prev = puzzle.tape[tapeIdx - 1];
		const nb = clone(board);
		nb[prev.to[0]][prev.to[1]] = nb[prev.from[0]][prev.from[1]];
		nb[prev.from[0]][prev.from[1]] = null;
		setBoard(nb);
		setTapeIdx(tapeIdx - 1);
		setMsg("Stepped one move forward (undid your last un-play).");
		setScore((s) => Math.max(0, s - 2));
	};

	const newDaily = () => setSeed(dailySeed());
	const newRandom = () => setSeed((Math.random() * 1e9) >>> 0);
	const applySeed = () => {
		const s = seedInput.trim();
		if (!s) return;
		setSeed(hashSeed(s));
	};

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
				overflow: "auto",
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
					flexWrap: "wrap",
					justifyContent: "center",
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
							const hint = hintFlash.has(`${r},${c}`);
							return (
								<div
									key={`${r}-${c}`}
									onClick={() => onSquare(r, c)}
									style={{
										width: 52,
										height: 52,
										background: hint
											? "#e87f3a"
											: sel
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
										position: "relative",
										textShadow:
											p?.color === "w"
												? "0 0 2px #000, 0 0 2px #000"
												: "0 0 2px #fff",
									}}
								>
									{p ? GLYPH[p.color + p.kind] : ""}
									{(r === 7 || c === 0) && (
										<span
											style={{
												position: "absolute",
												fontSize: 9,
												opacity: 0.55,
												color: "#3a261a",
												right: 2,
												bottom: 0,
												pointerEvents: "none",
												textShadow: "none",
											}}
										>
											{r === 7 ? fileChar(c) : ""}
											{c === 0 ? rankChar(r) : ""}
										</span>
									)}
								</div>
							);
						}),
					)}
				</div>
				<div style={{ minWidth: 240, maxWidth: 320 }}>
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
						<div
							style={{ marginTop: 10, color: "#9bcc70", fontWeight: 600 }}
						>
							Solved! +{Math.max(0, 20 - hintUsed * 2)} bonus.
						</div>
					)}
					{lost && (
						<div
							style={{ marginTop: 10, color: "#cc7070", fontWeight: 600 }}
						>
							Too many strikes.
						</div>
					)}
					<div
						style={{
							marginTop: 10,
							display: "flex",
							gap: 6,
							flexWrap: "wrap",
						}}
					>
						<button
							type="button"
							onClick={() => {
								if (won)
									setScore((s) => s + Math.max(0, 20 - hintUsed * 2));
								newRandom();
							}}
							style={btn("primary")}
						>
							Next (random)
						</button>
						<button type="button" onClick={newDaily} style={btn("ghost")}>
							Daily
						</button>
						<button
							type="button"
							onClick={useHint}
							disabled={won || lost}
							style={btn("ghost")}
						>
							Hint (-5)
						</button>
						<button
							type="button"
							onClick={undoLast}
							disabled={tapeIdx === 0}
							style={btn("ghost")}
						>
							Undo
						</button>
					</div>
					<div style={{ marginTop: 12, display: "flex", gap: 6 }}>
						<input
							type="text"
							placeholder="seed (any text)"
							value={seedInput}
							onChange={(e) => setSeedInput(e.target.value)}
							style={{
								flex: 1,
								padding: "4px 6px",
								background: "#2a1f17",
								color: "#fff",
								border: "1px solid #6b4a2a",
								borderRadius: 3,
								fontFamily: "inherit",
							}}
						/>
						<button type="button" onClick={applySeed} style={btn("ghost")}>
							Set
						</button>
					</div>
					<div
						style={{
							marginTop: 12,
							fontSize: 12,
							display: "flex",
							gap: 6,
							alignItems: "center",
						}}
					>
						Depth:
						{[2, 3, 4, 5].map((d) => (
							<button
								key={d}
								type="button"
								onClick={() => setDepth(d)}
								style={{
									...btn(depth === d ? "primary" : "ghost"),
									padding: "2px 8px",
									fontSize: 12,
								}}
							>
								{d}
							</button>
						))}
					</div>
					<div style={{ marginTop: 14, fontSize: 12, opacity: 0.7 }}>
						Seed: <code>{seed.toString(36)}</code>
					</div>
				</div>
			</div>
		</div>
	);
}

function btn(variant: "primary" | "ghost"): React.CSSProperties {
	if (variant === "primary")
		return {
			padding: "6px 12px",
			background: "#6b4a2a",
			color: "#fff",
			border: "none",
			borderRadius: 3,
			cursor: "pointer",
			fontFamily: "inherit",
		};
	return {
		padding: "6px 12px",
		background: "#3a2a1f",
		color: "#fff",
		border: "1px solid #6b4a2a",
		borderRadius: 3,
		cursor: "pointer",
		fontFamily: "inherit",
	};
}
