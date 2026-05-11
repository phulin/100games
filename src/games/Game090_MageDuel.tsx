import { useEffect, useState } from "react";

// Seven elements with rock-paper-scissors-ish chart (each beats 3, loses to 3).
const ELEMENTS = [
	"Fire",
	"Water",
	"Earth",
	"Air",
	"Lightning",
	"Ice",
	"Void",
] as const;
type Element = (typeof ELEMENTS)[number];

const SEALED_ROUNDS = 5;

// beats[i] = list of indices that element i beats.
// We use the pattern: i beats (i+1), (i+2), (i+3) mod 7.
function beats(a: number, b: number): "a" | "b" | "tie" {
	if (a === b) return "tie";
	const diff = (b - a + 7) % 7;
	if (diff >= 1 && diff <= 3) return "a";
	return "b";
}

type RoundLog = {
	player: Element;
	ai: Element;
	outcome: "a" | "b" | "tie";
	cascade: number;
};

type PvpMatch = {
	id: number;
	challenger: string;
	challenger_seq: number[] | string | null;
	defender: string | null;
	defender_seq: number[] | string | null;
	result: "challenger_win" | "defender_win" | "draw" | null;
	created_at: number;
	resolved_at: number | null;
	rounds?: number;
};

function getAuthorId(): string {
	if (typeof window === "undefined") return "anon";
	const key = "mage_duel_author";
	let v = localStorage.getItem(key);
	if (!v) {
		v = `m${Math.random().toString(36).slice(2, 10)}`;
		localStorage.setItem(key, v);
	}
	return v;
}

const elementColor = (e: Element) => {
	const map: Record<Element, string> = {
		Fire: "#e94560",
		Water: "#3060d0",
		Earth: "#8a6030",
		Air: "#a0c8e0",
		Lightning: "#f0d030",
		Ice: "#a0e0ff",
		Void: "#603080",
	};
	return map[e];
};

