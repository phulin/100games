import { useMemo, useState } from "react";

// Simple pseudo-language. We "run" by treating the code as a mini DSL:
//   set X N        -> X = N
//   add X N        -> X += N
//   add X Y        -> X += Y
//   mul X N        -> X *= N
//   print X        -> output value
// Tests check final outputs sequence.

type Level = {
	title: string;
	hint: string;
	start: string;
	expected: number[];
	parScore: number;
};

const LEVELS: Level[] = [
	{
		title: "Inline",
		hint: "Some intermediate values are only used once. Inline them.",
		start: ["set a 2", "set b 3", "set c a", "add c b", "print c"].join("\n"),
		expected: [5],
		parScore: 3,
	},
	{
		title: "Dedupe",
		hint: "Repeated identical statements waste characters.",
		start: [
			"set a 1",
			"add a 1",
			"add a 1",
			"add a 1",
			"add a 1",
			"print a",
		].join("\n"),
		expected: [5],
		parScore: 2,
	},
	{
		title: "Extract",
		hint: "Reuse a computed value rather than re-doing it.",
		start: [
			"set a 4",
			"mul a 2",
			"print a",
			"set b 4",
			"mul b 2",
			"print b",
		].join("\n"),
		expected: [8, 8],
		parScore: 4,
	},
];

function runCode(src: string): { output: number[]; error: string | null } {
	const env: Record<string, number> = {};
	const output: number[] = [];
	const lines = src
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	for (const ln of lines) {
		const parts = ln.split(/\s+/);
		const [op, x, y] = parts;
		const ynum =
			y === undefined ? NaN : Number.isNaN(Number(y)) ? env[y] : Number(y);
		if (op === "set") {
			if (Number.isNaN(ynum)) return { output, error: `bad: ${ln}` };
			env[x] = ynum;
		} else if (op === "add") {
			if (Number.isNaN(ynum) || !(x in env))
				return { output, error: `bad: ${ln}` };
			env[x] += ynum;
		} else if (op === "mul") {
			if (Number.isNaN(ynum) || !(x in env))
				return { output, error: `bad: ${ln}` };
			env[x] *= ynum;
		} else if (op === "print") {
			if (!(x in env)) return { output, error: `unset: ${x}` };
			output.push(env[x]);
		} else {
			return { output, error: `unknown op: ${op}` };
		}
	}
	return { output, error: null };
}

function arrEq(a: number[], b: number[]): boolean {
	return a.length === b.length && a.every((v, i) => v === b[i]);
}

export default function Game096_Refactor() {
	const [levelIdx, setLevelIdx] = useState(0);
	const level = LEVELS[levelIdx];
	const [code, setCode] = useState(level.start);

	const { output, error } = useMemo(() => runCode(code), [code]);
	const passes = !error && arrEq(output, level.expected);
	const lineCount = code.split("\n").filter((l) => l.trim()).length;

	function next() {
		if (levelIdx < LEVELS.length - 1) {
			const ni = levelIdx + 1;
			setLevelIdx(ni);
			setCode(LEVELS[ni].start);
		}
	}
	function reset() {
		setCode(level.start);
	}

	return (
		<div
			style={{
				padding: 20,
				fontFamily: "ui-monospace, monospace",
				background: "#fdfbef",
				color: "#222",
				minHeight: 580,
			}}
		>
			<h2 style={{ margin: "0 0 4px", fontFamily: "system-ui" }}>Refactor</h2>
			<p
				style={{
					margin: "0 0 12px",
					fontSize: 13,
					opacity: 0.7,
					fontFamily: "system-ui",
				}}
			>
				Shrink the program. Tests must still pass. Aim for par.
			</p>

			<div style={{ marginBottom: 8, fontFamily: "system-ui" }}>
				<strong>
					Level {levelIdx + 1}: {level.title}
				</strong>{" "}
				<span style={{ opacity: 0.7 }}>— {level.hint}</span>
			</div>

			<div style={{ display: "flex", gap: 16 }}>
				<textarea
					value={code}
					onChange={(e) => setCode(e.target.value)}
					spellCheck={false}
					style={{
						flex: 1,
						height: 280,
						fontFamily: "inherit",
						fontSize: 14,
						padding: 8,
						border: "1px solid #aaa",
						borderRadius: 4,
					}}
				/>
				<div style={{ width: 240, fontFamily: "system-ui", fontSize: 13 }}>
					<div>
						<strong>Expected output:</strong>
					</div>
					<pre style={{ background: "#eef", padding: 8, borderRadius: 4 }}>
						{level.expected.join("\n")}
					</pre>
					<div>
						<strong>Your output:</strong>
					</div>
					<pre
						style={{
							background: passes ? "#dfd" : "#fdd",
							padding: 8,
							borderRadius: 4,
						}}
					>
						{error ? `error: ${error}` : output.join("\n") || "(none)"}
					</pre>
					<div>
						Lines: <strong>{lineCount}</strong> (par {level.parScore})
					</div>
					<div
						style={{
							color: passes ? "#2a9d8f" : "#c00",
							fontWeight: 600,
							marginTop: 6,
						}}
					>
						{passes ? "✓ Tests pass" : "✗ Tests failing"}
					</div>
				</div>
			</div>

			<div style={{ marginTop: 10, fontFamily: "system-ui" }}>
				<button onClick={reset}>Reset code</button>
				<button
					onClick={next}
					disabled={!passes || levelIdx >= LEVELS.length - 1}
					style={{ marginLeft: 8 }}
				>
					Next level
				</button>
				{passes &&
					levelIdx === LEVELS.length - 1 &&
					lineCount <= level.parScore && (
						<span style={{ marginLeft: 12, color: "#2a9d8f" }}>
							Campaign cleared at par!
						</span>
					)}
			</div>

			<details
				style={{
					marginTop: 12,
					fontFamily: "system-ui",
					fontSize: 12,
					opacity: 0.7,
				}}
			>
				<summary>Language reference</summary>
				<pre style={{ fontFamily: "inherit" }}>{`set X N    X = N
add X N    X += N
add X Y    X += Y
mul X N    X *= N
print X    emit X`}</pre>
			</details>
		</div>
	);
}
