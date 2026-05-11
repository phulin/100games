import { useCallback, useEffect, useRef, useState } from "react";

// Game 53: Echo Chamber
// Watch a sequence of colored pulses, then repeat it back. Get longer = more points.

const PADS = [
	{ id: 0, color: "#ff5e7e", glow: "#ffb0c0", freq: 261.63 },
	{ id: 1, color: "#5ed1ff", glow: "#a8e6ff", freq: 329.63 },
	{ id: 2, color: "#5eff8d", glow: "#b0ffc4", freq: 392.0 },
	{ id: 3, color: "#ffd75e", glow: "#ffeec0", freq: 493.88 },
];

export default function EchoChamber() {
	const [sequence, setSequence] = useState<number[]>([]);
	const [userIdx, setUserIdx] = useState(0);
	const [playingIdx, setPlayingIdx] = useState<number | null>(null);
	const [phase, setPhase] = useState<"watch" | "echo" | "fail" | "idle">("idle");
	const [score, setScore] = useState(0);
	const [best, setBest] = useState(() => parseInt(localStorage.getItem("g53_best") || "0", 10));
	const audioRef = useRef<AudioContext | null>(null);

	function ensureAudio() {
		if (!audioRef.current) {
			try {
				audioRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
			} catch {
				/* ignore */
			}
		}
	}

	function beep(freq: number, dur = 0.35) {
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
		g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
		g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
		o.start();
		o.stop(ac.currentTime + dur + 0.05);
	}

	const playSequence = useCallback(async (seq: number[]) => {
		setPhase("watch");
		for (let i = 0; i < seq.length; i++) {
			await new Promise((r) => setTimeout(r, 250));
			setPlayingIdx(seq[i]);
			beep(PADS[seq[i]].freq);
			await new Promise((r) => setTimeout(r, 450));
			setPlayingIdx(null);
		}
		setPhase("echo");
		setUserIdx(0);
	}, []);

	function startGame() {
		const first = Math.floor(Math.random() * 4);
		const seq = [first];
		setSequence(seq);
		setScore(0);
		playSequence(seq);
	}

	function pressPad(id: number) {
		if (phase !== "echo") return;
		beep(PADS[id].freq);
		setPlayingIdx(id);
		setTimeout(() => setPlayingIdx(null), 200);
		if (sequence[userIdx] === id) {
			const next = userIdx + 1;
			if (next >= sequence.length) {
				// success — extend sequence
				const ns = score + 1;
				setScore(ns);
				if (ns > best) {
					setBest(ns);
					localStorage.setItem("g53_best", String(ns));
				}
				const nextSeq = [...sequence, Math.floor(Math.random() * 4)];
				setSequence(nextSeq);
				setTimeout(() => playSequence(nextSeq), 600);
			} else {
				setUserIdx(next);
			}
		} else {
			setPhase("fail");
			beep(80, 0.6);
		}
	}

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const m: Record<string, number> = { "1": 0, "2": 1, "3": 2, "4": 3, q: 0, w: 1, e: 2, r: 3 };
			if (m[e.key.toLowerCase()] !== undefined) pressPad(m[e.key.toLowerCase()]);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	});

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
				Watch the pulses, then echo them back. Click pads or press 1-4 / QWER.
			</div>
			<div style={{ marginTop: 6, display: "flex", gap: 14, alignItems: "center" }}>
				<div>Score: {score}</div>
				<div>Best: {best}</div>
				<div style={{ opacity: 0.7 }}>{phase === "watch" ? "Listen..." : phase === "echo" ? "Your turn!" : phase === "fail" ? "Wrong — try again" : "Press Start"}</div>
				<button
					type="button"
					onClick={startGame}
					style={{ marginLeft: "auto", background: "#6a3fc0", color: "#fff", border: 0, padding: "4px 14px", borderRadius: 4, cursor: "pointer" }}
				>
					{phase === "idle" ? "Start" : "Restart"}
				</button>
			</div>
			<div
				style={{
					marginTop: 30,
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: 20,
					width: 520,
					marginLeft: "auto",
					marginRight: "auto",
				}}
			>
				{PADS.map((p) => {
					const active = playingIdx === p.id;
					return (
						<button
							type="button"
							key={p.id}
							onClick={() => pressPad(p.id)}
							style={{
								height: 220,
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
