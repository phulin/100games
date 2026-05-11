import { useEffect, useMemo, useState } from "react";

// Press Conference — sequence your questions correctly to unlock hidden facts.

type Topic = {
	id: string;
	question: string;
	defaultAnswer: string;
	unlockedAnswer?: string;
	requires?: string[]; // unlocked topic ids needed
	unlocks?: string[]; // topic ids it makes available
	fact?: string; // the hidden fact revealed when properly unlocked
};

const TOPICS: Topic[] = [
	{
		id: "schedule",
		question: "Where were you on Tuesday morning?",
		defaultAnswer: "I keep a busy schedule, you understand.",
		unlockedAnswer: "I was at a private meeting downtown.",
		fact: "Tuesday morning: downtown meeting.",
		unlocks: ["lobbyist"],
	},
	{
		id: "lobbyist",
		question: "Who did you meet downtown?",
		defaultAnswer: "I meet many constituents.",
		unlockedAnswer: "A representative of Northshore Energy.",
		requires: ["schedule"],
		fact: "Met with Northshore Energy lobbyist.",
		unlocks: ["donations", "bill"],
	},
	{
		id: "donations",
		question: "Has Northshore donated to your campaign?",
		defaultAnswer: "All donations are public record.",
		unlockedAnswer: "Yes — $48,000 last quarter.",
		requires: ["lobbyist"],
		fact: "$48,000 donation from Northshore last quarter.",
	},
	{
		id: "bill",
		question: "Why did you change your vote on Bill 412?",
		defaultAnswer: "I voted my conscience.",
		unlockedAnswer: "After fuller briefings on the technical details.",
		requires: ["lobbyist"],
		fact: "Switched vote on Bill 412 after Northshore meeting.",
		unlocks: ["aide"],
	},
	{
		id: "aide",
		question: "Did your chief of staff know about the meeting?",
		defaultAnswer: "My staff are aware of my schedule.",
		unlockedAnswer: "She arranged it personally.",
		requires: ["bill"],
		fact: "Chief of staff arranged the meeting.",
	},
	{
		id: "weather",
		question: "Any comment on the weather today?",
		defaultAnswer: "Lovely day for democracy.",
		// useless red herring
	},
];

export default function Game049_PressConference() {
	const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
	const [askedLog, setAskedLog] = useState<{ q: string; a: string }[]>([]);
	const [time, setTime] = useState(120);
	const [over, setOver] = useState(false);
	const [factsFound, setFactsFound] = useState<Set<string>>(new Set());

	useEffect(() => {
		if (over) return;
		const id = window.setInterval(() => {
			setTime((t) => {
				if (t <= 1) {
					setOver(true);
					return 0;
				}
				return t - 1;
			});
		}, 1000);
		return () => clearInterval(id);
	}, [over]);

	const ask = (id: string) => {
		if (over) return;
		const topic = TOPICS.find((t) => t.id === id)!;
		setTime((t) => Math.max(0, t - 8)); // each question costs time

		const reqMet =
			!topic.requires || topic.requires.every((r) => factsFound.has(r));
		const answer = reqMet && topic.unlockedAnswer ? topic.unlockedAnswer : topic.defaultAnswer;
		setAskedLog((log) => [...log, { q: topic.question, a: answer }]);

		if (reqMet && topic.fact) {
			setFactsFound((f) => {
				const ns = new Set(f);
				ns.add(topic.id);
				return ns;
			});
			if (topic.unlocks) {
				setUnlocked((u) => {
					const ns = new Set(u);
					topic.unlocks!.forEach((x) => ns.add(x));
					return ns;
				});
			}
		}
	};

	const availableTopics = useMemo(() => {
		// Always available: those with no `requires` (initial pool) plus unlocked
		return TOPICS.filter((t) => !t.requires || unlocked.has(t.id));
	}, [unlocked]);

	const score = factsFound.size * 10 + Math.floor(time / 5);

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#1a1820",
				color: "#dde",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				padding: 14,
				boxSizing: "border-box",
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<h2 style={{ margin: 4 }}>Press Conference</h2>
			<div style={{ fontSize: 13, opacity: 0.7, marginBottom: 8 }}>
				Sequence questions to pry loose hidden facts. Each question costs 8s. Time: {time}s.
			</div>
			<div style={{ display: "flex", gap: 12, width: "100%", maxWidth: 880 }}>
				<div style={{ flex: 1.4 }}>
					<div
						style={{
							background: "#0e0c14",
							padding: 12,
							borderRadius: 8,
							maxHeight: 360,
							overflowY: "auto",
						}}
					>
						{askedLog.length === 0 && (
							<div style={{ opacity: 0.5 }}>The politician waits at the podium.</div>
						)}
						{askedLog.map((q, i) => (
							<div key={i} style={{ marginBottom: 10 }}>
								<div style={{ color: "#a8d" }}>
									<strong>You:</strong> {q.q}
								</div>
								<div style={{ color: "#fc9" }}>
									<strong>Politician:</strong> {q.a}
								</div>
							</div>
						))}
					</div>
				</div>
				<div style={{ width: 280 }}>
					<div style={{ marginBottom: 6 }}>
						<strong>Topics</strong>
					</div>
					{availableTopics.map((t) => (
						<button
							key={t.id}
							type="button"
							onClick={() => ask(t.id)}
							disabled={over}
							style={{
								display: "block",
								width: "100%",
								textAlign: "left",
								margin: "4px 0",
								padding: 8,
								background: factsFound.has(t.id) ? "#2a3a2a" : "#2a2a3a",
								color: "#fff",
								border: "1px solid #445",
								borderRadius: 4,
								cursor: over ? "default" : "pointer",
								fontSize: 12,
							}}
						>
							{t.question}
							{factsFound.has(t.id) && " ✓"}
						</button>
					))}
					<div style={{ marginTop: 12, padding: 8, background: "#222", borderRadius: 6, fontSize: 12 }}>
						<strong>Facts uncovered ({factsFound.size}):</strong>
						<ul style={{ margin: 4, paddingLeft: 18 }}>
							{[...factsFound].map((id) => {
								const t = TOPICS.find((x) => x.id === id);
								return <li key={id}>{t?.fact}</li>;
							})}
						</ul>
					</div>
					{over && (
						<div style={{ marginTop: 8 }}>
							<div>Time up. Score: {score}</div>
							<button
								type="button"
								onClick={() => {
									setUnlocked(new Set());
									setAskedLog([]);
									setTime(120);
									setOver(false);
									setFactsFound(new Set());
								}}
								style={btn}
							>
								Try again
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#2a3045",
	color: "#fff",
	border: "1px solid #445",
	padding: "8px 14px",
	borderRadius: 6,
	cursor: "pointer",
	marginTop: 8,
};
