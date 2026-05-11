import { useEffect, useMemo, useState } from "react";

// Tarot-like cards drawn into a 5-card spread. Player writes a short fortune.
// Past fortunes are fetched from the Cloudflare D1 backend keyed by the
// deterministic spread.

const CARDS = [
	{ name: "The Tower", glyph: "T", themes: ["sudden change", "collapse", "revelation"] },
	{ name: "The Star", glyph: "S", themes: ["hope", "guidance", "clarity"] },
	{ name: "The Moon", glyph: "M", themes: ["illusion", "dream", "uncertainty"] },
	{ name: "The Sun", glyph: "S+", themes: ["joy", "warmth", "success"] },
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

function pickSpread(seed: number) {
	let s = seed;
	const r = () => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
	const indices: number[] = [];
	while (indices.length < 5) {
		const i = Math.floor(r() * CARDS.length);
		if (!indices.includes(i)) indices.push(i);
	}
	return indices.map((i) => CARDS[i]);
}

function spreadKeyFor(seed: number): string {
	const cards = pickSpread(seed);
	return `s${cards.map((c) => c.glyph.replace(/[^a-zA-Z0-9]/g, "")).join("-")}`;
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

interface ArchiveEntry {
	id: number;
	text: string;
	mine: boolean;
	votes: number;
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
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 9999));
	const spread = useMemo(() => pickSpread(seed), [seed]);
	const spreadKey = useMemo(() => spreadKeyFor(seed), [seed]);
	const [author] = useState<string>(() => getOrCreateAuthor());
	const [, setMyFortuneId] = useState<number | null>(null);
	const [fortune, setFortune] = useState("");
	const [archive, setArchive] = useState<ArchiveEntry[]>([]);
	const [stage, setStage] = useState<"write" | "vote" | "results">("write");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [voted, setVoted] = useState<Set<number>>(new Set());

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
			}));
			setArchive(entries);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load");
			setArchive([]);
		} finally {
			setLoading(false);
		}
	};

	// On mount / when seed changes, peek at archive for that spread (silent preload).
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
		// Optimistic update
		setArchive((a) => a.map((e) => (e.id === entry.id ? { ...e, votes: e.votes + 1 } : e)));
		try {
			const res = await fetch("/api/cartomancer/fortunes", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "vote", fortune_id: entry.id, author }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { fortune: ServerFortune; counted: boolean };
			// Reconcile with server-authoritative vote count.
			setArchive((a) => a.map((e) => (e.id === entry.id ? { ...e, votes: data.fortune.votes } : e)));
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to vote");
		}
		setStage("results");
	};

	const newReading = () => {
		setSeed(Math.floor(Math.random() * 9999));
		setFortune("");
		setMyFortuneId(null);
		setArchive([]);
		setVoted(new Set());
		setStage("write");
	};

	return (
		<div style={{ background: "linear-gradient(#1a1028, #2a1838)", color: "#e8d8ff", padding: 20, fontFamily: "Georgia, serif", minHeight: 540 }}>
			<h2 style={{ margin: "0 0 4px" }}>The Cartomancer</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
				A spread is drawn for you. Write a short fortune, then judge others' readings.
			</div>
			<div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 16 }}>
				{spread.map((c, i) => (
					<div
						key={i}
						style={{
							width: 110,
							height: 160,
							background: "linear-gradient(160deg, #3a2050, #2a1538)",
							border: "2px solid #d4a",
							borderRadius: 8,
							padding: 6,
							boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
							display: "flex",
							flexDirection: "column",
							justifyContent: "space-between",
							color: "#f6d6ff",
						}}
					>
						<div style={{ fontSize: 11, opacity: 0.8 }}>{POSITIONS[i]}</div>
						<div style={{ fontSize: 32, textAlign: "center" }}>{c.glyph}</div>
						<div style={{ fontSize: 12, textAlign: "center", fontStyle: "italic" }}>{c.name}</div>
					</div>
				))}
			</div>

			{error && (
				<div style={{ textAlign: "center", color: "#fc8", marginBottom: 8, fontSize: 12 }}>
					{error}
				</div>
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
						{loading ? "Consulting the archive..." : `${archive.length} prior reading${archive.length === 1 ? "" : "s"} for this spread`}
					</div>
				</div>
			)}

			{stage === "vote" && (
				<div>
					<div style={{ textAlign: "center", marginBottom: 8 }}>
						Now, which of these readings fits this spread best?
					</div>
					{archive.length === 0 && (
						<div style={{ textAlign: "center", opacity: 0.7 }}>No readings yet. Yours is the first.</div>
					)}
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
					<div style={{ textAlign: "center", marginBottom: 8 }}>Results:</div>
					{archive
						.slice()
						.sort((a, b) => b.votes - a.votes)
						.map((e) => (
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
