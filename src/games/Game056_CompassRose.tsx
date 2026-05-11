import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Game 56: Compass Rose
// Daily blindfolded-walk puzzle. Same UTC-day puzzle for all players; D1 leaderboard.

const GRID = 7;
const DAILY_STEPS = 8;
const AUTHOR_KEY = "compass-rose:author";
const HANDLE_KEY = "compass-rose:handle";
const STREAK_KEY = "compass-rose:streak";
const LAST_KEY = "compass-rose:lastday";

type Dir = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
type Round = {
	start: { x: number; y: number };
	steps: Dir[];
	end: { x: number; y: number };
};
type ScoreRow = { handle: string; solve_ms: number; created_at: number };

function utcDayString(d = new Date()): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function seedForDay(day: string): string {
	const input = `compass-rose:${day}`;
	let h = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		h ^= input.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
	}
	return String(h >>> 0);
}

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

function difficultyFor(day: string): { steps: number; diagonals: boolean } {
	const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
	return {
		steps: DAILY_STEPS + Math.floor(dow / 2),
		diagonals: dow >= 4,
	};
}

function generateDaily(seedStr: string, day: string): Round {
	const seedNum = Number.parseInt(seedStr, 10) >>> 0;
	const rng = mulberry32(seedNum || 1);
	const { steps: stepCount, diagonals } = difficultyFor(day);
	const sx = Math.floor(rng() * GRID);
	const sy = Math.floor(rng() * GRID);
	let x = sx;
	let y = sy;
	const steps: Dir[] = [];
	for (let i = 0; i < stepCount; i++) {
		const opts: Dir[] = [];
		if (y > 0) opts.push("N");
		if (y < GRID - 1) opts.push("S");
		if (x > 0) opts.push("W");
		if (x < GRID - 1) opts.push("E");
		if (diagonals) {
			if (y > 0 && x < GRID - 1) opts.push("NE");
			if (y < GRID - 1 && x < GRID - 1) opts.push("SE");
			if (y < GRID - 1 && x > 0) opts.push("SW");
			if (y > 0 && x > 0) opts.push("NW");
		}
		const dir = opts[Math.floor(rng() * opts.length)];
		steps.push(dir);
		if (dir.includes("N")) y--;
		if (dir.includes("S")) y++;
		if (dir.includes("E")) x++;
		if (dir.includes("W")) x--;
	}
	return { start: { x: sx, y: sy }, steps, end: { x, y } };
}

