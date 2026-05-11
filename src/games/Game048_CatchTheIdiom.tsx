import { useEffect, useRef, useState, type ReactElement } from "react";

// Catch the Idiom — type the idiom that matches the literal scene.

type Round = { idiom: string; scene: (t: number) => ReactElement };

const ROUNDS: Round[] = [
	{
		idiom: "kick the bucket",
		scene: (t) => (
			<g>
				<rect x={380} y={300} width={60} height={70} fill="#a76" />
				<g transform={`translate(${300 + Math.min(80, t * 200)}, ${280})`}>
					<circle r={18} cy={-20} fill="#fc9" />
					<rect x={-6} y={-2} width={12} height={40} fill="#356" />
					<line x1={6} y1={20} x2={50} y2={20} stroke="#356" strokeWidth={4} />
				</g>
			</g>
		),
	},
	{
		idiom: "spill the beans",
		scene: (t) => (
			<g>
				<ellipse cx={440} cy={310} rx={50} ry={20} fill="#985" />
				<rect x={420 + t * 80} y={250} width={40} height={50} fill="#cb8" transform={`rotate(${t * 90} 440 270)`} />
				{Array.from({ length: 10 }).map((_, i) => (
					<circle key={i} cx={440 + (i - 5) * 12 + t * 50} cy={320 + Math.sin(i + t * 5) * 8} r={4} fill="#5a3" />
				))}
			</g>
		),
	},
	{
		idiom: "break the ice",
		scene: (t) => (
			<g>
				<rect x={200} y={300} width={500} height={50} fill="#9cf" opacity={0.7} />
				<rect x={350 - t * 30} y={310} width={20 + t * 30} height={30} fill="#fff" />
				<rect x={450 + t * 30} y={310} width={20 + t * 30} height={30} fill="#fff" />
				<circle cx={440} cy={280} r={20} fill="#fc9" />
			</g>
		),
	},
	{
		idiom: "let the cat out of the bag",
		scene: (t) => (
			<g>
				<polygon points="380,300 500,300 500,380 380,380" fill="#a86" />
				<g transform={`translate(${440}, ${360 - t * 100})`}>
					<ellipse cx={0} cy={0} rx={18} ry={12} fill="#888" />
					<circle cx={-10} cy={-10} r={10} fill="#888" />
					<polygon points="-15,-15 -8,-25 -2,-15" fill="#888" />
					<polygon points="0,-15 7,-25 12,-15" fill="#888" />
				</g>
			</g>
		),
	},
	{
		idiom: "raining cats and dogs",
		scene: (t) => (
			<g>
				{Array.from({ length: 12 }).map((_, i) => {
					const y = ((i * 47 + t * 200) % 400);
					const x = 100 + i * 60;
					return i % 2 === 0 ? (
						<text key={i} x={x} y={y} fontSize={24}>
							🐈
						</text>
					) : (
						<text key={i} x={x} y={y} fontSize={24}>
							🐕
						</text>
					);
				})}
			</g>
		),
	},
	{
		idiom: "bite the bullet",
		scene: (t) => (
			<g>
				<g transform={`translate(440, ${300 - Math.sin(t * 6) * 4})`}>
					<circle r={26} fill="#fc9" />
					<rect x={-12} y={6} width={24} height={4} fill="#222" />
				</g>
				<rect x={460 - t * 20} y={295} width={30} height={8} fill="#888" rx={3} />
			</g>
		),
	},
	{
		idiom: "hit the nail on the head",
		scene: (t) => (
			<g>
				<rect x={440} y={300 - t * 20} width={6} height={30} fill="#aaa" />
				<rect x={400} y={330} width={80} height={20} fill="#a85" />
				<g transform={`translate(443, ${260 - Math.sin(t * 8) * 10}) rotate(${Math.sin(t * 8) * 30})`}>
					<rect x={-30} y={-10} width={40} height={20} fill="#553" />
					<rect x={-5} y={-25} width={6} height={60} fill="#a73" />
				</g>
			</g>
		),
	},
];

export default function Game048_CatchTheIdiom() {
	const [round, setRound] = useState(0);
	const [t, setT] = useState(0);
	const [input, setInput] = useState("");
	const [score, setScore] = useState(0);
	const [flash, setFlash] = useState<string | null>(null);
	const [over, setOver] = useState(false);
	const startT = useRef(0);
	const baseTime = 8;
	const timeLeft = Math.max(0, baseTime - Math.pow(round * 0.6, 1.2) - t);

	useEffect(() => {
		let raf = 0;
		const step = (ts: number) => {
			if (!startT.current) startT.current = ts;
			const elapsed = (ts - startT.current) / 1000;
			setT(elapsed);
			if (elapsed > baseTime - Math.pow(round * 0.6, 1.2)) {
				if (!over) {
					setOver(true);
					setFlash(`Out of time! The idiom was "${ROUNDS[round].idiom}".`);
				}
				return;
			}
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [round, over]);

	const submit = () => {
		if (over) return;
		// Normalize aggressively: strip punctuation, collapse whitespace, lower-case.
		// Without this, "Kick the bucket." or "kick  the bucket" wrongly fail.
		const normalize = (s: string) =>
			s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
		const norm = normalize(input);
		if (!norm) return; // ignore empty Enter presses instead of flashing "Not quite"
		if (norm === normalize(ROUNDS[round].idiom)) {
			setScore((s) => s + Math.ceil(timeLeft * 10));
			next();
		} else {
			setFlash("Not quite — try again.");
			setTimeout(() => setFlash(null), 600);
		}
	};

	const next = () => {
		if (round + 1 >= ROUNDS.length) {
			setOver(true);
			setFlash("All idioms caught!");
			return;
		}
		setRound(round + 1);
		setInput("");
		setT(0);
		startT.current = 0;
		setOver(false);
		setFlash(null);
	};

	const restart = () => {
		setRound(0);
		setInput("");
		setT(0);
		startT.current = 0;
		setOver(false);
		setFlash(null);
		setScore(0);
	};

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#fef3d4",
				color: "#2a1d10",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<h2 style={{ margin: 4 }}>Catch the Idiom</h2>
			<div style={{ fontSize: 13, opacity: 0.7 }}>
				Watch the literal scene. Type the idiom it depicts before time runs out.
			</div>
			<svg width={880} height={420} style={{ background: "#fff8e0", borderRadius: 8, marginTop: 8 }}>
				<rect x={0} y={370} width={880} height={50} fill="#a98a55" />
				{ROUNDS[round].scene(t)}
			</svg>
			<div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
				<input
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") submit();
					}}
					placeholder="type the idiom..."
					disabled={over}
					style={{
						padding: 8,
						borderRadius: 6,
						border: "1px solid #a98a55",
						background: "#fff",
						width: 260,
					}}
				/>
				<button type="button" onClick={submit} disabled={over} style={btn}>
					Catch
				</button>
				<div>Time: {timeLeft.toFixed(1)}s</div>
				<div>Score: {score}</div>
				<div>
					Round {round + 1}/{ROUNDS.length}
				</div>
			</div>
			{flash && (
				<div style={{ marginTop: 8, color: "#a40" }}>
					{flash}{" "}
					{over && (
						<button type="button" onClick={round + 1 >= ROUNDS.length ? restart : next} style={btn}>
							{round + 1 >= ROUNDS.length ? "Restart" : "Next"}
						</button>
					)}
				</div>
			)}
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#7d5a30",
	color: "#fff",
	border: "none",
	padding: "8px 14px",
	borderRadius: 6,
	cursor: "pointer",
};
