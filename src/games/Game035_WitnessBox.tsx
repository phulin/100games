import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Fragment = {
	id: number;
	text: string;
	trueOrder: number; // 1..N, 0 means lie
	witness: 0 | 1 | 2;
};

type CaseData = {
	id: number | null; // null = procedural (offline)
	name: string;
	truths: string[];
	lies: string[];
};

type RemoteCase = {
	id: number;
	name: string;
	truths: string;
	lies: string;
	solves?: number;
	attempts?: number;
	created_at?: number;
};

type CaseSummary = {
	id: number;
	name: string;
	solves?: number;
	attempts?: number;
};

const BEST_KEY = "game035_best_v2";

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

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
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
function blip(freq: number, dur = 0.07, type: OscillatorType = "sine", gain = 0.06) {
	const ctx = getCtx();
	if (!ctx) return;
	const o = ctx.createOscillator();
	const g = ctx.createGain();
	o.type = type;
	o.frequency.value = freq;
	g.gain.value = 0;
	g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.005);
	g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
	o.connect(g).connect(ctx.destination);
	o.start();
	o.stop(ctx.currentTime + dur + 0.02);
}
function gavel() {
	blip(220, 0.06, "square", 0.06);
	setTimeout(() => blip(130, 0.12, "square", 0.06), 70);
}

const SUBJECTS = ["A tall stranger", "A woman in red", "An elderly man", "A teenager", "A delivery worker", "A cyclist"];
const PLACES = ["the cafe", "the library", "the park", "the train platform", "the corner shop", "the apartment lobby"];
const ACTIONS = [
	"entered {place}",
	"spoke briefly to a clerk",
	"picked up a small parcel",
	"checked a wristwatch",
	"left through the side exit",
	"hailed a passing taxi",
	"sat down with a coffee",
	"made a phone call",
	"argued with another patron",
	"slipped a note into a pocket",
];
const LIES_BANK = [
	"was carrying a yellow umbrella",
	"paid with a hundred-dollar bill",
	"left a tip on the counter",
	"wore mismatched shoes",
	"sang while walking out",
	"dropped a glove on the floor",
];

function genProceduralCase(seed: number): CaseData {
	const rng = mulberry32(seed);
	const subj = SUBJECTS[Math.floor(rng() * SUBJECTS.length)];
	const place = PLACES[Math.floor(rng() * PLACES.length)];
	const numTruths = 4 + Math.floor(rng() * 2);
	const numLies = 2 + Math.floor(rng() * 2);
	const acts = [...ACTIONS];
	for (let i = acts.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[acts[i], acts[j]] = [acts[j], acts[i]];
	}
	const truths = acts.slice(0, numTruths).map((a) =>
		`${subj} ${a.replace("{place}", place)}.`,
	);
	const lieBag = [...LIES_BANK];
	for (let i = lieBag.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[lieBag[i], lieBag[j]] = [lieBag[j], lieBag[i]];
	}
	const lies = lieBag.slice(0, numLies).map((l) => `${subj} ${l}.`);
	return {
		id: null,
		name: `Case at ${place} (#${seed.toString(36).slice(-4)})`,
		truths,
		lies,
	};
}

