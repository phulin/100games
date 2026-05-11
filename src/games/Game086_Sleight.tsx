import { useEffect, useMemo, useRef, useState } from "react";

// A seeded, procedurally generated stage magic performance. The player
// must hit each prompt in its narrow timing window to "force" the audience
// to pick the chosen card.

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

type PromptType = "tap" | "wave" | "snap";
type Prompt = { t: number; type: PromptType; label: string };

const PROMPT_LABELS: Record<PromptType, string[]> = {
	tap: ["Tap deck", "Tap (secure card)", "Tap (final hold)", "Tap (cut)"],
	wave: ["Wave hand", "Wave (continue mis-direct)", "Wave (cover)"],
	snap: ["Snap (force)", "Snap (reveal cue)", "Snap (palm)"],
};

const CARD_SUITS = ["♠", "♥", "♣", "♦"];
const CARD_RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "5", "3"];

type Difficulty = "easy" | "medium" | "hard";

const DIFF_CFG: Record<Difficulty, { count: number; window: number; duration: number }> = {
	easy: { count: 6, window: 0.7, duration: 12 },
	medium: { count: 9, window: 0.45, duration: 14 },
	hard: { count: 13, window: 0.3, duration: 16 },
};

function generateStage(seed: number, diff: Difficulty) {
	const rnd = mulberry32(seed);
	const cfg = DIFF_CFG[diff];
	const prompts: Prompt[] = [];
	const types: PromptType[] = ["tap", "wave", "snap"];
	const span = cfg.duration - 1.5;
	for (let i = 0; i < cfg.count; i++) {
		const slot = (i + 0.5) / cfg.count;
		const jitter = (rnd() - 0.5) * (span / cfg.count) * 0.6;
		const t = 0.9 + slot * span + jitter;
		const type = types[Math.floor(rnd() * 3)];
		const labels = PROMPT_LABELS[type];
		prompts.push({ t, type, label: labels[Math.floor(rnd() * labels.length)] });
	}
	prompts.sort((a, b) => a.t - b.t);
	const forcedRank = CARD_RANKS[Math.floor(rnd() * CARD_RANKS.length)];
	const forcedSuit = CARD_SUITS[Math.floor(rnd() * CARD_SUITS.length)];
	const deck: string[] = [];
	const used = new Set<string>();
	while (deck.length < 8) {
		const c = `${CARD_RANKS[Math.floor(rnd() * CARD_RANKS.length)]}${CARD_SUITS[Math.floor(rnd() * CARD_SUITS.length)]}`;
		if (!used.has(c)) { used.add(c); deck.push(c); }
	}
	const forced = `${forcedRank}${forcedSuit}`;
	if (!used.has(forced)) deck[Math.floor(rnd() * deck.length)] = forced;
	return { prompts, forced, deck, cfg };
}

let _ac: AudioContext | null = null;
function ac(): AudioContext | null {
	if (typeof window === "undefined") return null;
	if (!_ac) {
		const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
		const Ctor = W.AudioContext ?? W.webkitAudioContext;
		if (!Ctor) return null;
		_ac = new Ctor();
	}
	return _ac;
}
function blip(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.15) {
	const a = ac();
	if (!a) return;
	const o = a.createOscillator();
	const g = a.createGain();
	o.type = type;
	o.frequency.value = freq;
	g.gain.value = vol;
	g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
	o.connect(g).connect(a.destination);
	o.start();
	o.stop(a.currentTime + dur);
}

const TYPE_KEY: Record<PromptType, string> = { tap: "z", wave: "x", snap: "c" };
const HISCORE_KEY = "game086_sleight_best";

