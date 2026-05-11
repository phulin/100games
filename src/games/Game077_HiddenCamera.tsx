import { useEffect, useRef, useState } from "react";

// Game 77 — Hidden Camera
// A scene plays out on a timeline. Scrub to identify *when* each event happened.

type Sprite = {
	id: number;
	name: string;
	color: string;
	keyframes: Array<{ t: number; x: number; y: number; holding?: string }>;
};

type Event = { id: string; label: string; time: number; tolerance: number };

const DURATION = 60; // seconds

function makeScene(seed: number) {
	const rand = (() => {
		let s = seed;
		return () => {
			s = (s * 1103515245 + 12345) & 0x7fffffff;
			return s / 0x7fffffff;
		};
	})();

	const tWallet = 10 + rand() * 35;
	const tDoor = 5 + rand() * 50;
	const tLights = 5 + rand() * 50;
	const tDog = 5 + rand() * 50;

	const sprites: Sprite[] = [
		{
			id: 1,
			name: "Person A",
			color: "#e89",
			keyframes: [
				{ t: 0, x: 50, y: 300 },
				{ t: tWallet - 1, x: 350, y: 300 },
				{ t: tWallet, x: 360, y: 300, holding: "wallet" },
				{ t: DURATION, x: 700, y: 300, holding: "wallet" },
			],
		},
		{
			id: 2,
			name: "Person B",
			color: "#8df",
			keyframes: [
				{ t: 0, x: 700, y: 400 },
				{ t: tDoor - 1, x: 600, y: 100 },
				{ t: tDoor, x: 600, y: 95 },
				{ t: DURATION, x: 100, y: 400 },
			],
		},
	];

	const events: Event[] = [
		{ id: "wallet", label: "Wallet was taken", time: tWallet, tolerance: 2 },
		{ id: "door", label: "Door opened", time: tDoor, tolerance: 2 },
		{ id: "lights", label: "Lights flickered", time: tLights, tolerance: 2 },
		{ id: "dog", label: "Dog barked", time: tDog, tolerance: 2 },
	];
	return { sprites, events };
}

function lerp(a: number, b: number, t: number) {
	return a + (b - a) * t;
}

function spriteAt(s: Sprite, t: number) {
	const kf = s.keyframes;
	for (let i = 0; i < kf.length - 1; i++) {
		if (t >= kf[i].t && t <= kf[i + 1].t) {
			const lt = (t - kf[i].t) / Math.max(0.01, kf[i + 1].t - kf[i].t);
			return {
				x: lerp(kf[i].x, kf[i + 1].x, lt),
				y: lerp(kf[i].y, kf[i + 1].y, lt),
				holding: kf[i + 1].holding ?? kf[i].holding,
			};
		}
	}
	const last = kf[kf.length - 1];
	return { x: last.x, y: last.y, holding: last.holding };
}