export default function Game090_MageDuel() {
	// Local AI duel state (unchanged behavior).
	const [playerWins, setPlayerWins] = useState(0);
	const [aiWins, setAiWins] = useState(0);
	const [log, setLog] = useState<RoundLog[]>([]);
	const [over, setOver] = useState(false);

	// AI strategy: weighted by history of player picks; slight bias to counter.
	const aiPick = (): Element => {
		if (log.length === 0) {
			return ELEMENTS[Math.floor(Math.random() * 7)];
		}
		const counts = new Array(7).fill(0);
		for (const r of log) counts[ELEMENTS.indexOf(r.player)]++;
		const noise = Math.random();
		let predicted = 0;
		if (noise < 0.6) {
			let best = -1;
			for (let i = 0; i < 7; i++) if (counts[i] > best) { best = counts[i]; predicted = i; }
		} else {
			predicted = Math.floor(Math.random() * 7);
		}
		const choices: number[] = [];
		for (let i = 0; i < 7; i++) {
			if (beats(i, predicted) === "a") choices.push(i);
		}
		const pick = choices[Math.floor(Math.random() * choices.length)];
		return ELEMENTS[pick];
	};

	const playRound = (p: Element) => {
		if (over) return;
		const ai = aiPick();
		const pi = ELEMENTS.indexOf(p);
		const ai_i = ELEMENTS.indexOf(ai);
		const outcome = beats(pi, ai_i);
		const last = log[log.length - 1];
		const cascade = last && last.outcome === outcome && outcome !== "tie" ? 2 : 1;
		const r: RoundLog = { player: p, ai, outcome, cascade };
		const newLog = [...log, r];
		setLog(newLog);
		let pw = playerWins;
		let aw = aiWins;
		if (outcome === "a") pw += cascade;
		else if (outcome === "b") aw += cascade;
		setPlayerWins(pw);
		setAiWins(aw);
		if (pw >= 5 || aw >= 5 || newLog.length >= 9) {
			setOver(true);
		}
	};

	const reset = () => {
		setPlayerWins(0);
		setAiWins(0);
		setLog([]);
		setOver(false);
	};

	return (
		<div
			style={{
				fontFamily: "Georgia, serif",
				color: "#eee",
				background: "linear-gradient(135deg,#0a0518,#1a0830)",
				padding: 16,
				minHeight: 600,
			}}
		>
			<h2 style={{ margin: 0 }}>90. Mage Duel</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
				Best of 9. Pick an element; the AI picks at the same time. Each element
				beats the next three in the wheel. Cascades double points.
			</div>
			<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
				<div
					style={{
						background: "#1a0830",
						padding: 12,
						borderRadius: 6,
						minWidth: 220,
					}}
				>
					<div>
						You: <strong>{playerWins}</strong>
					</div>
					<div>
						Adversary: <strong>{aiWins}</strong>
					</div>
					<div>Rounds: {log.length}/9</div>
					{over && (
						<div style={{ marginTop: 8, fontSize: 18 }}>
							{playerWins > aiWins
								? "Victory."
								: playerWins < aiWins
									? "Defeat."
									: "Draw."}
						</div>
					)}
					<button
						type="button"
						onClick={reset}
						style={{ ...btn, marginTop: 8 }}
					>
						Reset duel
					</button>
				</div>
				<div style={{ flex: 1, minWidth: 320 }}>
					<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
						{ELEMENTS.map((e) => (
							<button
								key={e}
								type="button"
								disabled={over}
								onClick={() => playRound(e)}
								style={{
									...btn,
									background: elementColor(e),
									color: "#111",
									minWidth: 80,
									fontSize: 16,
								}}
							>
								{e}
							</button>
						))}
					</div>
					<div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
						Wheel order: Fire → Water → Earth → Air → Lightning → Ice → Void →
						Fire. Each beats the next three.
					</div>
					<div style={{ marginTop: 12 }}>
						<div style={{ fontSize: 13, marginBottom: 4 }}>Combat log</div>
						<div
							style={{
								background: "#0e0420",
								border: "1px solid #553060",
								padding: 8,
								maxHeight: 240,
								overflow: "auto",
								fontSize: 13,
							}}
						>
							{log.length === 0 && (
								<div style={{ opacity: 0.6 }}>No rounds yet.</div>
							)}
							{log.map((r, i) => (
								<div key={i} style={{ marginBottom: 4 }}>
									#{i + 1}:{" "}
									<span style={{ color: elementColor(r.player) }}>
										{r.player}
									</span>{" "}
									vs{" "}
									<span style={{ color: elementColor(r.ai) }}>{r.ai}</span> —{" "}
									{r.outcome === "tie"
										? "Tie"
										: r.outcome === "a"
											? `You win${r.cascade > 1 ? ` ×${r.cascade} cascade!` : ""}`
											: `You lose${r.cascade > 1 ? ` ×${r.cascade} cascade!` : ""}`}
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			<AsyncPvpPanel />
		</div>
	);
}

type Tab = "challenge" | "answer" | "history";

function AsyncPvpPanel() {
	const [author] = useState(getAuthorId);
	const [tab, setTab] = useState<Tab>("challenge");

	return (
		<div
			style={{
				marginTop: 20,
				background: "#150626",
				border: "1px solid #553060",
				borderRadius: 6,
				padding: 12,
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "baseline",
					gap: 12,
					flexWrap: "wrap",
				}}
			>
				<div style={{ fontSize: 16, fontWeight: "bold" }}>Async PvP</div>
				<div style={{ fontSize: 11, opacity: 0.7 }}>
					You: <span style={{ fontFamily: "monospace" }}>{author}</span>
				</div>
			</div>
			<div style={{ marginTop: 8, display: "flex", gap: 6 }}>
				{(["challenge", "answer", "history"] as Tab[]).map((t) => (
					<button
						key={t}
						type="button"
						onClick={() => setTab(t)}
						style={{
							...btn,
							background: tab === t ? "#885090" : "#3a1a4a",
							fontSize: 13,
						}}
					>
						{t === "challenge"
							? "Challenge"
							: t === "answer"
								? "Answer"
								: "History"}
					</button>
				))}
			</div>
			<div style={{ marginTop: 12 }}>
				{tab === "challenge" && <ChallengeTab author={author} />}
				{tab === "answer" && <AnswerTab author={author} />}
				{tab === "history" && <HistoryTab author={author} />}
			</div>
		</div>
	);
}

function SeqPicker({
	seq,
	setSeq,
	rounds,
	disabled,
}: {
	seq: number[];
	setSeq: (s: number[]) => void;
	rounds: number;
	disabled?: boolean;
}) {
	const append = (i: number) => {
		if (disabled) return;
		if (seq.length >= rounds) return;
		setSeq([...seq, i]);
	};
	const undo = () => {
		if (disabled) return;
		setSeq(seq.slice(0, -1));
	};
	return (
		<div>
			<div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
				{ELEMENTS.map((e, i) => (
					<button
						key={e}
						type="button"
						disabled={disabled || seq.length >= rounds}
						onClick={() => append(i)}
						style={{
							...btn,
							background: elementColor(e),
							color: "#111",
							fontSize: 13,
							minWidth: 64,
						}}
					>
						{e}
					</button>
				))}
			</div>
			<div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
				<div style={{ fontSize: 12, opacity: 0.8 }}>
					Sequence ({seq.length}/{rounds}):
				</div>
				<div style={{ display: "flex", gap: 4 }}>
					{seq.map((s, i) => (
						<span
							key={i}
							style={{
								padding: "2px 6px",
								background: elementColor(ELEMENTS[s]),
								color: "#111",
								borderRadius: 3,
								fontSize: 12,
							}}
						>
							{ELEMENTS[s]}
						</span>
					))}
				</div>
				<button
					type="button"
					onClick={undo}
					disabled={disabled || seq.length === 0}
					style={{ ...btn, fontSize: 12, padding: "4px 8px" }}
				>
					Undo
				</button>
			</div>
		</div>
	);
}

function ChallengeTab({ author }: { author: string }) {
	const [seq, setSeq] = useState<number[]>([]);
	const [status, setStatus] = useState<string>("");
	const [posting, setPosting] = useState(false);

	const post = async () => {
		if (seq.length !== SEALED_ROUNDS) return;
		setPosting(true);
		setStatus("Sealing…");
		try {
			const res = await fetch("/api/mage-duel/matches", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					action: "create",
					author,
					challenger_seq: seq,
				}),
			});
			const data = (await res.json()) as { match?: { id: number }; error?: string };
			if (!res.ok || data.error) {
				setStatus(`Error: ${data.error ?? res.statusText}`);
			} else {
				setStatus(`Challenge #${data.match?.id ?? "?"} posted.`);
				setSeq([]);
			}
		} catch (err) {
			setStatus(`Network error: ${err instanceof Error ? err.message : "?"}`);
		} finally {
			setPosting(false);
		}
	};

	return (
		<div>
			<div style={{ fontSize: 13, marginBottom: 8 }}>
				Sealed sequence of {SEALED_ROUNDS} spells. The opponent will not see it
				until they answer.
			</div>
			<SeqPicker seq={seq} setSeq={setSeq} rounds={SEALED_ROUNDS} disabled={posting} />
			<div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
				<button
					type="button"
					onClick={post}
					disabled={posting || seq.length !== SEALED_ROUNDS}
					style={{ ...btn }}
				>
					Post sealed challenge
				</button>
				<div style={{ fontSize: 12, opacity: 0.8 }}>{status}</div>
			</div>
		</div>
	);
}

