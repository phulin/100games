import { useEffect, useMemo, useRef, useState } from "react";

// Tarot-like cards drawn into a 5-card spread. Player writes a short fortune.
// Past fortunes are fetched from the Cloudflare D1 backend keyed by the
// deterministic spread (including reversed orientation). No mocked archive.

const CARDS = [
	{ name: "The Tower", glyph: "T", themes: ["sudden change", "collapse", "revelation"] },
	{ name: "The Star", glyph: "S", themes: ["hope", "guidance", "clarity"] },
	{ name: "The Moon", glyph: "M", themes: ["illusion", "dream", "uncertainty"] },
	{ name: "The Sun", glyph: "Sn", themes: ["joy", "warmth", "success"] },
	{ name: "The Fool", glyph: "F", themes: ["beginnings", "risk", "innocence"] },
	{ name: "The Magician", glyph: "MG", themes: ["will", "skill", "creation"] },
	{ name: "The Hermit", glyph: "H", themes: ["solitude", "reflection", "wisdom"] },
	{ name: "The Lovers", glyph: "L", themes: ["choice", "union", "duality"] },
	{ name: "Death", glyph: "D", themes: ["ending", "transformation", "release"] },
	{ name: "Justice", glyph: "J", themes: ["balance", "truth", "consequence"] },
	{ name: "The World", glyph: "W", themes: ["completion", "wholeness", "travel"] },
	{ name: "Wheel", glyph: "Wh", themes: ["fortune", "cycles", "fate"] },
];

const POSITIONS = ["Past", "Present", "Hidden", "Advice", "Outcome"];

function mulberry32(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6d2b79f5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

type DrawnCard = { idx: number; reversed: boolean };

function pickSpread(seed: number): DrawnCard[] {
	const r = mulberry32(seed);
	const indices: number[] = [];
	while (indices.length < 5) {
		const i = Math.floor(r() * CARDS.length);
		if (!indices.includes(i)) indices.push(i);
	}
	return indices.map((i) => ({ idx: i, reversed: r() < 0.35 }));
}

function spreadKeyFor(spread: DrawnCard[]): string {
	return `s${spread
		.map((c) => `${CARDS[c.idx].glyph.replace(/[^a-zA-Z0-9]/g, "")}${c.reversed ? "r" : ""}`)
		.join("-")}`;
}

function getOrCreateAuthor(): string {
	const KEY = "cartomancer_author";
	try {
		const existing = localStorage.getItem(KEY);
		if (existing) return existing;
		const fresh = `anon_${Math.random().toString(36).slice(2, 10)}`;
		localStorage.setItem(KEY, fresh);
		return fresh;
	} catch {
		return `anon_${Math.random().toString(36).slice(2, 10)}`;
	}
}

let audioCtx: AudioContext | null = null;
function getAudio(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!audioCtx) {
		try {
			audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
		} catch {
			return null;
		}
	}
	return audioCtx;
}

function flipSound() {
	const ctx = getAudio();
	if (!ctx) return;
	const t = ctx.currentTime;
	const bufSize = Math.floor(ctx.sampleRate * 0.12);
	const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
	const data = buf.getChannelData(0);
	for (let i = 0; i < bufSize; i++) {
		data[i] = (Math.random() * 2 - 1) * Math.exp(-(i / bufSize) * 12);
	}
	const src = ctx.createBufferSource();
	src.buffer = buf;
	const filt = ctx.createBiquadFilter();
	filt.type = "bandpass";
	filt.frequency.value = 2000;
	const g = ctx.createGain();
	g.gain.value = 0.4;
	src.connect(filt).connect(g).connect(ctx.destination);
	src.start(t);
}

function chime(freq: number, vol = 0.18) {
	const ctx = getAudio();
	if (!ctx) return;
	const t = ctx.currentTime;
	const osc = ctx.createOscillator();
	const g = ctx.createGain();
	osc.frequency.value = freq;
	osc.type = "sine";
	g.gain.setValueAtTime(0.0001, t);
	g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
	g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
	osc.connect(g).connect(ctx.destination);
	osc.start(t);
	osc.stop(t + 1.1);
}

interface ArchiveEntry {
	id: number;
	text: string;
	mine: boolean;
	votes: number;
	createdAt: number;
}

interface ServerFortune {
	id: number;
	spread_key: string;
	text: string;
	author: string | null;
	votes: number;
	created_at: number;
}

