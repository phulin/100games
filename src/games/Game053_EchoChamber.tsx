import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Game 53: Echo Chamber
// Watch a sequence of colored pulses, then repeat it back. Get longer = more points.
// Improvements:
//   1. Seeded mulberry32 RNG for deterministic daily challenge (same sequence today)
//   2. Three modes: Normal, Reverse (echo backwards), Speed (faster playback, x2 score)
//   3. Fifth pad unlocks at round 5+ (pentad mode) for higher difficulty
//   4. Persistent stats: rounds played, longest streak, mistakes (localStorage)
//   5. Triadic chord WebAudio cue + ambient sine pad

const PADS = [
	{ id: 0, color: "#ff5e7e", glow: "#ffb0c0", freq: 261.63 },
	{ id: 1, color: "#5ed1ff", glow: "#a8e6ff", freq: 329.63 },
	{ id: 2, color: "#5eff8d", glow: "#b0ffc4", freq: 392.0 },
	{ id: 3, color: "#ffd75e", glow: "#ffeec0", freq: 493.88 },
	{ id: 4, color: "#c47bff", glow: "#e6c8ff", freq: 587.33 },
];

type Mode = "normal" | "reverse" | "speed";

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
	return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

type Stats = { played: number; longest: number; mistakes: number };
const STATS_KEY = "g53_stats";
function loadStats(): Stats {
	try {
		const raw = localStorage.getItem(STATS_KEY);
		if (!raw) return { played: 0, longest: 0, mistakes: 0 };
		const obj = JSON.parse(raw) as Partial<Stats>;
		return {
			played: obj.played ?? 0,
			longest: obj.longest ?? 0,
			mistakes: obj.mistakes ?? 0,
		};
	} catch {
		return { played: 0, longest: 0, mistakes: 0 };
	}
}

