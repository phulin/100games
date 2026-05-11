import { useEffect, useMemo, useRef, useState } from "react";

// Cross-stitch: pattern is a grid of cells with optional colors (up to 3 colors).
// Player places stitches by clicking; must form a continuous path within a color thread.

const N = 10;
type Cell = "" | "r" | "b" | "g";
type Pattern = Cell[][];

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function todayUTCSeed(): number {
	const d = new Date();
	return (
		d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
	);
}

function makePattern(seed: number): Pattern {
	const rng = mulberry32(seed);
	const r = (n: number) => Math.floor(rng() * n);
	const p: Pattern = Array.from({ length: N }, () => Array<Cell>(N).fill(""));
	const colors: Cell[] = ["r", "b", "g"];
	const blobs = 3 + r(3);
	for (let b = 0; b < blobs; b++) {
		const cx = 1 + r(Math.floor(N / 2));
		const cy = 1 + r(N - 2);
		const col = colors[r(colors.length)];
		const size = 3 + r(5);
		let x = cx,
			y = cy;
		for (let i = 0; i < size; i++) {
			if (x >= 0 && x < N && y >= 0 && y < N) p[y][x] = col;
			const mx = N - 1 - x;
			if (mx >= 0 && mx < N) p[y][mx] = col;
			const dir = r(4);
			if (dir === 0) x++;
			else if (dir === 1) x--;
			else if (dir === 2) y++;
			else y--;
		}
	}
	return p;
}

function adjacent(a: [number, number], b: [number, number]): boolean {
	const dr = Math.abs(a[0] - b[0]),
		dc = Math.abs(a[1] - b[1]);
	return dr + dc === 1 || (dr === 1 && dc === 1);
}

function playTone(
	ref: React.MutableRefObject<AudioContext | null>,
	freq: number,
	dur = 0.08,
	type: OscillatorType = "triangle",
) {
	try {
		if (!ref.current) ref.current = new AudioContext();
		const ctx = ref.current;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.value = freq;
		g.gain.value = 0.0001;
		g.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.005);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + dur + 0.02);
	} catch {
		/* ignore */
	}
}

const COLOR_FREQ: Record<string, number> = { r: 392, b: 523, g: 660 };
const COLOR_HEX: Record<string, string> = {
	r: "#e63946",
	b: "#2a6df4",
	g: "#2a9d8f",
};
const COLOR_NAME: Record<string, string> = { r: "Red", b: "Blue", g: "Green" };

type BoardState = {
	board: Pattern;
	lastPos: [number, number] | null;
	thread: Cell;
	threads: number;
	moves: number;
};

const emptyBoard = (): Pattern =>
	Array.from({ length: N }, () => Array<Cell>(N).fill(""));

