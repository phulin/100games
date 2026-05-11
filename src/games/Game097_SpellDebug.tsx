import { useEffect, useMemo, useRef, useState } from "react";

// Glyphs are operations on a creature state {loc, form, integrity, bound, sealed}
// You're given a buggy spell and a target effect. Edit (swap/remove/add/reorder) glyphs.

type Glyph = { sym: string; name: string };
const PALETTE: Glyph[] = [
	{ sym: "◐", name: "shift" },
	{ sym: "☼", name: "amplify" },
	{ sym: "☾", name: "soften" },
	{ sym: "✦", name: "bind" },
	{ sym: "⟁", name: "transmute" },
	{ sym: "⌬", name: "seal" },
];

type State = {
	loc: "here" | "there";
	form: "frog" | "prince";
	integ: number;
	bound: boolean;
	sealed: boolean;
};

function run(spell: string[]): { state: State; trace: State[] } {
	const s: State = {
		loc: "here",
		form: "frog",
		integ: 5,
		bound: false,
		sealed: false,
	};
	const trace: State[] = [{ ...s }];
	for (const sym of spell) {
		if (s.sealed) {
			trace.push({ ...s });
			continue;
		}
		if (s.bound && sym !== "⟁") {
			trace.push({ ...s });
			continue;
		}
		switch (sym) {
			case "◐":
				s.loc = s.loc === "here" ? "there" : "here";
				break;
			case "☼":
				s.integ += 3;
				break;
			case "☾":
				s.integ -= 1;
				break;
			case "✦":
				s.bound = true;
				break;
			case "⟁":
				s.form = s.form === "frog" ? "prince" : "frog";
				s.bound = false;
				break;
			case "⌬":
				s.sealed = true;
				break;
		}
		trace.push({ ...s });
	}
	return { state: s, trace };
}

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

type Puzzle = {
	name: string;
	goal: string;
	broken: string[];
	solution: string[];
	check: (s: State) => boolean;
};

function genPuzzle(seed: number, idx: number): Puzzle {
	const rng = mulberry32(seed + idx * 7919);
	const r = (n: number) => Math.floor(rng() * n);
	const len = 4 + r(3);
	const syms = ["◐", "☼", "☾", "✦", "⟁", "⌬"];
	const solution: string[] = [];
	let sealed = false;
	for (let i = 0; i < len; i++) {
		if (sealed) break;
		let pick: string;
		const allowSeal = i >= len - 2;
		do {
			pick = syms[r(syms.length)];
		} while (pick === "⌬" && !allowSeal);
		solution.push(pick);
		if (pick === "⌬") sealed = true;
	}

	const final = run(solution).state;

	const parts: string[] = [];
	parts.push(`form=${final.form}`);
	parts.push(`loc=${final.loc}`);
	parts.push(`integrity=${final.integ}`);
	if (final.bound) parts.push("bound");
	if (final.sealed) parts.push("sealed");
	const goal = "Reach: " + parts.join(", ") + ".";

	const broken = solution.slice();
	const mutations = 2 + r(2);
	for (let i = 0; i < mutations; i++) {
		const op = r(3);
		const idx2 = r(Math.max(1, broken.length));
		if (op === 0 && broken.length > 1) broken.splice(idx2, 1);
		else if (op === 1 && broken.length < 8)
			broken.splice(idx2, 0, syms[r(syms.length)]);
		else broken[idx2] = syms[r(syms.length)];
	}

	return {
		name: `Glyph #${idx + 1}`,
		goal,
		broken,
		solution,
		check: (s) =>
			s.loc === final.loc &&
			s.form === final.form &&
			s.integ === final.integ &&
			s.bound === final.bound &&
			s.sealed === final.sealed,
	};
}

function playTone(
	ref: React.MutableRefObject<AudioContext | null>,
	freq: number,
	dur = 0.16,
	type: OscillatorType = "sine",
) {
	try {
		if (!ref.current) ref.current = new AudioContext();
		const ctx = ref.current;
		const o = ctx.createOscillator();
		const g = ctx.createGain();
		o.type = type;
		o.frequency.value = freq;
		g.gain.value = 0.0001;
		g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
		o.connect(g).connect(ctx.destination);
		o.start();
		o.stop(ctx.currentTime + dur + 0.02);
	} catch {
		/* ignore */
	}
}

const GLYPH_FREQ: Record<string, number> = {
	"◐": 392,
	"☼": 523,
	"☾": 330,
	"✦": 466,
	"⟁": 587,
	"⌬": 277,
};