export default function TheCartomancer() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [spread, setSpread] = useState<DrawnCard[]>(() => pickSpread(seed));
	const spreadKey = useMemo(() => spreadKeyFor(spread), [spread]);
	const [author] = useState<string>(() => getOrCreateAuthor());
	const [myFortuneId, setMyFortuneId] = useState<number | null>(null);
	const [fortune, setFortune] = useState("");
	const [archive, setArchive] = useState<ArchiveEntry[]>([]);
	const [stage, setStage] = useState<"write" | "vote" | "results">("write");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [voted, setVoted] = useState<Set<number>>(new Set());
	const [flipped, setFlipped] = useState<boolean[]>(() => spread.map(() => false));
	const [musesLeft, setMusesLeft] = useState(1);
	const [sortBy, setSortBy] = useState<"votes" | "recent">("votes");
	const flipTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);

	useEffect(() => {
		setFlipped(spread.map(() => false));
		flipTimeouts.current.forEach((t) => clearTimeout(t));
		flipTimeouts.current = [];
		spread.forEach((_, i) => {
			const id = setTimeout(() => {
				flipSound();
				chime(330 + i * 60);
				setFlipped((prev) => {
					const nx = [...prev];
					nx[i] = true;
					return nx;
				});
			}, 350 + i * 380);
			flipTimeouts.current.push(id);
		});
		return () => {
			flipTimeouts.current.forEach((t) => clearTimeout(t));
		};
	}, [spread]);

	const fetchFortunes = async (key: string, mineId: number | null) => {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/cartomancer/fortunes?spread=${encodeURIComponent(key)}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { fortunes: ServerFortune[] };
			const entries: ArchiveEntry[] = (data.fortunes ?? []).map((f) => ({
				id: f.id,
				text: f.text,
				votes: f.votes,
				mine: f.id === mineId || f.author === author,
				createdAt: f.created_at,
			}));
			setArchive(entries);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load");
			setArchive([]);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchFortunes(spreadKey, null);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [spreadKey]);

	const submit = async () => {
		const text = fortune.trim();
		if (!text) return;
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/cartomancer/fortunes", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ spread_key: spreadKey, text, author }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { fortune: ServerFortune };
			const mineId = data.fortune.id;
			setMyFortuneId(mineId);
			await fetchFortunes(spreadKey, mineId);
			chime(523);
			setStage("vote");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to submit");
		} finally {
			setLoading(false);
		}
	};

	const vote = async (entry: ArchiveEntry) => {
		if (entry.mine) return;
		if (voted.has(entry.id)) return;
		setVoted((prev) => {
			const next = new Set(prev);
			next.add(entry.id);
			return next;
		});
		setArchive((a) => a.map((e) => (e.id === entry.id ? { ...e, votes: e.votes + 1 } : e)));
		chime(659);
		try {
			const res = await fetch("/api/cartomancer/fortunes", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "vote", fortune_id: entry.id, author }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { fortune: ServerFortune; counted: boolean };
			setArchive((a) => a.map((e) => (e.id === entry.id ? { ...e, votes: data.fortune.votes } : e)));
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to vote");
		}
		setStage("results");
	};

	const newReading = () => {
		const ns = Math.floor(Math.random() * 1e9);
		setSeed(ns);
		setSpread(pickSpread(ns));
		setFortune("");
		setMyFortuneId(null);
		setArchive([]);
		setVoted(new Set());
		setStage("write");
		setMusesLeft(1);
	};

	const muse = (i: number) => {
		if (musesLeft <= 0 || stage !== "write") return;
		setMusesLeft((m) => m - 1);
		const r = mulberry32(Date.now() ^ i);
		const used = new Set(spread.map((c) => c.idx));
		let pick = Math.floor(r() * CARDS.length);
		let tries = 0;
		while (used.has(pick) && tries < 50) {
			pick = (pick + 1) % CARDS.length;
			tries++;
		}
		setSpread((sp) => sp.map((c, j) => (j === i ? { idx: pick, reversed: r() < 0.35 } : c)));
	};

	const sorted = useMemo(() => {
		const a = [...archive];
		if (sortBy === "votes") a.sort((x, y) => y.votes - x.votes);
		else a.sort((x, y) => y.createdAt - x.createdAt);
		return a;
	}, [archive, sortBy]);

	return (
		<div style={{ background: "linear-gradient(#1a1028, #2a1838)", color: "#e8d8ff", padding: 20, fontFamily: "Georgia, serif", minHeight: 540 }}>
			<h2 style={{ margin: "0 0 4px" }}>The Cartomancer</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
				A spread is drawn for you. Write a short fortune, then judge others' readings.
				{musesLeft > 0 && stage === "write" && " Tap a card to re-draw it (1 muse)."}
			</div>
			<div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16, perspective: 800 }}>
				{spread.map((c, i) => {
					const card = CARDS[c.idx];
					const isFlipped = flipped[i];
					return (
						<div
							key={i}
							onClick={() => muse(i)}
							style={{
								width: 110,
								height: 180,
								cursor: musesLeft > 0 && stage === "write" ? "pointer" : "default",
								transformStyle: "preserve-3d",
								transform: `rotateY(${isFlipped ? 180 : 0}deg)`,
								transition: "transform 0.6s",
								position: "relative",
							}}
						>
							<div
								style={{
									position: "absolute",
									inset: 0,
									backfaceVisibility: "hidden",
									background: "linear-gradient(160deg, #2a1538, #150825)",
									border: "2px solid #6228",
									borderRadius: 8,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontSize: 28,
									color: "#a6f",
									boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
								}}
							>
								✶
							</div>
							<div
								style={{
									position: "absolute",
									inset: 0,
									backfaceVisibility: "hidden",
									background: "linear-gradient(160deg, #3a2050, #2a1538)",
									border: "2px solid #d4a",
									borderRadius: 8,
									padding: 6,
									boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
									display: "flex",
									flexDirection: "column",
									justifyContent: "space-between",
									color: "#f6d6ff",
									transform: `rotateY(180deg) ${c.reversed ? "rotate(180deg)" : ""}`,
								}}
							>
								<div style={{ fontSize: 11, opacity: 0.8 }}>{POSITIONS[i]}</div>
								<div style={{ fontSize: 32, textAlign: "center" }}>{card.glyph}</div>
								<div style={{ fontSize: 11, textAlign: "center", fontStyle: "italic" }}>
									{card.name}
									{c.reversed && <div style={{ fontSize: 9, color: "#fc8" }}>reversed</div>}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{flipped.every((f) => f) && (
				<div style={{ textAlign: "center", fontSize: 12, opacity: 0.7, marginBottom: 10, fontStyle: "italic" }}>
					Themes:{" "}
					{spread
						.map((c) => {
							const t = CARDS[c.idx].themes[c.idx % CARDS[c.idx].themes.length];
							return c.reversed ? `inverted ${t}` : t;
						})
						.join(" · ")}
				</div>
			)}

			{error && (
				<div style={{ textAlign: "center", color: "#fc8", marginBottom: 8, fontSize: 12 }}>{error}</div>
			)}

			{stage === "write" && (
				<div style={{ textAlign: "center" }}>
					<textarea
						value={fortune}
						onChange={(e) => setFortune(e.target.value.slice(0, 400))}
						placeholder="Write a short fortune (one or two sentences)..."
						style={{ width: "70%", height: 60, padding: 8, background: "#2a1838", color: "#fff", border: "1px solid #553", borderRadius: 4 }}
					/>
					<div style={{ fontSize: 11, opacity: 0.6 }}>{fortune.length}/400</div>
					<div>
						<button type="button" onClick={submit} disabled={!fortune.trim() || loading} style={{ marginTop: 8 }}>
							{loading ? "Inscribing..." : "Inscribe fortune"}
						</button>
					</div>
					<div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
						{loading
							? "Consulting the archive..."
							: archive.length === 0
								? "No prior readings for this exact spread — yours will be the first."
								: `${archive.length} prior reading${archive.length === 1 ? "" : "s"} for this spread`}
					</div>
				</div>
			)}

			{stage === "vote" && (
				<div>
					<div style={{ textAlign: "center", marginBottom: 8 }}>
						Which of these readings fits this spread best?
					</div>
					{archive.length === 0 || (archive.length === 1 && archive[0].id === myFortuneId) ? (
						<div style={{ textAlign: "center", opacity: 0.7 }}>No other readings yet. Yours is the first.</div>
					) : null}
					{archive.map((e) => (
						<div
							key={e.id}
							onClick={() => vote(e)}
							style={{
								padding: 10,
								margin: "6px auto",
								maxWidth: 600,
								background: e.mine ? "#503058" : "#3a2540",
								border: e.mine ? "1px solid #fc6" : "1px solid transparent",
								borderRadius: 4,
								cursor: e.mine ? "default" : "pointer",
								fontStyle: "italic",
								opacity: e.mine ? 0.85 : 1,
							}}
						>
							"{e.text}"
							<span style={{ float: "right", opacity: 0.7, fontSize: 12 }}>{e.votes} votes</span>
							{e.mine && <span style={{ marginLeft: 8, color: "#fc6", fontStyle: "normal", fontSize: 12 }}>(yours)</span>}
						</div>
					))}
					<div style={{ textAlign: "center", marginTop: 12 }}>
						<button type="button" onClick={() => setStage("results")}>
							Skip voting
						</button>
					</div>
				</div>
			)}

			{stage === "results" && (
				<div>
					<div style={{ textAlign: "center", marginBottom: 8, display: "flex", justifyContent: "center", gap: 12 }}>
						<span>Results</span>
						<label style={{ fontSize: 12 }}>
							Sort:{" "}
							<select
								value={sortBy}
								onChange={(e) => setSortBy(e.target.value as "votes" | "recent")}
								style={{ background: "#2a1838", color: "#fff", border: "1px solid #553" }}
							>
								<option value="votes">Most votes</option>
								<option value="recent">Most recent</option>
							</select>
						</label>
					</div>
					{sorted.length === 0 && (
						<div style={{ textAlign: "center", opacity: 0.6 }}>No readings yet for this spread.</div>
					)}
					{sorted.map((e) => (
						<div
							key={e.id}
							style={{
								padding: 10,
								margin: "6px auto",
								maxWidth: 600,
								background: e.mine ? "#503058" : "#3a2540",
								border: e.mine ? "1px solid #fc6" : "1px solid transparent",
								borderRadius: 4,
								fontStyle: "italic",
							}}
						>
							"{e.text}" <span style={{ float: "right", opacity: 0.8 }}>{e.votes} votes</span>
							{e.mine && <span style={{ marginLeft: 8, color: "#fc6" }}>(yours)</span>}
						</div>
					))}
					<div style={{ textAlign: "center", marginTop: 12 }}>
						<button type="button" onClick={newReading}>
							New reading
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