export default function EchoChamber() {
	const [mode, setMode] = useState<Mode>("normal");
	const [seed, setSeed] = useState<number>(() => todayUTCSeed());
	const [sequence, setSequence] = useState<number[]>([]);
	const [userIdx, setUserIdx] = useState(0);
	const [playingIdx, setPlayingIdx] = useState<number | null>(null);
	const [phase, setPhase] = useState<"watch" | "echo" | "fail" | "idle">("idle");
	const [score, setScore] = useState(0);
	const [best, setBest] = useState(() => parseInt(localStorage.getItem("g53_best") || "0", 10));
	const [stats, setStats] = useState<Stats>(() => loadStats());
	const audioRef = useRef<AudioContext | null>(null);
	const padAudioRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
	const rngRef = useRef<() => number>(mulberry32(seed));

	const padCount = sequence.length >= 5 ? 5 : 4;
	const expected = useMemo(() => (mode === "reverse" ? [...sequence].reverse() : sequence), [mode, sequence]);

	function ensureAudio() {
		if (!audioRef.current) {
			try {
				audioRef.current = new (window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
			} catch {
				/* ignore */
			}
		}
		const ac = audioRef.current;
		if (ac && !padAudioRef.current) {
			const o = ac.createOscillator();
			const g = ac.createGain();
			o.type = "sine";
			o.frequency.value = 110;
			g.gain.value = 0.0;
			o.connect(g);
			g.connect(ac.destination);
			o.start();
			padAudioRef.current = { osc: o, gain: g };
		}
		if (padAudioRef.current && ac) {
			padAudioRef.current.gain.gain.setTargetAtTime(0.025, ac.currentTime, 0.5);
		}
	}

	function beep(freq: number, dur = 0.35, vol = 0.25) {
		ensureAudio();
		const ac = audioRef.current;
		if (!ac) return;
		const o = ac.createOscillator();
		const g = ac.createGain();
		o.type = "sine";
		o.frequency.value = freq;
		o.connect(g);
		g.connect(ac.destination);
		g.gain.setValueAtTime(0.0001, ac.currentTime);
		g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.02);
		g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
		o.start();
		o.stop(ac.currentTime + dur + 0.05);
	}

	function chord(freqs: number[]) {
		freqs.forEach((f, i) => setTimeout(() => beep(f, 0.25, 0.12), i * 40));
	}

	const playSequence = useCallback(async (seq: number[], m: Mode) => {
		setPhase("watch");
		const flash = m === "speed" ? 280 : 450;
		const gap = m === "speed" ? 160 : 250;
		const show = m === "reverse" ? [...seq].reverse() : seq;
		for (let i = 0; i < show.length; i++) {
			await new Promise((r) => setTimeout(r, gap));
			setPlayingIdx(show[i]);
			beep(PADS[show[i]].freq, flash / 1000);
			await new Promise((r) => setTimeout(r, flash));
			setPlayingIdx(null);
		}
		setPhase("echo");
		setUserIdx(0);
	}, []);

	const startGame = useCallback(() => {
		ensureAudio();
		rngRef.current = mulberry32(seed);
		const first = Math.floor(rngRef.current() * 4);
		const seq = [first];
		setSequence(seq);
		setScore(0);
		setStats((s) => {
			const ns = { ...s, played: s.played + 1 };
			localStorage.setItem(STATS_KEY, JSON.stringify(ns));
			return ns;
		});
		chord([261.63, 329.63, 392.0]);
		playSequence(seq, mode);
	}, [seed, mode, playSequence]);

	const pressPad = useCallback(
		(id: number) => {
			if (phase !== "echo") return;
			if (id >= padCount) return;
			beep(PADS[id].freq);
			setPlayingIdx(id);
			setTimeout(() => setPlayingIdx(null), 200);
			if (expected[userIdx] === id) {
				const next = userIdx + 1;
				if (next >= expected.length) {
					const speedBonus = mode === "speed" ? 2 : 1;
					const ns = score + 1 * speedBonus;
					setScore(ns);
					if (ns > best) {
						setBest(ns);
						localStorage.setItem("g53_best", String(ns));
					}
					setStats((s) => {
						const ns2 = { ...s, longest: Math.max(s.longest, sequence.length) };
						localStorage.setItem(STATS_KEY, JSON.stringify(ns2));
						return ns2;
					});
					const upperPad = sequence.length >= 4 ? 5 : 4;
					const nextSeq = [...sequence, Math.floor(rngRef.current() * upperPad)];
					setSequence(nextSeq);
					chord([392.0, 493.88, 587.33]);
					setTimeout(() => playSequence(nextSeq, mode), 600);
				} else {
					setUserIdx(next);
				}
			} else {
				setPhase("fail");
				beep(80, 0.6);
				setStats((s) => {
					const ns = { ...s, mistakes: s.mistakes + 1 };
					localStorage.setItem(STATS_KEY, JSON.stringify(ns));
					return ns;
				});
			}
		},
		[phase, padCount, expected, userIdx, sequence, score, best, mode, playSequence],
	);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const m: Record<string, number> = {
				"1": 0,
				"2": 1,
				"3": 2,
				"4": 3,
				"5": 4,
				q: 0,
				w: 1,
				e: 2,
				r: 3,
				t: 4,
			};
			const k = e.key.toLowerCase();
			if (m[k] !== undefined) pressPad(m[k]);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [pressPad]);

	useEffect(() => {
		return () => {
			padAudioRef.current?.osc.stop();
			padAudioRef.current = null;
			audioRef.current?.close().catch(() => {});
			audioRef.current = null;
		};
	}, []);

	const pads = PADS.slice(0, padCount);

	return (
		<div
			style={{
				background: "radial-gradient(circle at 50% 30%, #2a1840, #0a0518)",
				color: "#eee",
				padding: 16,
				minHeight: 600,
				fontFamily: "'Trebuchet MS', sans-serif",
			}}
		>
			<h2 style={{ margin: 0 }}>Echo Chamber</h2>
			<div style={{ fontSize: 13, opacity: 0.85 }}>
				Watch the pulses, then echo. Modes: Normal, Reverse (echo backwards), Speed (faster, x2 score).
			</div>
			<div style={{ marginTop: 6, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
				<div>Score: {score}</div>
				<div>Best: {best}</div>
				<div style={{ opacity: 0.7 }}>
					{phase === "watch" ? "Listen..." : phase === "echo" ? "Your turn!" : phase === "fail" ? "Wrong — try again" : "Press Start"}
				</div>
				<div style={{ marginLeft: 8, opacity: 0.7, fontSize: 12 }}>
					Played: {stats.played} · Longest: {stats.longest} · Mistakes: {stats.mistakes}
				</div>
				<div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
					{(["normal", "reverse", "speed"] as Mode[]).map((m) => (
						<button
							key={m}
							type="button"
							onClick={() => setMode(m)}
							style={{
								background: mode === m ? "#a56ee0" : "#3a234a",
								color: "#fff",
								border: 0,
								padding: "2px 8px",
								borderRadius: 4,
								cursor: "pointer",
							}}
						>
							{m}
						</button>
					))}
					<button
						type="button"
						onClick={() => setSeed(todayUTCSeed())}
						style={{ background: "#5ed1ff", color: "#000", border: 0, padding: "2px 8px", borderRadius: 4 }}
					>
						Daily
					</button>
					<button
						type="button"
						onClick={() => setSeed(Math.floor(Math.random() * 0x7fffffff))}
						style={{ background: "#6a3fc0", color: "#fff", border: 0, padding: "2px 8px", borderRadius: 4 }}
					>
						New
					</button>
					<button
						type="button"
						onClick={startGame}
						style={{ background: "#6a3fc0", color: "#fff", border: 0, padding: "4px 14px", borderRadius: 4, cursor: "pointer" }}
					>
						{phase === "idle" ? "Start" : "Restart"}
					</button>
				</div>
			</div>
			<div style={{ opacity: 0.55, fontSize: 11, marginTop: 4 }}>Seed {seed}</div>
			<div
				style={{
					marginTop: 24,
					display: "grid",
					gridTemplateColumns: padCount === 5 ? "1fr 1fr 1fr" : "1fr 1fr",
					gap: 20,
					width: padCount === 5 ? 720 : 520,
					marginLeft: "auto",
					marginRight: "auto",
				}}
			>
				{pads.map((p) => {
					const active = playingIdx === p.id;
					return (
						<button
							type="button"
							key={p.id}
							onClick={() => pressPad(p.id)}
							style={{
								height: 200,
								borderRadius: 24,
								border: "3px solid #fff3",
								background: active ? p.glow : p.color,
								boxShadow: active ? `0 0 80px ${p.glow}` : "inset 0 -20px 40px #0006",
								transition: "all 80ms",
								cursor: phase === "echo" ? "pointer" : "default",
							}}
							aria-label={`pad ${p.id}`}
						/>
					);
				})}
			</div>
		</div>
	);
}
