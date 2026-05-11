import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Refraction — grid puzzle. A white beam enters from the left, hits a prism
// that splits into R/G/B beams. Each must reach its matching target.
//
// First-time visitors get a SEEDED procedural starter puzzle — never a static
// demo. The community level browser pulls from D1; loading a community level
// replaces the local grid. Players can verify-solve and share.

type CellType =
	| "empty"
	| "prism"
	| "mirrorNE"
	| "mirrorNW"
	| "block";

type Cell = { type: CellType };

type Dir = 0 | 1 | 2 | 3;
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

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

// Generate a starter level deterministically from a seed: entry row + 3
// target rows on the right edge, distinct rows. No fixed demo.
function makeSeededLevel(seed: number): Level {
	const rng = mulberry32(seed);
	const rows = [0, 1, 2, 3, 4, 5, 6, 7];
	for (let i = rows.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[rows[i], rows[j]] = [rows[j], rows[i]];
	}
	const entryY = rows[0];
	const tgtRows = rows.slice(1, 4).sort((a, b) => a - b);
	const colors: ("R" | "G" | "B")[] = ["R", "G", "B"];
	for (let i = colors.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[colors[i], colors[j]] = [colors[j], colors[i]];
	}
	const targets: Target[] = tgtRows.map((y, i) => ({
		x: GRID_W - 1, y, color: colors[i],
	}));
	return {
		entry: { x: 0, y: entryY, dir: 0 },
		targets,
		wallSet: new Set<string>(),
	};
}

function emptyGrid(): Cell[][] {
	return Array.from({ length: GRID_H }, () =>
		Array.from({ length: GRID_W }, () => ({ type: "empty" }) as Cell),
	);
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
		const b = stack.pop();
		if (!b) break;
		let { x, y, dir, color } = b;
		while (x >= 0 && x < GRID_W && y >= 0 && y < GRID_H) {
			const key = `${x},${y},${dir},${color}`;
			if (seen.has(key)) break;
			seen.add(key);
			out.push({ x, y, dir, color });
			const cell = grid[y][x];
			if (cell.type === "block") break;
			if (cell.type === "prism" && color === "W") {
				const dR = ((dir + 3) % 4) as Dir;
				const dG = dir;
				const dB = ((dir + 1) % 4) as Dir;
				stack.push({ x: x + DX[dR], y: y + DY[dR], dir: dR, color: "R" });
				stack.push({ x: x + DX[dG], y: y + DY[dG], dir: dG, color: "G" });
				stack.push({ x: x + DX[dB], y: y + DY[dB], dir: dB, color: "B" });
				break;
			}
			if (cell.type === "mirrorNE") {
				const map: Record<Dir, Dir> = { 0: 3, 1: 2, 2: 1, 3: 0 } as Record<Dir, Dir>;
				dir = map[dir];
			} else if (cell.type === "mirrorNW") {
				const map: Record<Dir, Dir> = { 0: 1, 1: 0, 2: 3, 3: 2 } as Record<Dir, Dir>;
				dir = map[dir];
			}
			x += DX[dir];
			y += DY[dir];
		}
	}
	return out;
}

type CommunityLevelMeta = {
	id: number;
	title: string;
	author: string;
	solves: number;
	created_at: number;
};

type SharedGridPayload = {
	v: 1;
	w: number;
	h: number;
	cells: CellType[][];
};

function getAnonId(): string {
	try {
		const k = "refraction:anon";
		let id = localStorage.getItem(k);
		if (!id) {
			const arr = new Uint8Array(12);
			crypto.getRandomValues(arr);
			id = Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
			localStorage.setItem(k, id);
		}
		return id;
	} catch {
		return "anon";
	}
}

function gridToPayload(grid: Cell[][]): SharedGridPayload {
	return {
		v: 1, w: GRID_W, h: GRID_H,
		cells: grid.map((row) => row.map((c) => c.type)),
	};
}

function payloadToGrid(p: SharedGridPayload): Cell[][] | null {
	if (!p || p.v !== 1 || p.w !== GRID_W || p.h !== GRID_H) return null;
	if (!Array.isArray(p.cells) || p.cells.length !== GRID_H) return null;
	const ALLOWED: CellType[] = ["empty", "prism", "mirrorNE", "mirrorNW", "block"];
	const out: Cell[][] = [];
	for (let y = 0; y < GRID_H; y++) {
		const row = p.cells[y];
		if (!Array.isArray(row) || row.length !== GRID_W) return null;
		const cells: Cell[] = [];
		for (let x = 0; x < GRID_W; x++) {
			const t = row[x];
			if (!ALLOWED.includes(t as CellType)) return null;
			cells.push({ type: t as CellType });
		}
		out.push(cells);
	}
	return out;
}