export default function Game098_Stitchwork() {
	const [mode, setMode] = useState<"daily" | "free">("daily");
	const [freeSeed, setFreeSeed] = useState(() =>
		Math.floor(Math.random() * 1e9),
	);
	const seed = mode === "daily" ? todayUTCSeed() : freeSeed;

	const target = useMemo(() => makePattern(seed), [seed]);
	const colorsInTarget = useMemo<Cell[]>(
		() =>
			(["r", "b", "g"] as Cell[]).filter((c) =>
				target.some((row) => row.includes(c)),
			),
		[target],
	);

	const [history, setHistory] = useState<BoardState[]>(() => [
		{
			board: emptyBoard(),
			lastPos: null,
			thread: colorsInTarget[0] || "r",
			threads: 1,
			moves: 0,
		},
	]);
	const cur = history[history.length - 1];
	const [error, setError] = useState<string>("");
	const audio = useRef<AudioContext | null>(null);

	const totalNeeded = target.flat().filter(Boolean).length;
	const placedCount = cur.board.flat().filter(Boolean).length;
	const complete =
		placedCount === totalNeeded &&
		cur.board.every((row, r) => row.every((c, ci) => c === target[r][ci]));

	useEffect(() => {
		setHistory([
			{
				board: emptyBoard(),
				lastPos: null,
				thread: colorsInTarget[0] || "r",
				threads: 1,
				moves: 0,
			},
		]);
		setError("");
	}, [seed, colorsInTarget]);

	useEffect(() => {
		if (complete) {
			playTone(audio, 523, 0.18);
			setTimeout(() => playTone(audio, 659, 0.18), 110);
			setTimeout(() => playTone(audio, 784, 0.25), 220);
		}
	}, [complete]);

	function place(r: number, c: number) {
		if (cur.board[r][c]) {
			setError("already stitched there");
			return;
		}
		if (cur.lastPos && !adjacent([r, c], cur.lastPos)) {
			setError("not adjacent — start a new thread to skip");
			playTone(audio, 180, 0.1, "sawtooth");
			return;
		}
		if (target[r][c] !== cur.thread) {
			setError(
				`target wants ${target[r][c] ? COLOR_NAME[target[r][c] as string] : "empty"} here, not ${COLOR_NAME[cur.thread as string]}`,
			);
			playTone(audio, 180, 0.1, "sawtooth");
			return;
		}
		const nb = cur.board.map((row) => row.slice());
		nb[r][c] = cur.thread;
		setHistory((h) => [
			...h.slice(-200),
			{ ...cur, board: nb, lastPos: [r, c], moves: cur.moves + 1 },
		]);
		setError("");
		playTone(audio, COLOR_FREQ[cur.thread as string] ?? 440);
	}

	function newThread(t: Cell) {
		setHistory((h) => [
			...h.slice(-200),
			{
				...cur,
				thread: t,
				lastPos: null,
				threads: cur.threads + (cur.lastPos != null ? 1 : 0),
			},
		]);
		setError("");
	}

	function undo() {
		setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
		setError("");
	}

	function reset() {
		setHistory([
			{
				board: emptyBoard(),
				lastPos: null,
				thread: colorsInTarget[0] || "r",
				threads: 1,
				moves: 0,
			},
		]);
		setError("");
	}

	const optimalThreads = useMemo(() => {
		let count = 0;
		const seen = Array.from({ length: N }, () => Array<boolean>(N).fill(false));
		for (let r = 0; r < N; r++) {
			for (let c = 0; c < N; c++) {
				if (!target[r][c] || seen[r][c]) continue;
				count++;
				const color = target[r][c];
				const stack: [number, number][] = [[r, c]];
				while (stack.length) {
					const cell = stack.pop();
					if (!cell) continue;
					const [y, x] = cell;
					if (y < 0 || y >= N || x < 0 || x >= N) continue;
					if (seen[y][x] || target[y][x] !== color) continue;
					seen[y][x] = true;
					for (let dy = -1; dy <= 1; dy++)
						for (let dx = -1; dx <= 1; dx++)
							if (dy || dx) stack.push([y + dy, x + dx]);
				}
			}
		}
		return count;
	}, [target]);

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

			<div
				style={{
					marginBottom: 10,
					display: "flex",
					gap: 12,
					alignItems: "center",
				}}
			>
				<label>
					<input
						type="radio"
						checked={mode === "daily"}
						onChange={() => setMode("daily")}
					/>{" "}
					Daily
				</label>
				<label>
					<input
						type="radio"
						checked={mode === "free"}
						onChange={() => setMode("free")}
					/>{" "}
					Free
				</label>
				{mode === "free" && (
					<button onClick={() => setFreeSeed(Math.floor(Math.random() * 1e9))}>
						New seed
					</button>
				)}
				<span style={{ fontSize: 12, opacity: 0.7 }}>
					Seed: <code>{seed}</code>
				</span>
			</div>

			<div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
				<div>
					<div style={{ fontSize: 12, marginBottom: 4 }}>Target</div>
					<Grid grid={target} faded />
				</div>
				<div>
					<div style={{ fontSize: 12, marginBottom: 4 }}>Your work</div>
					<Grid grid={cur.board} onClick={place} lastPos={cur.lastPos} />
				</div>
				<div style={{ width: 220 }}>
					<div style={{ marginBottom: 8 }}>
						<strong>Thread:</strong>{" "}
						{colorsInTarget.map((c) => (
							<button
								key={c}
								onClick={() => newThread(c)}
								style={{
									background:
										cur.thread === c ? COLOR_HEX[c as string] : "#fff",
									color: cur.thread === c ? "#fff" : COLOR_HEX[c as string],
									border: `1px solid ${COLOR_HEX[c as string]}`,
									marginRight: 4,
									padding: "2px 8px",
								}}
							>
								{COLOR_NAME[c as string]}
							</button>
						))}
					</div>
					<div>
						Threads used: <strong>{cur.threads}</strong>{" "}
						<span style={{ opacity: 0.6 }}>(min {optimalThreads})</span>
					</div>
					<div>
						Progress: {placedCount}/{totalNeeded}
					</div>
					<div>Moves: {cur.moves}</div>
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
					<div style={{ marginTop: 6, display: "flex", gap: 6 }}>
						<button onClick={reset}>Reset</button>
						<button onClick={undo} disabled={history.length <= 1}>
							Undo
						</button>
					</div>
					{complete && (
						<div
							style={{
								marginTop: 12,
								padding: 10,
								background: "#dff5d8",
								borderRadius: 4,
							}}
						>
							<strong>Complete!</strong>
							<div style={{ fontSize: 12 }}>
								{cur.threads} threads
								{cur.threads === optimalThreads ? " — optimal!" : ""}
							</div>
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
						const color = c ? COLOR_HEX[c as string] : "transparent";
						return (
							<div
								key={ci}
								onClick={() => onClick?.(r, ci)}
								style={{
									width: 26,
									height: 26,
									border: "1px solid #d0bf99",
									background:
										faded && c ? `${color}33` : last ? "#fff4a1" : "#fff",
									cursor: onClick ? "pointer" : "default",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								{c && !faded && (
									<span style={{ color, fontSize: 20, lineHeight: 1 }}>✕</span>
								)}
								{c && faded && (
									<span
										style={{
											color,
											fontSize: 20,
											lineHeight: 1,
											opacity: 0.7,
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