export default function Game097_SpellDebug() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const puzzles = useMemo<Puzzle[]>(
		() => Array.from({ length: 5 }, (_, i) => genPuzzle(seed, i)),
		[seed],
	);

	const [idx, setIdx] = useState(0);
	const p = puzzles[idx];
	const [spell, setSpell] = useState<string[]>(p.broken.slice());
	const [past, setPast] = useState<string[][]>([]);
	const [reveal, setReveal] = useState(false);
	const audio = useRef<AudioContext | null>(null);

	useEffect(() => {
		setSpell(puzzles[idx].broken.slice());
		setPast([]);
		setReveal(false);
	}, [idx, puzzles]);

	const { state: result, trace } = useMemo(() => run(spell), [spell]);
	const passes = p.check(result);

	function commit(next: string[]) {
		setPast((h) => [...h.slice(-50), spell]);
		setSpell(next);
	}
	function removeAt(i: number) {
		commit(spell.filter((_, j) => j !== i));
	}
	function setAt(i: number, sym: string) {
		const s = spell.slice();
		s[i] = sym;
		commit(s);
		playTone(audio, GLYPH_FREQ[sym] ?? 440);
	}
	function insertAfter(i: number, sym: string) {
		const s = spell.slice();
		s.splice(i + 1, 0, sym);
		commit(s);
	}
	function moveLeft(i: number) {
		if (i === 0) return;
		const s = spell.slice();
		[s[i - 1], s[i]] = [s[i], s[i - 1]];
		commit(s);
	}
	function moveRight(i: number) {
		if (i >= spell.length - 1) return;
		const s = spell.slice();
		[s[i], s[i + 1]] = [s[i + 1], s[i]];
		commit(s);
	}
	function undo() {
		setPast((h) => {
			if (h.length === 0) return h;
			const prev = h[h.length - 1];
			setSpell(prev);
			return h.slice(0, -1);
		});
	}
	function reset() {
		commit(p.broken.slice());
	}
	function nextLevel() {
		setIdx((i) => (i + 1) % puzzles.length);
	}
	function newSeed() {
		setSeed(Math.floor(Math.random() * 1e9));
		setIdx(0);
	}

	useEffect(() => {
		if (passes) {
			playTone(audio, 523, 0.18);
			setTimeout(() => playTone(audio, 784, 0.22), 110);
		}
	}, [passes]);

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "system-ui",
				background: "#0b0820",
				color: "#e0d6ff",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px" }}>Spell Debug</h2>
			<p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.7 }}>
				Each glyph mutates the spell-state. Edit until the goal is met. Seed:{" "}
				<code>{seed}</code>
			</p>

			<div style={{ marginBottom: 8 }}>
				<strong>
					Spell {idx + 1}/{puzzles.length}: {p.name}
				</strong>{" "}
				<span style={{ opacity: 0.7 }}>— {p.goal}</span>
			</div>

			<div
				style={{
					background: "#1a1335",
					padding: 14,
					borderRadius: 6,
					minHeight: 110,
				}}
			>
				<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
					{spell.map((sym, i) => {
						const st = trace[i + 1];
						const skipped = i > 0 && trace[i].sealed;
						const blocked = !skipped && trace[i].bound && sym !== "⟁";
						return (
							<div
								key={i}
								title={
									skipped
										? "skipped (after seal)"
										: blocked
											? "blocked (bound)"
											: `loc=${st.loc} form=${st.form} i=${st.integ}`
								}
								style={{
									background: skipped
										? "#1f1635"
										: blocked
											? "#3a1f2a"
											: "#2a1f55",
									border: "1px solid #5e4abf",
									borderRadius: 6,
									padding: 6,
									opacity: skipped ? 0.45 : blocked ? 0.6 : 1,
									fontSize: 28,
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
								}}
							>
								<span>{sym}</span>
								<div style={{ display: "flex", gap: 2, marginTop: 2 }}>
									<button title="remove" onClick={() => removeAt(i)} style={btn}>
										×
									</button>
									<button
										title="move left"
										onClick={() => moveLeft(i)}
										style={btn}
									>
										◀
									</button>
									<select
										value={sym}
										onChange={(e) => setAt(i, e.target.value)}
										style={{ fontSize: 12 }}
									>
										{PALETTE.map((g) => (
											<option key={g.sym} value={g.sym}>
												{g.sym} {g.name}
											</option>
										))}
									</select>
									<button
										title="move right"
										onClick={() => moveRight(i)}
										style={btn}
									>
										▶
									</button>
									<button
										title="insert after"
										onClick={() => insertAfter(i, "◐")}
										style={btn}
									>
										+
									</button>
								</div>
							</div>
						);
					})}
					{spell.length === 0 && (
						<button onClick={() => commit(["◐"])} style={btn}>
							+ glyph
						</button>
					)}
				</div>
			</div>

			<div
				style={{
					marginTop: 12,
					fontSize: 13,
					background: "#171232",
					padding: 10,
					borderRadius: 6,
				}}
			>
				<strong>Result:</strong> loc={result.loc}, form={result.form},
				integrity={result.integ},{result.bound ? " bound," : ""}
				{result.sealed ? " sealed" : " unsealed"}
				<div
					style={{
						marginTop: 6,
						color: passes ? "#8af0a3" : "#ff8b8b",
						fontWeight: 700,
					}}
				>
					{passes ? "Goal achieved!" : "Goal not met"}
				</div>
			</div>

			<div style={{ marginTop: 10 }}>
				<button onClick={reset}>Reset</button>
				<button onClick={undo} disabled={past.length === 0} style={mlbtn}>
					Undo
				</button>
				<button onClick={nextLevel} disabled={!passes} style={mlbtn}>
					Next puzzle
				</button>
				<button onClick={newSeed} style={mlbtn}>
					New seed
				</button>
				<button
					onClick={() => setReveal((v) => !v)}
					style={mlbtn}
					title="Show a known working solution"
				>
					{reveal ? "Hide" : "Reveal"} solution
				</button>
			</div>

			{reveal && (
				<div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
					Known solution:{" "}
					<span style={{ fontSize: 22 }}>{p.solution.join(" ")}</span>
				</div>
			)}

			<details style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>
				<summary>Glyph reference</summary>
				<ul>
					<li>◐ shift — flip location</li>
					<li>☼ amplify — integrity +3</li>
					<li>☾ soften — integrity -1</li>
					<li>✦ bind — seal future glyphs (only transmute escapes)</li>
					<li>⟁ transmute — flip form, breaks bind</li>
					<li>⌬ seal — stop spell here</li>
				</ul>
			</details>
		</div>
	);
}
const btn: React.CSSProperties = {
	fontSize: 11,
	padding: "2px 6px",
	cursor: "pointer",
};
const mlbtn: React.CSSProperties = { ...btn, marginLeft: 8 };