const TOOLS: { label: string; type: CellType; icon: string }[] = [
	{ label: "Empty", type: "empty", icon: "·" },
	{ label: "Prism", type: "prism", icon: "△" },
	{ label: "Mirror /", type: "mirrorNE", icon: "/" },
	{ label: "Mirror \\", type: "mirrorNW", icon: "\\" },
	{ label: "Block", type: "block", icon: "■" },
];

function useAudio() {
	const ctxRef = useRef<AudioContext | null>(null);
	const ensure = () => {
		if (ctxRef.current) return ctxRef.current;
		const Ctor =
			(window as unknown as { AudioContext: typeof AudioContext }).AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		ctxRef.current = new Ctor();
		return ctxRef.current;
	};
	useEffect(() => () => { ctxRef.current?.close(); }, []);
	const tone = (freq: number, dur = 0.1, type: OscillatorType = "sine", vol = 0.1) => {
		const ctx = ensure();
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type; o.frequency.value = freq;
		o.connect(g); g.connect(ctx.destination);
		const t = ctx.currentTime;
		g.gain.setValueAtTime(0.0001, t);
		g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		o.start(t); o.stop(t + dur + 0.02);
	};
	return tone;
}

export default function Refraction() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const level = useMemo(() => makeSeededLevel(seed), [seed]);
	const [grid, setGrid] = useState<Cell[][]>(() => emptyGrid());
	const [history, setHistory] = useState<Cell[][][]>([]);
	const [tool, setTool] = useState<CellType>("prism");
	const beams = useMemo(() => traceBeams(level, grid), [grid, level]);
	const [startMs, setStartMs] = useState(() => Date.now());
	const [hintCount, setHintCount] = useState(0);
	const [currentCommunityId, setCurrentCommunityId] = useState<number | null>(null);
	const tone = useAudio();

	const [community, setCommunity] = useState<CommunityLevelMeta[]>([]);
	const [shareStatus, setShareStatus] = useState<string>("");
	const [loadingId, setLoadingId] = useState<number | null>(null);
	const anonId = useMemo(() => getAnonId(), []);

	useEffect(() => {
		let cancelled = false;
		fetch("/api/refraction/levels")
			.then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
			.then((data: { levels?: CommunityLevelMeta[] }) => {
				if (!cancelled && Array.isArray(data.levels)) setCommunity(data.levels);
			})
			.catch(() => {});
		return () => { cancelled = true; };
	}, []);

	const loadCommunityLevel = async (id: number) => {
		setLoadingId(id);
		try {
			const r = await fetch(`/api/refraction/levels?id=${id}`);
			if (!r.ok) throw new Error("fetch failed");
			const data = (await r.json()) as { level?: { grid?: string } };
			if (!data.level?.grid) throw new Error("no grid");
			const parsed = JSON.parse(data.level.grid) as SharedGridPayload;
			const ng = payloadToGrid(parsed);
			if (ng) {
				setGrid(ng);
				setHistory([]);
				setShareStatus("");
				setStartMs(Date.now());
				setHintCount(0);
				setCurrentCommunityId(id);
				tone(660, 0.15);
			}
		} catch {
			// silent
		} finally {
			setLoadingId(null);
		}
	};

	const setCell = (x: number, y: number) => {
		if (x === level.entry.x && y === level.entry.y) return;
		if (level.targets.some((t) => t.x === x && t.y === y)) return;
		setHistory((h) => [...h.slice(-30), grid.map((r) => r.map((c) => ({ ...c })))]);
		const ng = grid.map((row) => row.map((c) => ({ ...c })));
		ng[y][x] = { type: tool };
		setGrid(ng);
		tone(tool === "empty" ? 220 : 440 + (x + y) * 12, 0.06, "triangle", 0.07);
	};

	const undo = useCallback(() => {
		setHistory((h) => {
			if (h.length === 0) return h;
			const last = h[h.length - 1];
			setGrid(last);
			tone(300, 0.06, "sine", 0.08);
			return h.slice(0, -1);
		});
	}, [tone]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); }
			else if (e.key === "1") setTool("empty");
			else if (e.key === "2") setTool("prism");
			else if (e.key === "3") setTool("mirrorNE");
			else if (e.key === "4") setTool("mirrorNW");
			else if (e.key === "5") setTool("block");
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [undo]);

	const hits = level.targets.map((t) =>
		beams.some((b) => b.x === t.x && b.y === t.y && b.color === t.color),
	);
	const won = hits.every(Boolean);
	const [solveRecorded, setSolveRecorded] = useState(false);

	useEffect(() => {
		if (won && !solveRecorded) {
			setSolveRecorded(true);
			tone(523, 0.15); tone(659, 0.18); tone(784, 0.25);
			if (currentCommunityId !== null) {
				fetch("/api/refraction/solve", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ id: currentCommunityId }),
				}).then((r) => r.ok ? r.json() : null).then((d) => {
					if (d && typeof d.solves === "number") {
						setCommunity((c) => c.map((l) =>
							l.id === currentCommunityId ? { ...l, solves: d.solves } : l));
					}
				}).catch(() => {});
			}
		}
	}, [won, solveRecorded, currentCommunityId, tone]);

	const hint = () => {
		if (won) return;
		const missingIdx = hits.findIndex((h) => !h);
		if (missingIdx < 0) return;
		const t = level.targets[missingIdx];
		setShareStatus(`Hint: ${t.color} target is at row ${t.y + 1}.`);
		setHintCount((c) => c + 1);
		tone(330, 0.1, "triangle");
	};

	const shareLevel = async () => {
		if (!won) { setShareStatus("Solve it first to share."); return; }
		const title = typeof window !== "undefined"
			? window.prompt("Title for your level (1-60 chars):", "My Refraction")
			: null;
		if (!title) return;
		const trimmed = title.trim().slice(0, 60);
		if (!trimmed) { setShareStatus("Title required."); return; }
		setShareStatus("Sharing...");
		try {
			const r = await fetch("/api/refraction/levels", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					title: trimmed,
					grid: JSON.stringify(gridToPayload(grid)),
					author: anonId,
				}),
			});
			if (!r.ok) { setShareStatus(`Share failed (${r.status}).`); return; }
			const created = (await r.json()) as CommunityLevelMeta;
			setShareStatus("Shared!");
			setCommunity((c) => [created, ...c].slice(0, 20));
		} catch {
			setShareStatus("Share failed.");
		}
	};

	const newPuzzle = () => {
		setSeed(Math.floor(Math.random() * 1e9));
		setGrid(emptyGrid());
		setHistory([]);
		setShareStatus("");
		setStartMs(Date.now());
		setHintCount(0);
		setCurrentCommunityId(null);
		setSolveRecorded(false);
	};

	const reset = () => {
		setHistory((h) => [...h.slice(-30), grid.map((r) => r.map((c) => ({ ...c })))]);
		setGrid(emptyGrid());
		setSolveRecorded(false);
	};

	const cellSize = 44;
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	useEffect(() => {
		const ctx = canvasRef.current?.getContext("2d");
		if (!ctx) return;
		const W = GRID_W * cellSize;
		const H = GRID_H * cellSize;
		ctx.clearRect(0, 0, W, H);
		for (const b of beams) {
			const cx = b.x * cellSize + cellSize / 2;
			const cy = b.y * cellSize + cellSize / 2;
			const nx = cx + DX[b.dir] * cellSize * 0.55;
			const ny = cy + DY[b.dir] * cellSize * 0.55;
			ctx.strokeStyle =
				b.color === "R" ? "#ff5050" :
				b.color === "G" ? "#50ff80" :
				b.color === "B" ? "#5090ff" : "#ffffff";
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

	const elapsed = Math.floor((Date.now() - startMs) / 1000);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "radial-gradient(circle,#0a0a14,#000)",
				color: "#e8e8f0",
				fontFamily: "monospace",
				padding: 12,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				overflow: "auto",
			}}
		>
			<h2 style={{ margin: 0 }}>Refraction</h2>
			<div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>
				{currentCommunityId !== null
					? `Community level #${currentCommunityId}`
					: `Seeded starter ${seed}`}
				{" · "}
				1-5: tools · Ctrl+Z: undo
			</div>
			<div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", justifyContent: "center" }}>
				{TOOLS.map((t) => (
					<button
						type="button"
						key={t.type}
						onClick={() => setTool(t.type)}
						style={{
							padding: "4px 10px",
							background: tool === t.type ? "#5a8cff" : "#222",
							color: "#fff",
							border: "1px solid #555",
							borderRadius: 3,
							cursor: "pointer",
							fontFamily: "monospace",
							fontSize: 12,
						}}
					>
						{t.icon} {t.label}
					</button>
				))}
				<button type="button" onClick={undo} style={btnDark}>↶ Undo</button>
				<button type="button" onClick={reset} style={btnDark}>Clear</button>
				<button type="button" onClick={newPuzzle} style={btnDark}>New seed</button>
				<button type="button" onClick={hint} style={btnDark}>Hint ({hintCount})</button>
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
							const tgtIdx = tgt ? level.targets.indexOf(tgt) : -1;
							const tgtHit = tgt ? hits[tgtIdx] : false;
							const baseColor =
								tgt && tgt.color === "R" ? "rgba(255,80,80,0.25)" :
								tgt && tgt.color === "G" ? "rgba(80,255,128,0.25)" :
								tgt && tgt.color === "B" ? "rgba(80,144,255,0.25)" :
								isEntry ? "rgba(255,255,255,0.15)" : "transparent";
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
										fontSize: 22,
										cursor: "pointer",
										background: baseColor,
										boxShadow: tgt && tgtHit
											? `inset 0 0 18px ${tgt.color === "R" ? "#ff5050" : tgt.color === "G" ? "#50ff80" : "#5090ff"}`
											: "none",
										color:
											cell.type === "prism" ? "#ffd28c" :
											cell.type === "mirrorNE" || cell.type === "mirrorNW" ? "#8cccff" :
											cell.type === "block" ? "#aa88aa" : "#444",
									}}
								>
									{cell.type === "prism" ? "△" :
									 cell.type === "mirrorNE" ? "/" :
									 cell.type === "mirrorNW" ? "\\" :
									 cell.type === "block" ? "■" :
									 tgt ? (tgtHit ? "✓" : "◎") :
									 isEntry ? "→" : ""}
								</div>
							);
						}),
					)}
				</div>
				<canvas
					ref={canvasRef}
					width={GRID_W * cellSize}
					height={GRID_H * cellSize}
					style={{
						position: "absolute",
						left: 0, top: 0,
						pointerEvents: "none",
					}}
				/>
			</div>
			<div style={{ marginTop: 8, display: "flex", gap: 10 }}>
				{level.targets.map((t, i) => (
					<div
						key={t.color}
						style={{
							padding: "3px 8px",
							borderRadius: 3,
							border: `2px solid ${t.color === "R" ? "#ff5050" : t.color === "G" ? "#50ff80" : "#5090ff"}`,
							color: hits[i] ? "#9bcc70" : "#ccc",
							fontSize: 12,
						}}
					>
						{t.color}: {hits[i] ? "✓" : "—"}
					</div>
				))}
				<div style={{ fontSize: 12, opacity: 0.7, alignSelf: "center" }}>
					{won ? `Solved in ${elapsed}s, ${hintCount} hint(s)` : `${elapsed}s · ${history.length} moves`}
				</div>
			</div>
			<div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
				<button
					type="button"
					onClick={shareLevel}
					disabled={!won}
					style={{
						padding: "5px 12px",
						background: won ? "#3a7" : "#333",
						color: "#fff",
						border: "1px solid #555",
						borderRadius: 3,
						cursor: won ? "pointer" : "not-allowed",
						fontFamily: "monospace",
						opacity: won ? 1 : 0.6,
						fontSize: 12,
					}}
					title={won ? "Share this verified-solvable level" : "Solve first"}
				>
					Share level
				</button>
				<span style={{ fontSize: 11, opacity: 0.7 }}>{shareStatus}</span>
			</div>
			<div
				style={{
					marginTop: 10,
					width: GRID_W * cellSize,
					maxHeight: 140,
					overflowY: "auto",
					border: "1px solid #222",
					background: "#070712",
					padding: 6,
					boxSizing: "border-box",
				}}
			>
				<div style={{ fontSize: 11, opacity: 0.8, marginBottom: 4, letterSpacing: 1 }}>
					COMMUNITY LEVELS
				</div>
				{community.length === 0 ? (
					<div style={{ fontSize: 11, opacity: 0.5 }}>
						No levels yet — solve and share to seed the gallery.
					</div>
				) : (
					<ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 3 }}>
						{community.map((lvl) => (
							<li key={lvl.id}>
								<button
									type="button"
									onClick={() => loadCommunityLevel(lvl.id)}
									disabled={loadingId === lvl.id}
									style={{
										width: "100%",
										textAlign: "left",
										padding: "3px 6px",
										background: currentCommunityId === lvl.id ? "#1a2a44" : "#111122",
										color: "#cfd",
										border: "1px solid #2a2a40",
										borderRadius: 3,
										cursor: "pointer",
										fontFamily: "monospace",
										fontSize: 11,
									}}
								>
									#{lvl.id} {lvl.title}
									<span style={{ opacity: 0.5 }}>
										{" "}— by {lvl.author.slice(0, 6)} · {lvl.solves} solves
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

const btnDark: React.CSSProperties = {
	padding: "4px 10px",
	background: "#333",
	color: "#fff",
	border: "1px solid #555",
	borderRadius: 3,
	cursor: "pointer",
	fontSize: 12,
};
