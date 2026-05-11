import { useEffect, useRef, useState } from "react";

// Magnetic Poetry — drag word tiles onto a fridge to form a short poem on today's theme.
// Poems & upvotes are shared across players via the /api/magnetic-poetry/poems endpoint
// (Cloudflare D1). Falls back to localStorage if the network is unavailable.

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

type Poem = {
	id: number;
	theme: string;
	text: string;
	author?: string;
	votes: number;
	day?: string;
	created_at?: number;
};

const FRIDGE_W = 720;
const FRIDGE_H = 380;
const TILE_W = 60;
const TILE_H = 24;

const API = "/api/magnetic-poetry/poems";
const LS_FALLBACK = "magnetic_poetry_v2";
const LS_AUTHOR = "magnetic_poetry_author";
const LS_VOTED = "magnetic_poetry_voted";

function utcDay(): string {
	return new Date().toISOString().slice(0, 10);
}

function themeOfDay(day: string): string {
	// Stable hash of YYYY-MM-DD to an index in THEMES
	let h = 0;
	for (let i = 0; i < day.length; i++) {
		h = (h * 31 + day.charCodeAt(i)) >>> 0;
	}
	return THEMES[h % THEMES.length];
}

function getAuthorId(): string {
	try {
		let id = localStorage.getItem(LS_AUTHOR);
		if (!id) {
			id = `anon-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
			localStorage.setItem(LS_AUTHOR, id);
		}
		return id;
	} catch {
		return "anon";
	}
}

function loadLocal(day: string): Poem[] {
	try {
		const raw = localStorage.getItem(LS_FALLBACK);
		if (!raw) return [];
		const all = JSON.parse(raw) as Record<string, Poem[]>;
		return all[day] ?? [];
	} catch {
		return [];
	}
}

function saveLocal(day: string, poems: Poem[]) {
	try {
		const raw = localStorage.getItem(LS_FALLBACK);
		const all = raw ? (JSON.parse(raw) as Record<string, Poem[]>) : {};
		all[day] = poems;
		localStorage.setItem(LS_FALLBACK, JSON.stringify(all));
	} catch {
		// ignore
	}
}

function loadVotedSet(): Set<number> {
	try {
		const raw = localStorage.getItem(LS_VOTED);
		if (!raw) return new Set();
		return new Set(JSON.parse(raw) as number[]);
	} catch {
		return new Set();
	}
}

function saveVotedSet(s: Set<number>) {
	try {
		localStorage.setItem(LS_VOTED, JSON.stringify([...s]));
	} catch {
		// ignore
	}
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
	const day = useRef(utcDay()).current;
	const theme = useRef(themeOfDay(day)).current;
	const author = useRef(getAuthorId()).current;
	const [poems, setPoems] = useState<Poem[]>([]);
	const [voted, setVoted] = useState<Set<number>>(() => loadVotedSet());
	const [status, setStatus] = useState<string>("");
	const draggingId = useRef<number | null>(null);
	const dragOffset = useRef({ x: 0, y: 0 });
	const svgRef = useRef<SVGSVGElement>(null);

	// Fetch today's poems from the API, fall back to localStorage on failure.
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`${API}?day=${encodeURIComponent(day)}`);
				if (!res.ok) throw new Error(`bad status ${res.status}`);
				const data = (await res.json()) as { poems: Poem[] };
				if (cancelled) return;
				setPoems(data.poems ?? []);
				saveLocal(day, data.poems ?? []);
			} catch {
				if (cancelled) return;
				setPoems(loadLocal(day));
				setStatus("offline — using local copy");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [day]);

	const onTileMouseDown = (e: React.MouseEvent, t: Tile) => {
		e.preventDefault();
		const svg = svgRef.current;
		if (!svg) return;
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
			const svg = svgRef.current;
			if (!svg) return;
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
		// Group tiles by row (within ~22px), sort by x within row
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

	const submit = async () => {
		const text = buildPoem();
		if (!text.trim()) return;
		setStatus("submitting…");
		try {
			const res = await fetch(API, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ theme, text, author, day }),
			});
			if (!res.ok) throw new Error(`bad status ${res.status}`);
			const created = (await res.json()) as Poem;
			const next = [created, ...poems];
			setPoems(next);
			saveLocal(day, next);
			setStatus("posted");
		} catch {
			// Local fallback: synthesize an id so React keys/votes still work
			const fallback: Poem = {
				id: -Date.now(),
				theme,
				text,
				author,
				votes: 0,
				day,
				created_at: Date.now(),
			};
			const next = [fallback, ...poems];
			setPoems(next);
			saveLocal(day, next);
			setStatus("offline — saved locally");
		}
	};

	const upvote = async (poem: Poem) => {
		if (voted.has(poem.id)) return;
		// Optimistic update
		const next = poems.map((p) =>
			p.id === poem.id ? { ...p, votes: p.votes + 1 } : p,
		);
		setPoems(next);
		const newVoted = new Set(voted);
		newVoted.add(poem.id);
		setVoted(newVoted);
		saveVotedSet(newVoted);
		saveLocal(day, next);

		if (poem.id < 0) return; // local-only poem, no server vote
		try {
			const res = await fetch(API, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "vote", poem_id: poem.id, author }),
			});
			if (!res.ok) throw new Error(`bad status ${res.status}`);
			const data = (await res.json()) as { id: number; votes: number };
			// Reconcile with server count
			const synced = next.map((p) =>
				p.id === data.id ? { ...p, votes: data.votes } : p,
			);
			setPoems(synced);
			saveLocal(day, synced);
		} catch {
			setStatus("offline — vote saved locally");
		}
	};

	const sorted = [...poems].sort((a, b) => b.votes - a.votes);

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
				{status && (
					<span style={{ marginLeft: 8, opacity: 0.6 }}>· {status}</span>
				)}
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
				{sorted.length === 0 && (
					<div style={{ opacity: 0.6, fontSize: 13 }}>No poems yet. Be the first.</div>
				)}
				{sorted.map((p) => {
					const hasVoted = voted.has(p.id);
					return (
						<div
							key={p.id}
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
								<button
									type="button"
									onClick={() => upvote(p)}
									disabled={hasVoted}
									style={{
										...smallBtn,
										opacity: hasVoted ? 0.4 : 1,
										cursor: hasVoted ? "default" : "pointer",
									}}
								>
									{hasVoted ? "✓" : "▲"}
								</button>
							</div>
						</div>
					);
				})}
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
