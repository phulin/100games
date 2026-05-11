import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Game 58: Memory Tide — seeded RNG, combo bonuses, peek penalty, audio, persistent best.

type Card = { id: number; sym: string; revealed: boolean; matched: boolean };

const SYMS = ["★", "✿", "♠", "♣", "♥", "♦", "✦", "✪", "❀", "✸", "☂", "☘", "♛", "♞", "☄"];
const BEST_KEY = "memory-tide:best";

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

function hashStr(s: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
	}
	return h >>> 0;
}

function makeDeck(level: number, runSeed: string): Card[] {
	const rng = mulberry32(hashStr(`mt:${runSeed}:${level}`));
	const pairs = Math.min(SYMS.length, 4 + level);
	const pool = SYMS.slice();
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	const arr: Card[] = [];
	let id = 0;
	for (let i = 0; i < pairs; i++) {
		arr.push({ id: id++, sym: pool[i], revealed: false, matched: false });
		arr.push({ id: id++, sym: pool[i], revealed: false, matched: false });
	}
	for (let i = arr.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
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
	const blip = useCallback((freq: number, dur = 0.12, type: OscillatorType = "sine", gain = 0.06) => {
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
	const match = useCallback((combo: number) => {
		const base = 523.25;
		blip(base + combo * 60, 0.18, "triangle", 0.08);
		setTimeout(() => blip(base * 1.5 + combo * 60, 0.2, "triangle", 0.07), 80);
	}, [blip]);
	const miss = useCallback(() => blip(200, 0.25, "sawtooth", 0.06), [blip]);
	const flip = useCallback(() => blip(700, 0.06, "square", 0.04), [blip]);
	return { match, miss, flip };
}

export default function MemoryTide() {
	const [runSeed, setRunSeed] = useState(() => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
	const [level, setLevel] = useState(1);
	const initialDeck = useMemo(() => makeDeck(1, runSeed), [runSeed]);
	const [deck, setDeck] = useState<Card[]>(initialDeck);
	const [flipped, setFlipped] = useState<number[]>([]);
	const [score, setScore] = useState(0);
	const [time, setTime] = useState(30);
	const [preview, setPreview] = useState(true);
	const [over, setOver] = useState(false);
	const [combo, setCombo] = useState(0);
	const [maxCombo, setMaxCombo] = useState(0);
	const [peekedUntil, setPeekedUntil] = useState(0);
	const [peekUses, setPeekUses] = useState(2);
	const [nowTick, setNowTick] = useState(0);
	const levelTransitionRef = useRef(false);
	const audio = useAudio();

	const [best, setBest] = useState<number>(() => {
		try {
			return Number.parseInt(localStorage.getItem(BEST_KEY) ?? "0", 10) || 0;
		} catch {
			return 0;
		}
	});

	useEffect(() => {
		setPreview(true);
		const id = setTimeout(() => setPreview(false), 2500 + level * 200);
		return () => clearTimeout(id);
	}, [deck, level]);

	useEffect(() => {
		if (preview || over) return;
		const id = setInterval(() => {
			setNowTick(performance.now());
			setTime((t) => {
				const nt = t - 0.1;
				if (nt <= 0) {
					setOver(true);
					return 0;
				}
				return nt;
			});
		}, 100);
		return () => clearInterval(id);
	}, [preview, over]);

	useEffect(() => {
		if (flipped.length === 2) {
			const [a, b] = flipped;
			const ca = deck[a];
			const cb = deck[b];
			if (ca.sym === cb.sym) {
				const newCombo = combo + 1;
				setCombo(newCombo);
				setMaxCombo((m) => Math.max(m, newCombo));
				audio.match(newCombo);
				setTimeout(() => {
					setDeck((d) => d.map((c, i) => (i === a || i === b ? { ...c, matched: true, revealed: true } : c)));
					setFlipped([]);
					setScore((s) => s + 10 + newCombo * 2);
				}, 350);
			} else {
				audio.miss();
				setCombo(0);
				setTimeout(() => {
					setDeck((d) => d.map((c, i) => (i === a || i === b ? { ...c, revealed: false } : c)));
					setFlipped([]);
				}, 700);
			}
		}
	}, [flipped, deck, combo, audio]);

	useEffect(() => {
		if (deck.length > 0 && deck.every((c) => c.matched) && !over && !levelTransitionRef.current) {
			levelTransitionRef.current = true;
			setScore((s) => s + Math.round(time * 5 + level * 20));
			const lv = level + 1;
			setTimeout(() => {
				setLevel(lv);
				setDeck(makeDeck(lv, runSeed));
				setTime(30 + lv * 2);
				setFlipped([]);
				setCombo(0);
				setPeekUses((u) => u + 1);
				levelTransitionRef.current = false;
			}, 800);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [deck, level, over, runSeed]);

	useEffect(() => {
		if (over && score > best) {
			setBest(score);
			try {
				localStorage.setItem(BEST_KEY, String(score));
			} catch {}
		}
	}, [over, score, best]);

	const peeking = nowTick < peekedUntil;

	function flip(i: number) {
		if (preview || over || peeking) return;
		if (flipped.length >= 2) return;
		if (deck[i].matched || deck[i].revealed) return;
		audio.flip();
		setDeck((d) => d.map((c, k) => (k === i ? { ...c, revealed: true } : c)));
		setFlipped((f) => [...f, i]);
	}

	function peek() {
		if (preview || over || peekUses <= 0 || peeking) return;
		setPeekUses((u) => u - 1);
		setPeekedUntil(performance.now() + 900);
		setNowTick(performance.now());
		setTime((t) => Math.max(0, t - 3));
		setCombo(0);
	}

	function reset() {
		const ns = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
		setRunSeed(ns);
		setLevel(1);
		setDeck(makeDeck(1, ns));
		setScore(0);
		setTime(30);
		setOver(false);
		setFlipped([]);
		setCombo(0);
		setMaxCombo(0);
		setPeekUses(2);
		setPeekedUntil(0);
		levelTransitionRef.current = false;
	}

	const cols = Math.ceil(Math.sqrt(deck.length * 1.4));
	const tideY = preview ? -200 : 0;
	const tideExtra = !preview && !over ? Math.max(0, (30 - time) * 4) : 0;

	return (
		<div style={{ background: "linear-gradient(#06283a,#0d4a66)", color: "#dff5ff", padding: 14, minHeight: 600, fontFamily: "'Trebuchet MS', sans-serif", position: "relative", overflow: "hidden" }}>
			<h2 style={{ margin: 0 }}>Memory Tide</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Memorize the shells before the tide comes in. Match pairs to clear the board. Chain matches for combo bonuses.
			</div>
			<div style={{ display: "flex", gap: 16, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
				<div>Level: {level}</div>
				<div>Score: {score}</div>
				<div>Best: {best}</div>
				<div>Time: {time.toFixed(1)}s</div>
				<div style={{ color: combo > 0 ? "#ffd07a" : "#dff5ff" }}>Combo: x{combo}</div>
				<div style={{ opacity: 0.7 }}>Max combo: {maxCombo}</div>
				<button
					type="button"
					onClick={peek}
					disabled={preview || over || peekUses <= 0 || peeking}
					style={{
						background: peekUses > 0 && !peeking ? "#0a6a8a" : "#2a3a55",
						color: "#fff",
						border: 0,
						padding: "2px 10px",
						borderRadius: 4,
						cursor: peekUses > 0 && !preview && !over && !peeking ? "pointer" : "default",
					}}
				>
					Peek ({peekUses}) -3s
				</button>
				{over && (
					<button type="button" onClick={reset} style={{ background: "#3aa0c0", color: "#fff", border: 0, padding: "2px 10px", borderRadius: 4 }}>
						Restart
					</button>
				)}
			</div>
			<div
				style={{
					marginTop: 16,
					display: "grid",
					gridTemplateColumns: `repeat(${cols}, 80px)`,
					gap: 10,
					justifyContent: "center",
					position: "relative",
					zIndex: 2,
				}}
			>
				{deck.map((c, i) => {
					const show = preview || c.revealed || c.matched || peeking;
					return (
						<button
							key={c.id}
							type="button"
							onClick={() => flip(i)}
							style={{
								width: 80,
								height: 80,
								borderRadius: 12,
								border: peeking ? "2px solid #ffd07a" : "2px solid #fff3",
								background: c.matched ? "#7be0a0" : show ? "#fff8e7" : "#1a3a5a",
								color: c.matched ? "#0a3a18" : "#3a2818",
								fontSize: 36,
								cursor: preview || over || peeking ? "default" : "pointer",
								boxShadow: "inset 0 -8px 14px #0003",
								transition: "background 0.2s",
							}}
						>
							{show ? c.sym : ""}
						</button>
					);
				})}
			</div>
			<div
				style={{
					position: "absolute",
					left: 0,
					right: 0,
					top: `calc(100% + ${tideY - tideExtra}px)`,
					height: 800,
					background: "linear-gradient(to bottom, rgba(60,150,200,0.0), rgba(40,100,140,0.6))",
					transition: "top 1.5s ease-in-out",
					pointerEvents: "none",
				}}
			/>
		</div>
	);
}