function parseSeq(s: number[] | string | null | undefined): number[] | null {
	if (!s) return null;
	if (Array.isArray(s)) return s;
	try {
		const v = JSON.parse(s);
		return Array.isArray(v) ? v : null;
	} catch {
		return null;
	}
}

function AnswerTab({ author }: { author: string }) {
	const [matches, setMatches] = useState<PvpMatch[]>([]);
	const [loading, setLoading] = useState(false);
	const [selected, setSelected] = useState<PvpMatch | null>(null);
	const [seq, setSeq] = useState<number[]>([]);
	const [status, setStatus] = useState<string>("");
	const [resolved, setResolved] = useState<PvpMatch | null>(null);
	const [posting, setPosting] = useState(false);

	const load = async () => {
		setLoading(true);
		setStatus("");
		try {
			const res = await fetch("/api/mage-duel/matches", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "open", author }),
			});
			const data = (await res.json()) as { matches?: PvpMatch[]; error?: string };
			if (!res.ok || data.error) {
				setStatus(`Error: ${data.error ?? res.statusText}`);
			} else {
				setMatches(data.matches ?? []);
			}
		} catch (err) {
			setStatus(`Network error: ${err instanceof Error ? err.message : "?"}`);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const choose = (m: PvpMatch) => {
		setSelected(m);
		setSeq([]);
		setResolved(null);
		setStatus("");
	};

	const submit = async () => {
		if (!selected) return;
		const rounds = selected.rounds ?? SEALED_ROUNDS;
		if (seq.length !== rounds) return;
		setPosting(true);
		setStatus("Resolving…");
		try {
			const res = await fetch("/api/mage-duel/matches", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					action: "play",
					author,
					match_id: selected.id,
					defender_seq: seq,
				}),
			});
			const data = (await res.json()) as { match?: PvpMatch; error?: string };
			if (!res.ok || data.error || !data.match) {
				setStatus(`Error: ${data.error ?? res.statusText}`);
			} else {
				setResolved(data.match);
				setStatus("");
				// remove from open list
				setMatches((prev) => prev.filter((m) => m.id !== selected.id));
			}
		} catch (err) {
			setStatus(`Network error: ${err instanceof Error ? err.message : "?"}`);
		} finally {
			setPosting(false);
		}
	};

	if (resolved) {
		const cs = parseSeq(resolved.challenger_seq) ?? [];
		const ds = parseSeq(resolved.defender_seq) ?? [];
		const rounds = Math.min(cs.length, ds.length);
		const verdict =
			resolved.result === "draw"
				? "Draw."
				: resolved.result === "defender_win"
					? "You win."
					: "You lose.";
		return (
			<div>
				<div style={{ fontSize: 15, marginBottom: 8 }}>{verdict}</div>
				<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
					Match #{resolved.id} vs {resolved.challenger}
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
					{Array.from({ length: rounds }).map((_, i) => {
						const c = cs[i];
						const d = ds[i];
						const o = beats(c, d);
						return (
							<div key={i} style={{ fontSize: 13 }}>
								#{i + 1}:{" "}
								<span style={{ color: elementColor(ELEMENTS[c]) }}>
									{ELEMENTS[c]}
								</span>{" "}
								vs{" "}
								<span style={{ color: elementColor(ELEMENTS[d]) }}>
									{ELEMENTS[d]}
								</span>{" "}
								—{" "}
								{o === "tie"
									? "Tie"
									: o === "a"
										? "Challenger"
										: "Defender"}
							</div>
						);
					})}
				</div>
				<button
					type="button"
					onClick={() => {
						setResolved(null);
						setSelected(null);
						setSeq([]);
					}}
					style={{ ...btn, marginTop: 10 }}
				>
					Back to open matches
				</button>
			</div>
		);
	}

	if (selected) {
		const rounds = selected.rounds ?? SEALED_ROUNDS;
		return (
			<div>
				<div style={{ fontSize: 13, marginBottom: 8 }}>
					Answering challenge #{selected.id} from{" "}
					<span style={{ fontFamily: "monospace" }}>{selected.challenger}</span>{" "}
					({rounds} sealed rounds). Pick your counter sequence.
				</div>
				<SeqPicker seq={seq} setSeq={setSeq} rounds={rounds} disabled={posting} />
				<div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
					<button
						type="button"
						onClick={submit}
						disabled={posting || seq.length !== rounds}
						style={{ ...btn }}
					>
						Cast counter-sequence
					</button>
					<button
						type="button"
						onClick={() => {
							setSelected(null);
							setSeq([]);
						}}
						disabled={posting}
						style={{ ...btn, background: "#3a1a4a" }}
					>
						Cancel
					</button>
					<div style={{ fontSize: 12, opacity: 0.8 }}>{status}</div>
				</div>
			</div>
		);
	}

	return (
		<div>
			<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
				<button type="button" onClick={load} disabled={loading} style={{ ...btn }}>
					{loading ? "Loading…" : "Refresh"}
				</button>
				<div style={{ fontSize: 12, opacity: 0.8 }}>{status}</div>
			</div>
			<div style={{ marginTop: 8 }}>
				{matches.length === 0 && (
					<div style={{ opacity: 0.6, fontSize: 13 }}>
						No open challenges. Be the first.
					</div>
				)}
				{matches.map((m) => (
					<div
						key={m.id}
						style={{
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
							padding: "6px 0",
							borderBottom: "1px solid #3a1a4a",
							fontSize: 13,
						}}
					>
						<div>
							<div>
								#{m.id} from{" "}
								<span style={{ fontFamily: "monospace" }}>{m.challenger}</span>
							</div>
							<div style={{ fontSize: 11, opacity: 0.6 }}>
								{m.rounds ?? SEALED_ROUNDS} rounds ·{" "}
								{new Date(m.created_at).toLocaleString()}
							</div>
						</div>
						<button type="button" onClick={() => choose(m)} style={{ ...btn }}>
							Answer
						</button>
					</div>
				))}
			</div>
		</div>
	);
}

