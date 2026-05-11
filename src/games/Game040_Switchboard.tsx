import { useEffect, useRef, useState } from "react";

// 1940s switchboard. At round start, 8 subscribers shown with names and line numbers (1-8).
// After memorization phase, calls arrive: a name flashes; player must click the line.
// Time pressure increases. Wrong line drops the call. Score = handled - missed.

const NAMES = [
	"Mrs. Albright",
	"Mr. Crane",
	"Dr. Hollis",
	"Miss Pemberton",
	"Mr. Vance",
	"Mrs. Dunbar",
	"Mr. Thorpe",
	"Miss Fairfax",
	"Mr. Whitaker",
	"Mrs. Eastman",
];

type Subscriber = { name: string; line: number };
type Call = { id: number; name: string; deadline: number; ringStart: number };

function pickSubscribers(): Subscriber[] {
	const shuffled = [...NAMES].sort(() => Math.random() - 0.5).slice(0, 8);
	return shuffled.map((name, i) => ({ name, line: i + 1 }));
}

export default function Switchboard() {
	const [subscribers, setSubscribers] = useState<Subscriber[]>(() => pickSubscribers());
	const [phase, setPhase] = useState<"memorize" | "play" | "over">("memorize");
	const [memTime, setMemTime] = useState(15); // seconds
	const [calls, setCalls] = useState<Call[]>([]);
	const [score, setScore] = useState(0);
	const [missed, setMissed] = useState(0);
	const [now, setNow] = useState(performance.now());
	const subsRef = useRef(subscribers);
	subsRef.current = subscribers;

	// Memorization countdown
	useEffect(() => {
		if (phase !== "memorize") return;
		const id = setInterval(() => {
			setMemTime((t) => {
				if (t <= 1) {
					clearInterval(id);
					setPhase("play");
					return 0;
				}
				return t - 1;
			});
		}, 1000);
		return () => clearInterval(id);
	}, [phase]);

	// Game tick
	useEffect(() => {
		if (phase !== "play") return;
		let raf = 0;
		const tick = () => {
			setNow(performance.now());
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [phase]);

	// Call spawner
	useEffect(() => {
		if (phase !== "play") return;
		const spawn = () => {
			const subs = subsRef.current;
			const sub = subs[Math.floor(Math.random() * subs.length)];
			setCalls((cs) => {
				if (cs.length >= 3) return cs;
				const now = performance.now();
				return [
					...cs,
					{
						id: Date.now() + Math.random(),
						name: sub.name,
						deadline: now + 6000 - Math.min(3000, score * 100),
						ringStart: now,
					},
				];
			});
		};
		const interval = setInterval(spawn, Math.max(1500, 3500 - score * 100));
		return () => clearInterval(interval);
	}, [phase, score]);

	// Expire calls
	useEffect(() => {
		if (phase !== "play") return;
		setCalls((cs) => {
			const survivors: Call[] = [];
			let expired = 0;
			for (const c of cs) {
				if (now > c.deadline) expired++;
				else survivors.push(c);
			}
			if (expired > 0) {
				setMissed((m) => m + expired);
			}
			return survivors;
		});
	}, [now, phase]);

	useEffect(() => {
		if (missed >= 5 && phase === "play") setPhase("over");
	}, [missed, phase]);

	const plugLine = (line: number) => {
		if (phase !== "play") return;
		// Match against oldest call
		setCalls((cs) => {
			if (cs.length === 0) return cs;
			const target = cs[0];
			const sub = subscribers.find((s) => s.name === target.name)!;
			if (sub.line === line) {
				setScore((s) => s + 1);
				return cs.slice(1);
			} else {
				setMissed((m) => m + 1);
				return cs.slice(1);
			}
		});
	};

	const reset = () => {
		setSubscribers(pickSubscribers());
		setPhase("memorize");
		setMemTime(15);
		setCalls([]);
		setScore(0);
		setMissed(0);
	};

	return (
		<div style={{ background: "#2a1c10", color: "#f4e8d0", padding: 16, fontFamily: "Georgia, serif" }}>
			<h2 style={{ margin: "0 0 4px" }}>Switchboard</h2>
			<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
				Memorize who is on which line. When a call comes in, click their line. 5 missed = game over.
			</div>
			<div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
				<div>Connected: {score}</div>
				<div style={{ color: missed > 2 ? "#f88" : "#fc6" }}>Missed: {missed}/5</div>
				{phase === "memorize" && <div>Memorize: {memTime}s</div>}
				{phase === "over" && <div style={{ color: "#f88" }}>GAME OVER</div>}
				<button type="button" onClick={reset}>
					{phase === "over" ? "Try again" : "Restart"}
				</button>
			</div>

			{/* Subscribers panel (visible during memorize, hidden during play) */}
			<div
				style={{
					background: "#1a1008",
					padding: 12,
					borderRadius: 6,
					marginBottom: 12,
					minHeight: 80,
				}}
			>
				<div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
					{phase === "memorize" ? "Directory" : "Directory (concealed)"}
				</div>
				<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
					{subscribers.map((s) => (
						<div
							key={s.line}
							style={{
								padding: 6,
								background: "#3a2818",
								borderRadius: 4,
								fontSize: 13,
							}}
						>
							{phase === "memorize" ? (
								<>
									<span style={{ color: "#fc6" }}>L{s.line}</span> · {s.name}
								</>
							) : (
								<span style={{ opacity: 0.3 }}>L{s.line} · ???</span>
							)}
						</div>
					))}
				</div>
			</div>

			{/* Incoming calls */}
			<div style={{ display: "flex", gap: 8, minHeight: 60, marginBottom: 12 }}>
				{calls.map((c, i) => {
					const remaining = Math.max(0, c.deadline - now);
					const total = c.deadline - c.ringStart;
					return (
						<div
							key={c.id}
							style={{
								padding: 10,
								background: i === 0 ? "#a83" : "#3a2818",
								borderRadius: 6,
								flex: 1,
								color: "#fff",
								boxShadow: i === 0 ? "0 0 12px rgba(255,200,80,0.5)" : undefined,
							}}
						>
							<div style={{ fontSize: 14, fontWeight: "bold" }}>{c.name}</div>
							<div style={{ height: 4, background: "#221", marginTop: 4, borderRadius: 2 }}>
								<div
									style={{
										width: `${(remaining / total) * 100}%`,
										height: "100%",
										background: remaining < 1500 ? "#f44" : "#fc6",
										borderRadius: 2,
									}}
								/>
							</div>
						</div>
					);
				})}
				{calls.length === 0 && phase === "play" && (
					<div style={{ opacity: 0.5, alignSelf: "center" }}>Lines quiet...</div>
				)}
			</div>

			{/* Switchboard lines */}
			<div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8 }}>
				{subscribers.map((s) => (
					<button
						key={s.line}
						type="button"
						onClick={() => plugLine(s.line)}
						style={{
							height: 80,
							background: "#1a1008",
							border: "2px solid #5a4020",
							borderRadius: 6,
							color: "#fc6",
							fontSize: 20,
							fontWeight: "bold",
							cursor: "pointer",
						}}
					>
						L{s.line}
					</button>
				))}
			</div>
		</div>
	);
}