function getAuthorId(): string {
	try {
		let id = localStorage.getItem(AUTHOR_KEY);
		if (!id) {
			id = `a_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
			localStorage.setItem(AUTHOR_KEY, id);
		}
		return id;
	} catch {
		return `a_${Math.random().toString(36).slice(2, 10)}`;
	}
}

function useAudio() {
	const ctxRef = useRef<AudioContext | null>(null);
	const ensure = useCallback(() => {
		if (!ctxRef.current) {
			try {
				const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
					?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
				if (Ctor) ctxRef.current = new Ctor();
			} catch {}
		}
		return ctxRef.current;
	}, []);
	const tone = useCallback((freq: number, dur: number, type: OscillatorType = "sine", gain = 0.07) => {
		const ctx = ensure();
		if (!ctx) return;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.value = freq;
		g.gain.setValueAtTime(0.0001, ctx.currentTime);
		g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + 0.005);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + dur + 0.02);
	}, [ensure]);
	const chord = useCallback((freqs: number[], dur: number) => {
		freqs.forEach((f) => tone(f, dur, "triangle", 0.05));
	}, [tone]);
	return { tone, chord };
}

const ARROWS: Record<Dir, string> = {
	N: "↑", S: "↓", E: "→", W: "←", NE: "↗", SE: "↘", SW: "↙", NW: "↖",
};

export default function CompassRose() {
	const day = useMemo(() => utcDayString(), []);
	const seed = useMemo(() => seedForDay(day), [day]);
	const round = useMemo(() => generateDaily(seed, day), [seed, day]);
	const { tone, chord } = useAudio();

	const [handle, setHandle] = useState<string>(() => {
		try {
			return localStorage.getItem(HANDLE_KEY) ?? "";
		} catch {
			return "";
		}
	});
	const [showing, setShowing] = useState(true);
	const [stepIdx, setStepIdx] = useState(0);
	const [picked, setPicked] = useState<{ x: number; y: number } | null>(null);
	const [msg, setMsg] = useState("");
	const [solveMs, setSolveMs] = useState<number | null>(null);
	const [scores, setScores] = useState<ScoreRow[]>([]);
	const [posted, setPosted] = useState(false);
	const [replayCount, setReplayCount] = useState(0);
	const revealEndedAt = useRef<number | null>(null);
	const revealIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [streak, setStreak] = useState<number>(() => {
		try {
			return Number.parseInt(localStorage.getItem(STREAK_KEY) ?? "0", 10) || 0;
		} catch {
			return 0;
		}
	});

	const runReveal = useCallback(() => {
		if (revealIntervalRef.current) clearInterval(revealIntervalRef.current);
		if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
		setShowing(true);
		setStepIdx(0);
		setMsg("");
		revealEndedAt.current = null;
		const total = round.steps.length;
		let i = 0;
		const id = setInterval(() => {
			i++;
			setStepIdx(i);
			tone(440 + i * 30, 0.09, "square", 0.04);
			if (i >= total) {
				clearInterval(id);
				revealIntervalRef.current = null;
				revealTimeoutRef.current = setTimeout(() => {
					setShowing(false);
					revealEndedAt.current = performance.now();
					revealTimeoutRef.current = null;
				}, 700);
			}
		}, 700);
		revealIntervalRef.current = id;
		return id;
	}, [round, tone]);

	useEffect(() => {
		setPicked(null);
		setSolveMs(null);
		setPosted(false);
		setReplayCount(0);
		runReveal();
		return () => {
			if (revealIntervalRef.current) clearInterval(revealIntervalRef.current);
			if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [round]);

	useEffect(() => {
		let cancelled = false;
		fetch(`/api/compass-rose/scores?day=${encodeURIComponent(day)}`)
			.then((r) => r.json())
			.then((data) => {
				if (!cancelled && Array.isArray(data?.scores)) setScores(data.scores);
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [day]);

	async function postScore(correct: 0 | 1, solve_ms: number) {
		if (posted) return;
		setPosted(true);
		const author = getAuthorId();
		const h = (handle || "anon").trim().slice(0, 20) || "anon";
		try {
			localStorage.setItem(HANDLE_KEY, h);
		} catch {}
		try {
			const res = await fetch("/api/compass-rose/scores", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ seed, solve_ms, correct, author, handle: h }),
			});
			const data = await res.json();
			if (Array.isArray(data?.scores)) setScores(data.scores);
		} catch {}
	}

	function bumpStreak(correct: boolean) {
		try {
			const lastDay = localStorage.getItem(LAST_KEY);
			if (lastDay === day) return;
			const next = correct ? streak + 1 : 0;
			localStorage.setItem(STREAK_KEY, String(next));
			localStorage.setItem(LAST_KEY, day);
			setStreak(next);
		} catch {}
	}

	function pick(x: number, y: number) {
		if (showing || picked) return;
		setPicked({ x, y });
		const startedAt = revealEndedAt.current ?? performance.now();
		const elapsed = Math.max(0, Math.round(performance.now() - startedAt));
		setSolveMs(elapsed);
		const correct = x === round.end.x && y === round.end.y;
		if (correct) {
			chord([523.25, 659.25, 783.99], 0.4);
			setMsg(`Solved in ${(elapsed / 1000).toFixed(2)}s!${replayCount > 0 ? ` (after ${replayCount} replay${replayCount > 1 ? "s" : ""})` : ""}`);
			postScore(1, elapsed);
			bumpStreak(true);
		} else {
			tone(180, 0.35, "sawtooth", 0.07);
			setMsg(`Wrong! Target was (${round.end.x},${round.end.y}).`);
			postScore(0, elapsed);
			bumpStreak(false);
		}
	}

	function replayReveal() {
		if (picked || showing) return;
		setReplayCount((n) => n + 1);
		runReveal();
	}

	const size = 60;
	const W = GRID * size;
	const H = GRID * size;

	return (
		<div style={{ background: "#1b2230", color: "#eaeefa", padding: 16, fontFamily: "'Lucida Console', monospace" }}>
			<h2 style={{ margin: 0 }}>Compass Rose — Daily</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Watch the start tile, then track the arrow directions in your head. Click where you ended up. One puzzle per UTC day.
			</div>
			<div style={{ display: "flex", gap: 18, marginTop: 6, fontSize: 13, flexWrap: "wrap" }}>
				<div>Day: {day}</div>
				<div>Seed: {seed}</div>
				<div>Steps: {round.steps.length}</div>
				<div>Streak: {streak}🔥</div>
				{solveMs !== null && <div>Time: {(solveMs / 1000).toFixed(2)}s</div>}
				<div style={{ color: "#ffd07a" }}>{msg}</div>
			</div>
			<div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap" }}>
				<svg width={W} height={H} style={{ background: "#0d121b", borderRadius: 6 }} role="img" aria-label="Compass Rose board">
					{Array.from({ length: GRID }).map((_, y) =>
						Array.from({ length: GRID }).map((__, x) => {
							const isStart = showing && x === round.start.x && y === round.start.y;
							const isPicked = picked && picked.x === x && picked.y === y;
							const isEnd = picked && x === round.end.x && y === round.end.y;
							let fill = "#1b2939";
							if (isStart) fill = "#ffd07a";
							if (isPicked) fill = isEnd ? "#7be0a0" : "#ff5e7e";
							else if (isEnd && picked) fill = "#7be0a0";
							return (
								<rect
									key={`${x}-${y}`}
									x={x * size + 2}
									y={y * size + 2}
									width={size - 4}
									height={size - 4}
									fill={fill}
									stroke="#2a3a55"
									onClick={() => pick(x, y)}
									style={{ cursor: showing || picked ? "default" : "pointer" }}
								/>
							);
						}),
					)}
				</svg>
				<div style={{ minWidth: 200 }}>
					<div style={{ marginBottom: 8, fontSize: 14, opacity: 0.8 }}>
						{showing ? `Step ${stepIdx}/${round.steps.length}` : picked ? "Result" : "Click your destination"}
					</div>
					<div style={{ fontSize: 56, textAlign: "center", height: 90 }}>
						{showing && stepIdx > 0 ? ARROWS[round.steps[stepIdx - 1]] : ""}
					</div>
					<div style={{ opacity: 0.6, fontSize: 12 }}>Memorize, don't follow on the board!</div>
					{!showing && !picked && (
						<button
							type="button"
							onClick={replayReveal}
							style={{ marginTop: 10, background: "#2a3a55", color: "#eaeefa", border: 0, padding: "4px 10px", borderRadius: 4, cursor: "pointer" }}
						>
							Replay reveal (counts as cheat 👀)
						</button>
					)}
					<div style={{ marginTop: 14 }}>
						<label style={{ fontSize: 12, opacity: 0.75 }}>
							Handle (optional, &lt;=20 chars):
							<input
								type="text"
								value={handle}
								maxLength={20}
								onChange={(e) => setHandle(e.target.value)}
								placeholder="anon"
								disabled={posted}
								style={{
									display: "block",
									marginTop: 4,
									width: "100%",
									background: "#0d121b",
									color: "#eaeefa",
									border: "1px solid #2a3a55",
									padding: "4px 6px",
									fontFamily: "inherit",
								}}
							/>
						</label>
					</div>
				</div>
				<div style={{ minWidth: 220 }}>
					<div style={{ fontSize: 14, marginBottom: 6, color: "#ffd07a" }}>Today's Leaderboard</div>
					<ol style={{ paddingLeft: 22, margin: 0, fontSize: 13, lineHeight: 1.6 }}>
						{scores.length === 0 && <li style={{ opacity: 0.6, listStyle: "none", paddingLeft: 0 }}>No solves yet.</li>}
						{scores.slice(0, 10).map((s, i) => (
							<li key={`${s.handle}-${s.created_at}-${i}`}>
								<span style={{ opacity: 0.9 }}>{s.handle}</span>
								<span style={{ float: "right", opacity: 0.75 }}>{(s.solve_ms / 1000).toFixed(2)}s</span>
							</li>
						))}
					</ol>
				</div>
			</div>
		</div>
	);
}