function HistoryTab({ author }: { author: string }) {
	const [matches, setMatches] = useState<PvpMatch[]>([]);
	const [loading, setLoading] = useState(false);
	const [status, setStatus] = useState<string>("");

	const load = async () => {
		setLoading(true);
		setStatus("");
		try {
			const res = await fetch("/api/mage-duel/matches", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "history", author }),
			});
			const data = (await res.json()) as { matches?: PvpMatch[]; error?: string };
			if (!res.ok || data.error) {
				setStatus(`Error: ${data.error ?? res.statusText}`);
			} else {
				setMatches(data.matches ?? []);
			}
		} catch (err) {
			setStatus(`Network error: ${err instanceof Error ? err.message : "?"}`);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const verdictFor = (m: PvpMatch): string => {
		if (m.result === null || m.resolved_at === null) return "Pending";
		const isChallenger = m.challenger === author;
		if (m.result === "draw") return "Draw";
		const youWon =
			(m.result === "challenger_win" && isChallenger) ||
			(m.result === "defender_win" && !isChallenger);
		return youWon ? "Win" : "Loss";
	};

	return (
		<div>
			<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
				<button type="button" onClick={load} disabled={loading} style={{ ...btn }}>
					{loading ? "Loading…" : "Refresh"}
				</button>
				<div style={{ fontSize: 12, opacity: 0.8 }}>{status}</div>
			</div>
			<div style={{ marginTop: 8 }}>
				{matches.length === 0 && (
					<div style={{ opacity: 0.6, fontSize: 13 }}>No matches yet.</div>
				)}
				{matches.map((m) => {
					const cs = parseSeq(m.challenger_seq);
					const ds = parseSeq(m.defender_seq);
					return (
						<div
							key={m.id}
							style={{
								padding: "6px 0",
								borderBottom: "1px solid #3a1a4a",
								fontSize: 13,
							}}
						>
							<div>
								#{m.id} — {verdictFor(m)} — {m.challenger === author ? "as challenger" : "as defender"}
							</div>
							<div style={{ fontSize: 11, opacity: 0.7 }}>
								vs{" "}
								{m.challenger === author
									? (m.defender ?? "—")
									: m.challenger}{" "}
								·{" "}
								{m.resolved_at
									? new Date(m.resolved_at).toLocaleString()
									: `created ${new Date(m.created_at).toLocaleString()}`}
							</div>
							{(cs || ds) && (
								<div style={{ marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
									{cs && (
										<div style={{ fontSize: 11 }}>
											C:{" "}
											{cs.map((i, k) => (
												<span
													key={k}
													style={{
														padding: "1px 4px",
														background: elementColor(ELEMENTS[i]),
														color: "#111",
														borderRadius: 2,
														marginRight: 2,
													}}
												>
													{ELEMENTS[i][0]}
												</span>
											))}
										</div>
									)}
									{ds && (
										<div style={{ fontSize: 11 }}>
											D:{" "}
											{ds.map((i, k) => (
												<span
													key={k}
													style={{
														padding: "1px 4px",
														background: elementColor(ELEMENTS[i]),
														color: "#111",
														borderRadius: 2,
														marginRight: 2,
													}}
												>
													{ELEMENTS[i][0]}
												</span>
											))}
										</div>
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "8px 14px",
	background: "#553060",
	color: "#fff",
	border: "1px solid #885090",
	borderRadius: 4,
	cursor: "pointer",
	fontFamily: "Georgia, serif",
};