export default function Game077_HiddenCamera() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
	const scene = useRef(makeScene(seed));
	const [time, setTime] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [guesses, setGuesses] = useState<Record<string, number>>({});
	const [submitted, setSubmitted] = useState(false);
	const last = useRef<number | null>(null);

	useEffect(() => {
		scene.current = makeScene(seed);
		setTime(0);
		setGuesses({});
		setSubmitted(false);
	}, [seed]);

	useEffect(() => {
		if (!playing) return;
		let raf = 0;
		const step = (ts: number) => {
			if (last.current == null) last.current = ts;
			const dt = (ts - last.current) / 1000;
			last.current = ts;
			setTime((t) => {
				const nt = t + dt;
				if (nt >= DURATION) {
					setPlaying(false);
					return DURATION;
				}
				return nt;
			});
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => {
			cancelAnimationFrame(raf);
			last.current = null;
		};
	}, [playing]);

	const setGuess = (id: string) => {
		setGuesses((g) => ({ ...g, [id]: time }));
	};

	const submit = () => setSubmitted(true);

	const score = (() => {
		let s = 0;
		for (const e of scene.current.events) {
			const g = guesses[e.id];
			if (g == null) continue;
			const err = Math.abs(g - e.time);
			s += Math.max(0, 100 - (err / e.tolerance) * 50);
		}
		return Math.round(s);
	})();

	const sprites = scene.current.sprites;

	return (
		<div
			style={{
				width: 900,
				height: 600,
				background: "#0a0a0a",
				color: "#cfc",
				fontFamily: "monospace",
				padding: 12,
				boxSizing: "border-box",
				userSelect: "none",
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between" }}>
				<b>Hidden Camera</b>
				<span>Scrub the timeline. Mark when each event happened.</span>
			</div>

			{/* camera feed */}
			<div
				style={{
					marginTop: 8,
					width: 876,
					height: 380,
					background: "#1a2018",
					position: "relative",
					border: "2px solid #2a3a28",
					overflow: "hidden",
				}}
			>
				<div
					style={{
						position: "absolute",
						top: 4,
						right: 8,
						color: "#f55",
						fontSize: 12,
					}}
				>
					● REC {time.toFixed(2)}s
				</div>
				{/* room features */}
				<div style={{ position: "absolute", left: 580, top: 60, width: 60, height: 90, border: "2px solid #555" }}>
					<div style={{ color: "#777", fontSize: 10, padding: 2 }}>door</div>
				</div>
				<div style={{ position: "absolute", left: 320, top: 290, width: 80, height: 50, background: "#333" }}>
					<div style={{ color: "#999", fontSize: 10, padding: 2 }}>table</div>
				</div>
				{sprites.map((s) => {
					const p = spriteAt(s, time);
					return (
						<div
							key={s.id}
							style={{
								position: "absolute",
								left: p.x - 12,
								top: p.y - 12,
								width: 24,
								height: 24,
								borderRadius: "50%",
								background: s.color,
								fontSize: 11,
								color: "#000",
								textAlign: "center",
								lineHeight: "24px",
							}}
						>
							{s.name[7]}
							{p.holding && (
								<div
									style={{
										position: "absolute",
										left: 24,
										top: 0,
										fontSize: 11,
										color: "#fc8",
										whiteSpace: "nowrap",
									}}
								>
									holds {p.holding}
								</div>
							)}
						</div>
					);
				})}
			</div>

			{/* timeline */}
			<input
				type="range"
				min={0}
				max={DURATION}
				step={0.01}
				value={time}
				onChange={(e) => setTime(parseFloat(e.target.value))}
				style={{ width: "100%", marginTop: 6 }}
			/>

			<div style={{ display: "flex", gap: 8, marginTop: 6 }}>
				<button onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
				<button onClick={() => setTime(0)}>Rewind</button>
				<button
					onClick={() => {
						setSeed(Math.floor(Math.random() * 1e6));
					}}
				>
					New scene
				</button>
			</div>

			{/* events */}
			<div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 13 }}>
				{scene.current.events.map((e) => {
					const g = guesses[e.id];
					const err = submitted && g != null ? Math.abs(g - e.time) : null;
					return (
						<div key={e.id}>
							<button onClick={() => setGuess(e.id)} style={{ marginRight: 6 }}>
								Mark
							</button>
							{e.label}: {g != null ? `t=${g.toFixed(2)}s` : "—"}
							{submitted && (
								<span style={{ color: err! < e.tolerance ? "#6f6" : "#f88" }}>
									{" "}
									(actual {e.time.toFixed(2)}, err {err!.toFixed(2)})
								</span>
							)}
						</div>
					);
				})}
			</div>

			<div style={{ marginTop: 8 }}>
				<button onClick={submit} disabled={submitted}>
					Submit
				</button>
				{submitted && <span style={{ marginLeft: 12 }}>Score: <b>{score}/400</b></span>}
			</div>
		</div>
	);
}
