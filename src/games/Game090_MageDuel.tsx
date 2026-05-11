import { useEffect, useState } from "react";

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

const DEFAULT_ROUNDS = 5;
const MIN_ROUNDS = 3;
const MAX_ROUNDS = 9;

// WebAudio helpers.
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
function blip(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.12) {
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
const ELEMENT_FREQ: Record<Element, number> = {
	Fire: 392, Water: 261, Earth: 196, Air: 587, Lightning: 880, Ice: 698, Void: 110,
};
function castSound(e: Element) { blip(ELEMENT_FREQ[e], 0.18, "triangle", 0.14); }
function winChord() {
	blip(523, 0.25, "sine", 0.18);
	setTimeout(() => blip(659, 0.25, "sine", 0.18), 110);
	setTimeout(() => blip(784, 0.35, "sine", 0.18), 240);
}
function loseChord() {
	blip(220, 0.4, "sawtooth", 0.18);
	setTimeout(() => blip(155, 0.5, "sawtooth", 0.16), 200);
}

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

type Difficulty = "novice" | "adept" | "archmage";

export default function Game090_MageDuel() {
	const [playerWins, setPlayerWins] = useState(0);
	const [aiWins, setAiWins] = useState(0);
	const [log, setLog] = useState<RoundLog[]>([]);
	const [over, setOver] = useState(false);
	const [difficulty, setDifficulty] = useState<Difficulty>("adept");
	const [hoverElement, setHoverElement] = useState<Element | null>(null);

	const aiPick = (): Element => {
		const noiseLevel = difficulty === "novice" ? 0.7 : difficulty === "adept" ? 0.4 : 0.1;
		const counterChance = difficulty === "novice" ? 0.55 : difficulty === "adept" ? 0.85 : 0.97;
		if (log.length === 0) return ELEMENTS[Math.floor(Math.random() * 7)];
		const counts = new Array(7).fill(0);
		for (let i = 0; i < log.length; i++) {
			const w = 1 + i * 0.4;
			counts[ELEMENTS.indexOf(log[i].player)] += w;
		}
		let predicted = 0;
		if (Math.random() < 1 - noiseLevel) {
			let best = -1;
			for (let i = 0; i < 7; i++) if (counts[i] > best) { best = counts[i]; predicted = i; }
		} else {
			predicted = Math.floor(Math.random() * 7);
		}
		if (Math.random() < counterChance) {
			const choices: number[] = [];
			for (let i = 0; i < 7; i++) if (beats(i, predicted) === "a") choices.push(i);
			return ELEMENTS[choices[Math.floor(Math.random() * choices.length)]];
		}
		return ELEMENTS[Math.floor(Math.random() * 7)];
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
		castSound(p);
		setTimeout(() => castSound(ai), 80);
		setTimeout(() => {
			if (outcome === "a") blip(660 * (cascade > 1 ? 1.5 : 1), 0.12, "triangle", 0.13);
			else if (outcome === "b") blip(220, 0.12, "sawtooth", 0.13);
		}, 220);
		if (pw >= 5 || aw >= 5 || newLog.length >= 9) {
			setOver(true);
			setTimeout(() => (pw > aw ? winChord() : pw < aw ? loseChord() : blip(330, 0.4, "sine", 0.14)), 360);
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
				Best of 9. Pick an element; the AI picks at the same time. Each element beats the next three in the wheel. Cascades double points. Hover an element to see what it beats.
			</div>
			<div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
				<div style={{ background: "#1a0830", padding: 12, borderRadius: 6, minWidth: 240 }}>
					<div>You: <strong>{playerWins}</strong></div>
					<div>Adversary: <strong>{aiWins}</strong></div>
					<div>Rounds: {log.length}/9</div>
					<div style={{ marginTop: 8, fontSize: 12 }}>
						<label>
							Adversary skill:&nbsp;
							<select
								value={difficulty}
								onChange={(e) => setDifficulty(e.target.value as Difficulty)}
								disabled={log.length > 0 && !over}
								style={{ fontSize: 12 }}
							>
								<option value="novice">Novice</option>
								<option value="adept">Adept</option>
								<option value="archmage">Archmage</option>
							</select>
						</label>
					</div>
					{over && (
						<div style={{ marginTop: 8, fontSize: 18 }}>
							{playerWins > aiWins ? "Victory." : playerWins < aiWins ? "Defeat." : "Draw."}
						</div>
					)}
					<button type="button" onClick={reset} style={{ ...btn, marginTop: 8 }}>Reset duel</button>
				</div>
				<div style={{ flex: 1, minWidth: 320 }}>
					<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
						{ELEMENTS.map((e, i) => {
							const beatsList = [1, 2, 3].map((d) => ELEMENTS[(i + d) % 7]);
							const losesList = [1, 2, 3].map((d) => ELEMENTS[(i + 7 - d) % 7]);
							return (
								<button
									key={e}
									type="button"
									disabled={over}
									onClick={() => playRound(e)}
									onMouseEnter={() => setHoverElement(e)}
									onMouseLeave={() => setHoverElement(null)}
									title={`${e} beats: ${beatsList.join(", ")} · loses to: ${losesList.join(", ")}`}
									style={{
										...btn,
										background: elementColor(e),
										color: "#111",
										minWidth: 80,
										fontSize: 16,
										outline: hoverElement === e ? "2px solid #fff" : "none",
									}}
								>
									{e}
								</button>
							);
						})}
					</div>
					{hoverElement && (() => {
						const i = ELEMENTS.indexOf(hoverElement);
						const beatsList = [1, 2, 3].map((d) => ELEMENTS[(i + d) % 7]);
						const losesList = [1, 2, 3].map((d) => ELEMENTS[(i + 7 - d) % 7]);
						return (
							<div style={{ marginTop: 8, fontSize: 12, background: "#0e0420", padding: 6, borderRadius: 4 }}>
								<strong style={{ color: elementColor(hoverElement) }}>{hoverElement}</strong>
								{" "}beats{" "}
								{beatsList.map((b) => (
									<span key={b} style={{ color: elementColor(b), marginRight: 4 }}>{b}</span>
								))}
								· loses to{" "}
								{losesList.map((b) => (
									<span key={b} style={{ color: elementColor(b), marginRight: 4 }}>{b}</span>
								))}
							</div>
						);
					})()}
					<div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
						Wheel order: Fire → Water → Earth → Air → Lightning → Ice → Void → Fire. Each beats the next three.
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
							{log.length === 0 && <div style={{ opacity: 0.6 }}>No rounds yet.</div>}
							{log.map((r, i) => (
								<div key={i} style={{ marginBottom: 4 }}>
									#{i + 1}:{" "}
									<span style={{ color: elementColor(r.player) }}>{r.player}</span>{" "}
									vs <span style={{ color: elementColor(r.ai) }}>{r.ai}</span> —{" "}
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
			<div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
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
						style={{ ...btn, background: tab === t ? "#885090" : "#3a1a4a", fontSize: 13 }}
					>
						{t === "challenge" ? "Challenge" : t === "answer" ? "Answer" : "History"}
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
		castSound(ELEMENTS[i]);
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
	const [rounds, setRounds] = useState<number>(DEFAULT_ROUNDS);
	const [status, setStatus] = useState<string>("");
	const [posting, setPosting] = useState(false);

	const setRoundsClamp = (n: number) => {
		const clamped = Math.max(MIN_ROUNDS, Math.min(MAX_ROUNDS, n));
		setRounds(clamped);
		if (seq.length > clamped) setSeq(seq.slice(0, clamped));
	};

	const post = async () => {
		if (seq.length !== rounds) return;
		setPosting(true);
		setStatus("Sealing…");
		try {
			const res = await fetch("/api/mage-duel/matches", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ action: "create", author, challenger_seq: seq }),
			});
			const data = (await res.json()) as { match?: { id: number }; error?: string };
			if (!res.ok || data.error) {
				setStatus(`Error: ${data.error ?? res.statusText}`);
			} else {
				setStatus(`Challenge #${data.match?.id ?? "?"} posted.`);
				setSeq([]);
				castSound("Void");
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
				Sealed sequence of {rounds} spells. The opponent will not see it until they answer.
			</div>
			<div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 12 }}>
				Rounds:
				<input
					type="range"
					min={MIN_ROUNDS}
					max={MAX_ROUNDS}
					value={rounds}
					onChange={(e) => setRoundsClamp(Number(e.target.value))}
					disabled={posting}
				/>
				<strong>{rounds}</strong>
			</div>
			<SeqPicker seq={seq} setSeq={setSeq} rounds={rounds} disabled={posting} />
			<div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
				<button
					type="button"
					onClick={post}
					disabled={posting || seq.length !== rounds}
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

function MatchPlayback({ match }: { match: PvpMatch }) {
	const cs = parseSeq(match.challenger_seq) ?? [];
	const ds = parseSeq(match.defender_seq) ?? [];
	const rounds = Math.min(cs.length, ds.length);
	const [step, setStep] = useState(0);

	useEffect(() => {
		setStep(0);
		if (rounds === 0) return;
		const id = setInterval(() => {
			setStep((s) => {
				if (s >= rounds) {
					clearInterval(id);
					return s;
				}
				const c = cs[s];
				const d = ds[s];
				castSound(ELEMENTS[c]);
				setTimeout(() => castSound(ELEMENTS[d]), 90);
				const o = beats(c, d);
				if (o === "a") setTimeout(() => blip(660, 0.12, "triangle", 0.12), 200);
				else if (o === "b") setTimeout(() => blip(220, 0.12, "sawtooth", 0.12), 200);
				return s + 1;
			});
		}, 700);
		return () => clearInterval(id);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [match.id]);

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
			{Array.from({ length: rounds }).map((_, i) => {
				const c = cs[i];
				const d = ds[i];
				const o = beats(c, d);
				const revealed = i < step;
				return (
					<div key={i} style={{ fontSize: 13, opacity: revealed ? 1 : 0.25, transition: "opacity 0.2s" }}>
						#{i + 1}:{" "}
						<span style={{ color: elementColor(ELEMENTS[c]) }}>{ELEMENTS[c]}</span>{" "}
						vs <span style={{ color: elementColor(ELEMENTS[d]) }}>{ELEMENTS[d]}</span> —{" "}
						{o === "tie" ? "Tie" : o === "a" ? "Challenger" : "Defender"}
					</div>
				);
			})}
		</div>
	);
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
			if (!res.ok || data.error) setStatus(`Error: ${data.error ?? res.statusText}`);
			else setMatches(data.matches ?? []);
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
		const rounds = selected.rounds ?? DEFAULT_ROUNDS;
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
				if (data.match.result === "defender_win") setTimeout(winChord, 100);
				else if (data.match.result === "challenger_win") setTimeout(loseChord, 100);
				setMatches((prev) => prev.filter((m) => m.id !== selected.id));
			}
		} catch (err) {
			setStatus(`Network error: ${err instanceof Error ? err.message : "?"}`);
		} finally {
			setPosting(false);
		}
	};

	if (resolved) {
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
				<MatchPlayback match={resolved} />
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
		const rounds = selected.rounds ?? DEFAULT_ROUNDS;
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
						onClick={() => { setSelected(null); setSeq([]); }}
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
					<div style={{ opacity: 0.6, fontSize: 13 }}>No open challenges. Be the first.</div>
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
								{m.rounds ?? DEFAULT_ROUNDS} rounds ·{" "}
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
	const [expanded, setExpanded] = useState<number | null>(null);

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
			if (!res.ok || data.error) setStatus(`Error: ${data.error ?? res.statusText}`);
			else setMatches(data.matches ?? []);
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
					const canReplay = m.resolved_at !== null && cs && ds;
					return (
						<div
							key={m.id}
							style={{
								padding: "6px 0",
								borderBottom: "1px solid #3a1a4a",
								fontSize: 13,
							}}
						>
							<div style={{ display: "flex", gap: 6, alignItems: "center" }}>
								<div style={{ flex: 1 }}>
									#{m.id} — {verdictFor(m)} —{" "}
									{m.challenger === author ? "as challenger" : "as defender"}
								</div>
								{canReplay && (
									<button
										type="button"
										onClick={() => setExpanded(expanded === m.id ? null : m.id)}
										style={{ ...btn, fontSize: 11, padding: "2px 6px" }}
									>
										{expanded === m.id ? "Hide" : "Replay"}
									</button>
								)}
							</div>
							<div style={{ fontSize: 11, opacity: 0.7 }}>
								vs{" "}
								{m.challenger === author ? (m.defender ?? "—") : m.challenger}{" "}
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
							{expanded === m.id && canReplay && (
								<div style={{ marginTop: 6, padding: 6, background: "#0e0420", borderRadius: 4 }}>
									<MatchPlayback match={m} />
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