function buildFragments(c: CaseData, seed: number): Fragment[] {
	const rng = mulberry32(seed);
	const out: Fragment[] = [];
	let id = 0;
	c.truths.forEach((t, i) => {
		out.push({ id: id++, text: t, trueOrder: i + 1, witness: Math.floor(rng() * 3) as 0 | 1 | 2 });
	});
	c.lies.forEach((l) => {
		out.push({ id: id++, text: l, trueOrder: 0, witness: Math.floor(rng() * 3) as 0 | 1 | 2 });
	});
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

export default function WitnessBox() {
	const [mode, setMode] = useState<"play" | "compose" | "browse">("play");
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [currentCase, setCurrentCase] = useState<CaseData | null>(null);
	const [loading, setLoading] = useState(false);
	const [loadErr, setLoadErr] = useState<string | null>(null);
	const [verdict, setVerdict] = useState<string | null>(null);
	const [timeline, setTimeline] = useState<number[]>([]);
	const [flagged, setFlagged] = useState<Set<number>>(new Set());
	const [timeLeft, setTimeLeft] = useState(180);
	const [score, setScore] = useState(0);
	const [best, setBest] = useState<number>(() => {
		const v = typeof localStorage !== "undefined" ? localStorage.getItem(BEST_KEY) : null;
		return v ? Number(v) : 0;
	});
	const timerRef = useRef<number | null>(null);

	const loadRandom = useCallback(async () => {
		setLoading(true);
		setLoadErr(null);
		setVerdict(null);
		setTimeline([]);
		setFlagged(new Set());
		setTimeLeft(180);
		try {
			const res = await fetch("/api/witness-box/cases?mode=random");
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { case: RemoteCase | null };
			if (data.case) {
				const c = data.case;
				const truths = JSON.parse(c.truths) as string[];
				const lies = JSON.parse(c.lies) as string[];
				setCurrentCase({ id: c.id, name: c.name, truths, lies });
				setSeed(Math.floor(Math.random() * 1e9));
				setLoading(false);
				return;
			}
			const ns = Math.floor(Math.random() * 1e9);
			setSeed(ns);
			setCurrentCase(genProceduralCase(ns));
		} catch (e) {
			setLoadErr(e instanceof Error ? e.message : "load failed");
			const ns = Math.floor(Math.random() * 1e9);
			setSeed(ns);
			setCurrentCase(genProceduralCase(ns));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadRandom();
	}, [loadRandom]);

	useEffect(() => {
		if (!currentCase || verdict) return;
		if (timerRef.current) clearInterval(timerRef.current);
		timerRef.current = window.setInterval(() => {
			setTimeLeft((t) => {
				if (t <= 1) {
					if (timerRef.current) clearInterval(timerRef.current);
					return 0;
				}
				return t - 1;
			});
		}, 1000);
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, [currentCase, verdict]);

	const fragments = useMemo(
		() => (currentCase ? buildFragments(currentCase, seed) : []),
		[currentCase, seed],
	);
	const fragMap = useMemo(() => new Map(fragments.map((f) => [f.id, f])), [fragments]);
	const inTimeline = new Set(timeline);

	const addToTimeline = (id: number) => {
		if (inTimeline.has(id) || verdict) return;
		setTimeline([...timeline, id]);
		blip(420, 0.04, "sine", 0.04);
	};
	const removeFromTimeline = (id: number) => {
		if (verdict) return;
		setTimeline(timeline.filter((x) => x !== id));
		blip(280, 0.04, "sine", 0.04);
	};
	const moveInTimeline = (id: number, dir: -1 | 1) => {
		if (verdict) return;
		const idx = timeline.indexOf(id);
		const nIdx = idx + dir;
		if (idx < 0 || nIdx < 0 || nIdx >= timeline.length) return;
		const t = [...timeline];
		[t[idx], t[nIdx]] = [t[nIdx], t[idx]];
		setTimeline(t);
		blip(500 + dir * 100, 0.03, "triangle", 0.04);
	};
	const toggleFlag = (id: number) => {
		if (verdict) return;
		const ns = new Set(flagged);
		if (ns.has(id)) ns.delete(id);
		else ns.add(id);
		setFlagged(ns);
		blip(620, 0.04, "square", 0.04);
	};

	const check = async () => {
		if (!currentCase) return;
		let correctOrder = true;
		let lastOrder = 0;
		for (const id of timeline) {
			const f = fragMap.get(id)!;
			if (f.trueOrder === 0) { correctOrder = false; break; }
			if (f.trueOrder <= lastOrder) { correctOrder = false; break; }
			lastOrder = f.trueOrder;
		}
		const trueCount = currentCase.truths.length;
		const allTrueIncluded =
			timeline.filter((id) => fragMap.get(id)!.trueOrder > 0).length === trueCount;
		const lieIds = fragments.filter((f) => f.trueOrder === 0).map((f) => f.id);
		const correctFlags =
			lieIds.every((id) => flagged.has(id)) && [...flagged].every((id) => lieIds.includes(id));

		const success = correctOrder && allTrueIncluded && correctFlags;
		if (success) {
			const points = 300 + timeLeft * 5 + currentCase.lies.length * 50;
			setScore(points);
			setVerdict(`CASE CLOSED. +${points}`);
			gavel();
			if (points > best) {
				setBest(points);
				try { localStorage.setItem(BEST_KEY, String(points)); } catch { /* ignore */ }
			}
		} else {
			const parts: string[] = [];
			if (!correctOrder) parts.push("timeline out of order or includes a lie");
			if (!allTrueIncluded) parts.push("missing true fragments");
			if (!correctFlags) parts.push("lies not correctly flagged");
			setVerdict("Not quite: " + parts.join("; "));
			blip(160, 0.2, "sawtooth", 0.06);
		}
		if (currentCase.id != null) {
			try {
				await fetch(
					`/api/witness-box/cases?action=${success ? "solve" : "attempt"}&id=${currentCase.id}`,
					{ method: "POST" },
				);
			} catch { /* ignore */ }
		}
	};

	const witnessColors = ["#ffb86b", "#8be9fd", "#ff79c6"];

	return (
		<div style={{ background: "#1c1620", color: "#eee", padding: 16, fontFamily: "Georgia, serif" }}>
			<h2 style={{ margin: "0 0 4px" }}>Witness Box</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Cases are written by other players (or procedurally generated when offline). Rebuild the timeline,
				flag the lies, beat the clock.
			</div>
			<div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
				<button type="button" onClick={() => setMode("play")} disabled={mode === "play"}>Play</button>
				<button type="button" onClick={() => setMode("compose")} disabled={mode === "compose"}>Compose</button>
				<button type="button" onClick={() => setMode("browse")} disabled={mode === "browse"}>Browse</button>
				{mode === "play" && (
					<>
						<button type="button" onClick={loadRandom} disabled={loading}>
							{loading ? "Loading..." : "New random case"}
						</button>
						<button type="button" onClick={check} disabled={!!verdict || !currentCase}>
							Submit
						</button>
						<div style={{ marginLeft: "auto", opacity: 0.9 }}>
							Time: {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
						</div>
						<div style={{ opacity: 0.7 }}>Score: {score} · Best: {best}</div>
					</>
				)}
			</div>
			{loadErr && (
				<div style={{ color: "#fc6", fontSize: 12, marginBottom: 6 }}>
					Couldn't reach server ({loadErr}) — using a procedurally generated case.
				</div>
			)}
			{mode === "play" && currentCase && (
				<>
					<div style={{ marginBottom: 8 }}>
						<b>{currentCase.name}</b>
						{currentCase.id == null && (
							<span style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>(procedural)</span>
						)}
					</div>
					{verdict && (
						<div
							style={{
								padding: 8,
								marginBottom: 8,
								background: verdict.startsWith("CASE CLOSED") ? "#1f3a1f" : "#3a261c",
								color: verdict.startsWith("CASE CLOSED") ? "#9f9" : "#fc6",
							}}
						>
							{verdict}
						</div>
					)}
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
						<div>
							<h4 style={{ margin: "0 0 4px" }}>Statements ({fragments.length})</h4>
							<div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>
								Click to add to timeline. Right-click to flag as a lie.
							</div>
							{fragments.map((f) => (
								<div
									key={f.id}
									onClick={() => addToTimeline(f.id)}
									onContextMenu={(e) => { e.preventDefault(); toggleFlag(f.id); }}
									style={{
										padding: 6,
										margin: "4px 0",
										background: inTimeline.has(f.id) ? "#2a2030" : "#2a2438",
										borderLeft: `4px solid ${witnessColors[f.witness]}`,
										opacity: inTimeline.has(f.id) ? 0.4 : 1,
										textDecoration: flagged.has(f.id) ? "line-through" : "none",
										color: flagged.has(f.id) ? "#f88" : "#eee",
										cursor: "pointer",
										fontSize: 13,
									}}
								>
									<span style={{ opacity: 0.6, fontSize: 11 }}>W{f.witness + 1}:</span> {f.text}
								</div>
							))}
						</div>
						<div>
							<h4 style={{ margin: "0 0 4px" }}>Timeline ({timeline.length})</h4>
							<div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>
								Click to remove. Use ↑/↓ buttons to reorder.
							</div>
							{timeline.length === 0 && <div style={{ opacity: 0.5 }}>Empty</div>}
							{timeline.map((id, i) => {
								const f = fragMap.get(id)!;
								return (
									<div
										key={id}
										style={{
											padding: 6,
											margin: "4px 0",
											background: "#1a2030",
											borderLeft: `4px solid ${witnessColors[f.witness]}`,
											fontSize: 13,
											display: "flex",
											gap: 6,
											alignItems: "center",
										}}
									>
										<span style={{ opacity: 0.6 }}>{i + 1}.</span>
										<span onClick={() => removeFromTimeline(id)} style={{ cursor: "pointer", flex: 1 }}>
											{f.text}
										</span>
										<button type="button" onClick={() => moveInTimeline(id, -1)} disabled={i === 0} style={miniBtn}>↑</button>
										<button type="button" onClick={() => moveInTimeline(id, 1)} disabled={i === timeline.length - 1} style={miniBtn}>↓</button>
									</div>
								);
							})}
						</div>
					</div>
				</>
			)}
			{mode === "compose" && <Composer onPublished={() => setMode("play")} />}
			{mode === "browse" && <Browser onPlay={() => { setMode("play"); loadRandom(); }} />}
		</div>
	);
}

const miniBtn: React.CSSProperties = {
	background: "#332838",
	color: "#eee",
	border: "1px solid #554060",
	fontSize: 12,
	padding: "0 6px",
	cursor: "pointer",
};

function Composer({ onPublished }: { onPublished: () => void }) {
	const [name, setName] = useState("");
	const [truthsText, setTruthsText] = useState("");
	const [liesText, setLiesText] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [ok, setOk] = useState(false);

	const submit = async () => {
		setError(null);
		setOk(false);
		const truths = truthsText.split("\n").map((s) => s.trim()).filter(Boolean);
		const lies = liesText.split("\n").map((s) => s.trim()).filter(Boolean);
		if (!name.trim()) { setError("Title required."); return; }
		if (truths.length < 3) { setError("At least 3 truths required (one per line, in order)."); return; }
		if (lies.length < 1) { setError("At least 1 lie required."); return; }
		setSubmitting(true);
		try {
			const res = await fetch("/api/witness-box/cases", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: name.trim(), truths, lies }),
			});
			if (!res.ok) {
				const data = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(data.error ?? `HTTP ${res.status}`);
			}
			setOk(true);
			setTimeout(onPublished, 800);
		} catch (e) {
			setError(e instanceof Error ? e.message : "submit failed");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div style={{ display: "grid", gap: 8, maxWidth: 720 }}>
			<div style={{ fontSize: 12, opacity: 0.7 }}>
				Write a case for other players. Truths are listed in the order events occurred. Lies are fake details
				witnesses might invent.
			</div>
			<input placeholder="Case title (e.g. The Stolen Cake)" value={name} onChange={(e) => setName(e.target.value)} style={textStyle} />
			<textarea
				placeholder={"Truths, one per line, in chronological order\nA man entered the bakery.\nHe took a cake.\nHe walked out without paying."}
				value={truthsText}
				onChange={(e) => setTruthsText(e.target.value)}
				rows={6}
				style={textStyle}
			/>
			<textarea
				placeholder={"Lies, one per line\nHe had a small dog with him.\nHe paid with a hundred-dollar bill."}
				value={liesText}
				onChange={(e) => setLiesText(e.target.value)}
				rows={4}
				style={textStyle}
			/>
			<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
				<button type="button" onClick={submit} disabled={submitting}>
					{submitting ? "Submitting..." : "Publish case"}
				</button>
				{error && <span style={{ color: "#f88", fontSize: 12 }}>{error}</span>}
				{ok && <span style={{ color: "#7f7", fontSize: 12 }}>Published!</span>}
			</div>
		</div>
	);
}

const textStyle: React.CSSProperties = {
	background: "#2a2030",
	color: "#eee",
	border: "1px solid #443354",
	padding: 6,
	fontFamily: "Georgia, serif",
};

function Browser({ onPlay }: { onPlay: (id: number) => void }) {
	const [cases, setCases] = useState<CaseSummary[] | null>(null);
	const [err, setErr] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				const res = await fetch("/api/witness-box/cases");
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = (await res.json()) as { cases: CaseSummary[] };
				setCases(data.cases);
			} catch (e) {
				setErr(e instanceof Error ? e.message : "load failed");
			}
		})();
	}, []);

	if (err) return <div style={{ color: "#f88" }}>{err}</div>;
	if (!cases) return <div style={{ opacity: 0.7 }}>Loading...</div>;
	if (cases.length === 0)
		return <div style={{ opacity: 0.7 }}>No cases published yet. Be the first!</div>;
	return (
		<div style={{ display: "grid", gap: 6, maxWidth: 720 }}>
			{cases.map((c) => (
				<div
					key={c.id}
					onClick={() => onPlay(c.id)}
					style={{
						padding: 8,
						background: "#2a2030",
						borderLeft: "4px solid #c8a8e0",
						cursor: "pointer",
						fontSize: 13,
					}}
				>
					<b>{c.name}</b>
					<span style={{ marginLeft: 12, opacity: 0.6, fontSize: 11 }}>
						{c.solves ?? 0}/{c.attempts ?? 0} solved
					</span>
				</div>
			))}
		</div>
	);
}
