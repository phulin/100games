import { useEffect, useRef, useState } from "react";

// Magnetic Poetry — drag word tiles onto a fridge to form a short poem on today's theme.

const WORDS = [
	"moon", "river", "whisper", "stone", "you", "I", "we",
	"breathe", "fall", "rise", "burn", "sleep", "dance",
	"the", "a", "and", "is", "are", "in", "of", "to", "with",
	"soft", "cold", "wild", "quiet", "bright", "old", "small",
	"sky", "dream", "heart", "shadow", "light", "rain", "leaf",
	"forget", "remember", "hold", "let go", "again", "never",
	"between", "almost", "still", "alone", "together",
];

const THEMES = [
	"longing",
	"the small hours",
	"a season ending",
	"first frost",
	"a kindness remembered",
	"distance",
	"the empty room",
];

type Tile = { word: string; id: number; x: number; y: number };

const FRIDGE_W = 720;
const FRIDGE_H = 380;
const TILE_W = 60;
const TILE_H = 24;

function themeOfDay(): string {
	const days = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
	return THEMES[days % THEMES.length];
}

function loadPoems(): { theme: string; text: string; votes: number }[] {
	try {
		const v = localStorage.getItem("magnetic_poetry");
		return v ? JSON.parse(v) : [];
	} catch {
		return [];
	}
}

function savePoems(p: { theme: string; text: string; votes: number }[]) {
	localStorage.setItem("magnetic_poetry", JSON.stringify(p));
}

export default function Game050_MagneticPoetry() {
	const [tiles, setTiles] = useState<Tile[]>(() =>
		WORDS.map((w, i) => ({
			word: w,
			id: i,
			x: 10 + (i % 12) * 66,
			y: FRIDGE_H + 16 + Math.floor(i / 12) * 30,
		}))
	);
	const theme = useRef(themeOfDay()).current;
	const [poems, setPoems] = useState(() => loadPoems());
	const draggingId = useRef<number | null>(null);
	const dragOffset = useRef({ x: 0, y: 0 });
	const svgRef = useRef<SVGSVGElement>(null);

	const onTileMouseDown = (e: React.MouseEvent, t: Tile) => {
		e.preventDefault();
		const svg = svgRef.current!;
		const rect = svg.getBoundingClientRect();
		dragOffset.current = {
			x: e.clientX - rect.left - t.x,
			y: e.clientY - rect.top - t.y,
		};
		draggingId.current = t.id;
		// Bring to front
		setTiles((ts) => [...ts.filter((x) => x.id !== t.id), t]);
	};

	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (draggingId.current == null) return;
			const svg = svgRef.current!;
			const rect = svg.getBoundingClientRect();
			const x = e.clientX - rect.left - dragOffset.current.x;
			const y = e.clientY - rect.top - dragOffset.current.y;
			setTiles((ts) =>
				ts.map((t) => (t.id === draggingId.current ? { ...t, x, y } : t))
			);
		};
		const onUp = () => {
			draggingId.current = null;
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, []);

	const tilesOnFridge = tiles.filter((t) => t.y < FRIDGE_H);

	const buildPoem = () => {
		// Group tiles by row (within ~26px), sort by x within row
		const sorted = [...tilesOnFridge].sort((a, b) => a.y - b.y);
		const rows: Tile[][] = [];
		for (const t of sorted) {
			const r = rows.find((row) => Math.abs(row[0].y - t.y) < 22);
			if (r) r.push(t);
			else rows.push([t]);
		}
		return rows
			.map((row) =>
				row
					.sort((a, b) => a.x - b.x)
					.map((t) => t.word)
					.join(" ")
			)
			.join("\n");
	};

	const submit = () => {
		const text = buildPoem();
		if (!text.trim()) return;
		const updated = [...poems, { theme, text, votes: 0 }];
		setPoems(updated);
		savePoems(updated);
	};

	const vote = (idx: number, delta: number) => {
		const updated = poems.map((p, i) => (i === idx ? { ...p, votes: p.votes + delta } : p));
		setPoems(updated);
		savePoems(updated);
	};

	const themesPoems = poems
		.map((p, i) => ({ ...p, _i: i }))
		.filter((p) => p.theme === theme)
		.sort((a, b) => b.votes - a.votes);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#d6d8da",
				color: "#222",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				padding: 10,
				boxSizing: "border-box",
				fontFamily: "Georgia, serif",
				overflow: "auto",
			}}
		>
			<h2 style={{ margin: 4 }}>Magnetic Poetry</h2>
			<div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
				Drag tiles onto the fridge. Today's theme: <em>{theme}</em>
			</div>
			<svg
				ref={svgRef}
				width={FRIDGE_W}
				height={FRIDGE_H + 130}
				style={{ background: "transparent", userSelect: "none" }}
			>
				{/* fridge */}
				<rect x={0} y={0} width={FRIDGE_W} height={FRIDGE_H} fill="#fafaf6" stroke="#aaa" rx={6} />
				<rect x={10} y={10} width={FRIDGE_W - 20} height={FRIDGE_H - 20} fill="#f3f1ea" stroke="#ccc" />
				{/* tile shelf */}
				<rect x={0} y={FRIDGE_H + 10} width={FRIDGE_W} height={120} fill="#bcbcb8" rx={4} />
				{tiles.map((t) => (
					<g
						key={t.id}
						transform={`translate(${t.x},${t.y})`}
						onMouseDown={(e) => onTileMouseDown(e, t)}
						style={{ cursor: "grab" }}
					>
						<rect
							width={TILE_W}
							height={TILE_H}
							fill="#fffdf3"
							stroke="#333"
							strokeWidth={1}
							rx={2}
						/>
						<text x={TILE_W / 2} y={16} textAnchor="middle" fontSize={12} fontFamily="Georgia">
							{t.word}
						</text>
					</g>
				))}
			</svg>
			<div style={{ marginTop: 8 }}>
				<button type="button" onClick={submit} style={btn}>
					Submit poem
				</button>
			</div>
			<div style={{ marginTop: 14, width: "100%", maxWidth: FRIDGE_W }}>
				<strong>Community ({theme}):</strong>
				{themesPoems.length === 0 && (
					<div style={{ opacity: 0.6, fontSize: 13 }}>No poems yet. Be the first.</div>
				)}
				{themesPoems.map((p) => (
					<div
						key={p._i}
						style={{
							background: "#fffdf3",
							border: "1px solid #ccc",
							borderRadius: 6,
							padding: 8,
							margin: "6px 0",
							whiteSpace: "pre-wrap",
							fontFamily: "Georgia, serif",
						}}
					>
						<div style={{ fontStyle: "italic" }}>{p.text}</div>
						<div style={{ marginTop: 4, fontSize: 12 }}>
							votes: {p.votes}{" "}
							<button type="button" onClick={() => vote(p._i, 1)} style={smallBtn}>
								▲
							</button>
							<button type="button" onClick={() => vote(p._i, -1)} style={smallBtn}>
								▼
							</button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#444",
	color: "#fff",
	border: "none",
	padding: "8px 14px",
	borderRadius: 6,
	cursor: "pointer",
	fontFamily: "Georgia, serif",
};

const smallBtn: React.CSSProperties = {
	background: "#eee",
	border: "1px solid #aaa",
	padding: "2px 6px",
	margin: "0 4px",
	cursor: "pointer",
	borderRadius: 3,
};
