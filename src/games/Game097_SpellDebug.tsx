import { useMemo, useState } from "react";

// Glyphs are operations on a "creature" state {hp, location, form}
// You're given a buggy spell and a target effect. Edit (swap/remove/add) glyphs to fix.

type Glyph = { sym: string; name: string };
const PALETTE: Glyph[] = [
	{ sym: "◐", name: "shift" },
	{ sym: "☼", name: "amplify" },
	{ sym: "☾", name: "soften" },
	{ sym: "✦", name: "bind" },
	{ sym: "⟁", name: "transmute" },
	{ sym: "⌬", name: "seal" },
];

// Simple semantics:
// state has location ('here'/'there'), form ('frog'/'prince'), integrity (0..10)
// Each glyph modifies:
//   shift   : location flips
//   amplify : integrity +3
//   soften  : integrity -1
//   bind    : seals state; future glyphs no-op unless 'transmute' breaks the bind
//   transmute: form flips, breaks bind
//   seal   : finalize; nothing after this runs

type State = {
	loc: "here" | "there";
	form: "frog" | "prince";
	integ: number;
	bound: boolean;
	sealed: boolean;
};

function run(spell: string[]): State {
	const s: State = {
		loc: "here",
		form: "frog",
		integ: 5,
		bound: false,
		sealed: false,
	};
	for (const sym of spell) {
		if (s.sealed) break;
		if (s.bound && sym !== "⟁") continue;
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
	}
	return s;
}

type Puzzle = {
	name: string;
	goal: string;
	broken: string[];
	check: (s: State) => boolean;
};
const PUZZLES: Puzzle[] = [
	{
		name: "Teleport",
		goal: "Move the prince *there* with integrity ≥ 7.",
		broken: ["◐", "☾", "☾", "☾", "⟁"],
		check: (s) =>
			s.loc === "there" && s.form === "prince" && s.integ >= 7 && !s.sealed,
	},
	{
		name: "Stabilize",
		goal: "Seal a bound prince in place (here) at exactly integrity 5.",
		broken: ["⟁", "☼", "✦", "☼", "⌬"],
		check: (s) =>
			s.loc === "here" &&
			s.form === "prince" &&
			s.bound &&
			s.sealed &&
			s.integ === 5,
	},
];

export default function Game097_SpellDebug() {
	const [idx, setIdx] = useState(0);
	const p = PUZZLES[idx];
	const [spell, setSpell] = useState(p.broken.slice());
	const result = useMemo(() => run(spell), [spell]);
	const passes = p.check(result);

	function removeAt(i: number) {
		setSpell(spell.filter((_, j) => j !== i));
	}
	function setAt(i: number, sym: string) {
		const s = spell.slice();
		s[i] = sym;
		setSpell(s);
	}
	function insertAfter(i: number, sym: string) {
		const s = spell.slice();
		s.splice(i + 1, 0, sym);
		setSpell(s);
	}
	function reset() {
		setSpell(p.broken.slice());
	}
	function nextLevel() {
		const n = (idx + 1) % PUZZLES.length;
		setIdx(n);
		setSpell(PUZZLES[n].broken.slice());
	}

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
				Each glyph mutates the spell-state. Edit until the goal is met.
			</p>

			<div style={{ marginBottom: 8 }}>
				<strong>
					Spell {idx + 1}: {p.name}
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
					{spell.map((sym, i) => (
						<div
							key={i}
							style={{
								background: "#2a1f55",
								border: "1px solid #5e4abf",
								borderRadius: 6,
								padding: 6,
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
									title="insert after"
									onClick={() => insertAfter(i, "◐")}
									style={btn}
								>
									+
								</button>
							</div>
						</div>
					))}
					{spell.length === 0 && (
						<button onClick={() => setSpell(["◐"])} style={btn}>
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
					{passes ? "✓ Goal achieved!" : "✗ Goal not met"}
				</div>
			</div>

			<div style={{ marginTop: 10 }}>
				<button onClick={reset}>Reset spell</button>
				<button
					onClick={nextLevel}
					disabled={!passes}
					style={{ marginLeft: 8 }}
				>
					Next puzzle
				</button>
			</div>

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