export default function Game086_Sleight() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [diff, setDiff] = useState<Difficulty>("medium");
	const stage = useMemo(() => generateStage(seed, diff), [seed, diff]);
	const { prompts, forced, deck, cfg } = stage;

	const [running, setRunning] = useState(false);
	const [time, setTime] = useState(0);
	const [hits, setHits] = useState<{ idx: number; ok: boolean; off: number }[]>([]);
	const [done, setDone] = useState(false);
	const [pick, setPick] = useState<string | null>(null);
	const startRef = useRef(0);
	const lastTickRef = useRef(0);
	const [best, setBest] = useState<number>(() => {
		if (typeof localStorage === "undefined") return 0;
		return Number(localStorage.getItem(HISCORE_KEY) ?? 0);
	});

	useEffect(() => {
		if (!running) return;
		startRef.current = performance.now();
		lastTickRef.current = 0;
		let raf = 0;
		const tick = (t: number) => {
			const elapsed = (t - startRef.current) / 1000;
			setTime(elapsed);
			const second = Math.floor(elapsed);
			if (second !== lastTickRef.current && second > 0) {
				lastTickRef.current = second;
				blip(440 + (second % 4 === 0 ? 220 : 0), 0.05, "square", 0.05);
			}
			if (elapsed > cfg.duration) {
				setRunning(false);
				setDone(true);
				return;
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [running, cfg.duration]);

	useEffect(() => {
		if (!done || pick !== null) return;
		const goodHits = hits.filter((h) => h.ok).length;
		const conf = goodHits / prompts.length;
		const rnd = mulberry32(seed ^ 0xdeadbeef ^ goodHits);
		const r = rnd();
		const chosen = r < 0.12 + conf * 0.85 ? forced : deck[Math.floor(rnd() * deck.length)];
		setPick(chosen);
		if (chosen === forced) {
			blip(523, 0.18, "sine", 0.2);
			setTimeout(() => blip(784, 0.25, "sine", 0.2), 120);
			const score = Math.round(conf * 100);
			if (score > best) {
				setBest(score);
				if (typeof localStorage !== "undefined") localStorage.setItem(HISCORE_KEY, String(score));
			}
		} else {
			blip(180, 0.4, "sawtooth", 0.18);
		}
	}, [done, pick, hits, prompts.length, seed, forced, deck, best]);

	const clickPrompt = (idx: number) => {
		if (!running) return;
		if (hits.some((h) => h.idx === idx)) return;
		const p = prompts[idx];
		const off = time - p.t;
		const ok = Math.abs(off) < cfg.window;
		setHits((h) => [...h, { idx, ok, off }]);
		if (ok) blip(Math.abs(off) < cfg.window * 0.3 ? 880 : 660, 0.08, "triangle", 0.15);
		else blip(220, 0.12, "square", 0.12);
	};

	useEffect(() => {
		if (!running) return;
		const onKey = (ev: KeyboardEvent) => {
			const k = ev.key.toLowerCase();
			const type = (Object.keys(TYPE_KEY) as PromptType[]).find((t) => TYPE_KEY[t] === k);
			if (!type) return;
			ev.preventDefault();
			// Pick the closest-in-time unhit prompt of this type within window*1.5.
			let bestIdx = -1;
			let bestOff = Infinity;
			for (let i = 0; i < prompts.length; i++) {
				if (prompts[i].type !== type) continue;
				if (hits.some((h) => h.idx === i)) continue;
				const off = Math.abs(time - prompts[i].t);
				if (off < cfg.window * 1.5 && off < bestOff) {
					bestOff = off;
					bestIdx = i;
				}
			}
			if (bestIdx >= 0) clickPrompt(bestIdx);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [running, prompts, hits, time, cfg.window]);

	const reset = (newSeed = seed) => {
		setSeed(newSeed);
		setRunning(false);
		setTime(0);
		setHits([]);
		setDone(false);
		setPick(null);
	};

	const goodHits = hits.filter((h) => h.ok).length;
	// Only penalise un-hit prompts after the performance is over; before then
	// the meter would otherwise start at 10%, which is misleading.
	const suspicion = (hits.length - goodHits) + (done ? prompts.length - goodHits : 0);
	const confPct = Math.max(0, 100 - suspicion * (90 / prompts.length));

	const typeColor: Record<PromptType, string> = {
		tap: "#3a86c4",
		wave: "#c47a3a",
		snap: "#a040c0",
	};

	return (
		<div
			style={{
				fontFamily: "Georgia, serif",
				color: "#eee",
				background: "linear-gradient(to bottom,#1a0820,#2a0830)",
				padding: 20,
				minHeight: 600,
			}}
		>
			<h2 style={{ margin: 0 }}>86. Sleight</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
				Click (or press <kbd>Z</kbd>/<kbd>X</kbd>/<kbd>C</kbd>) each prompt within ±{cfg.window}s.
				Force the audience to pick <strong>{forced}</strong>.
			</div>
			<div style={{ display: "flex", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
				<button type="button" onClick={() => { reset(seed); setRunning(true); }} style={btn} disabled={running}>Begin performance</button>
				<button type="button" onClick={() => reset(Math.floor(Math.random() * 1e9))} style={btn}>New stage</button>
				<select value={diff} onChange={(e) => { setDiff(e.target.value as Difficulty); reset(seed); }} disabled={running} style={{ ...btn, padding: "4px 8px" }}>
					<option value="easy">Easy</option>
					<option value="medium">Medium</option>
					<option value="hard">Hard</option>
				</select>
				<div style={{ alignSelf: "center", fontSize: 12 }}>
					Time {time.toFixed(2)}/{cfg.duration}s · Hits {goodHits}/{prompts.length} · Best {best}
				</div>
			</div>
			<div style={{ position: "relative", height: 90, background: "#1a0830", border: "1px solid #553060", borderRadius: 6, margin: "8px 0" }}>
				{prompts.map((p, i) => {
					const x = (p.t / cfg.duration) * 100;
					const h = hits.find((hh) => hh.idx === i);
					const inWin = running && Math.abs(time - p.t) < cfg.window && !h;
					const passed = running && time - p.t > cfg.window && !h;
					return (
						<div key={i} style={{ position: "absolute", left: `${x}%`, top: 0, bottom: 0, transform: "translateX(-50%)" }}>
							<button
								type="button"
								onClick={() => clickPrompt(i)}
								style={{
									position: "absolute",
									top: 10,
									left: "50%",
									transform: "translateX(-50%)",
									padding: "4px 6px",
									background: h ? h.ok ? "#3c8" : "#c44" : inWin ? "#fa3" : passed ? "#553060" : typeColor[p.type],
									color: "#fff",
									border: "1px solid #aaa",
									borderRadius: 4,
									fontSize: 11,
									cursor: "pointer",
									whiteSpace: "nowrap",
								}}
							>
								{p.label}
							</button>
							<div style={{ position: "absolute", top: 50, left: "50%", transform: "translateX(-50%)", fontSize: 10, opacity: 0.6 }}>
								{TYPE_KEY[p.type].toUpperCase()}
							</div>
						</div>
					);
				})}
				<div style={{ position: "absolute", left: `${(time / cfg.duration) * 100}%`, top: 0, bottom: 0, width: 2, background: "#fff", boxShadow: "0 0 6px #fff" }} />
			</div>
			<div style={{ marginTop: 12 }}>
				<div style={{ fontSize: 13, marginBottom: 4 }}>Audience confidence:</div>
				<div style={{ width: 300, height: 10, background: "#333", borderRadius: 5 }}>
					<div style={{ width: `${confPct}%`, height: "100%", background: "#3c8", borderRadius: 5 }} />
				</div>
			</div>
			<div style={{ marginTop: 16 }}>
				<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Deck on the table:</div>
				<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
					{deck.map((c) => {
						const isRed = c.includes("♥") || c.includes("♦");
						const highlighted = done && c === pick;
						return (
							<div
								key={c}
								style={{
									width: 46,
									height: 64,
									background: "#fafaf2",
									border: highlighted ? "3px solid #fa3" : "1px solid #999",
									borderRadius: 4,
									color: isRed ? "#c0303a" : "#111",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									fontFamily: "Georgia, serif",
									fontWeight: 600,
									fontSize: 18,
									boxShadow: highlighted ? "0 0 12px #fa3" : undefined,
								}}
							>
								{c}
							</div>
						);
					})}
				</div>
			</div>
			{done && (
				<div style={{ marginTop: 20, padding: 16, background: "#0e0420", border: "1px solid #553060", borderRadius: 6 }}>
					<div style={{ fontSize: 20 }}>Audience picks: <strong>{pick}</strong></div>
					<div style={{ fontSize: 14, marginTop: 4 }}>
						{pick === forced
							? `Perfect force. They never suspected. (${Math.round((goodHits / prompts.length) * 100)}%)`
							: "They picked freely. The trick collapsed."}
					</div>
				</div>
			)}
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "6px 12px",
	background: "#553060",
	color: "#fff",
	border: "1px solid #885090",
	borderRadius: 4,
	cursor: "pointer",
	fontFamily: "Georgia, serif",
};
