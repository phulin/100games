import { useEffect, useMemo, useRef, useState } from "react";

// Simple pseudo-language. We "run" by treating the code as a mini DSL:
//   set X N|Y      -> X = N or Y
//   add X N|Y      -> X += N or Y
//   sub X N|Y      -> X -= N or Y
//   mul X N|Y      -> X *= N or Y
//   print X        -> output value

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

type Level = {
	title: string;
	hint: string;
	start: string;
	expected: number[];
	parScore: number;
};

function genLevel(seed: number, levelIndex: number): Level {
	const rng = mulberry32(seed + levelIndex * 977);
	const r = (n: number) => Math.floor(rng() * n);
	const kinds = ["inline", "dedupe", "extract", "fold"] as const;
	const kind = kinds[r(kinds.length)];

	if (kind === "inline") {
		const A = 1 + r(9);
		const M = 1 + r(9);
		const lines = [`set a ${A}`, `set b a`, `add b ${M}`, `print b`];
		return {
			title: "Inline",
			hint: "Some intermediate values are only used once.",
			start: lines.join("\n"),
			expected: [A + M],
			parScore: 2,
		};
	}
	if (kind === "dedupe") {
		const A = 1 + r(5);
		const reps = 3 + r(4);
		const lines = [`set a ${A}`];
		for (let i = 0; i < reps; i++) lines.push("add a 1");
		lines.push("print a");
		return {
			title: "Dedupe",
			hint: "Repeated identical statements waste characters.",
			start: lines.join("\n"),
			expected: [A + reps],
			parScore: 2,
		};
	}
	if (kind === "extract") {
		const A = 2 + r(7);
		const M = 2 + r(4);
		const lines = [
			`set a ${A}`,
			`mul a ${M}`,
			`print a`,
			`set b ${A}`,
			`mul b ${M}`,
			`print b`,
		];
		return {
			title: "Extract",
			hint: "Reuse a computed value rather than re-doing it.",
			start: lines.join("\n"),
			expected: [A * M, A * M],
			parScore: 4,
		};
	}
	const A = 1 + r(4);
	const B = 1 + r(4);
	const C = 1 + r(4);
	const lines = [`set a ${A}`, `add a ${B}`, `add a ${C}`, `print a`];
	return {
		title: "Fold",
		hint: "Constants can be folded together.",
		start: lines.join("\n"),
		expected: [A + B + C],
		parScore: 2,
	};
}

function runCode(src: string): {
	output: number[];
	error: string | null;
	steps: number;
} {
	const env: Record<string, number> = {};
	const output: number[] = [];
	const lines = src
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	let steps = 0;
	for (const ln of lines) {
		steps++;
		if (steps > 5000) return { output, error: "too many steps", steps };
		const parts = ln.split(/\s+/);
		const [op, x, y] = parts;
		const ynum =
			y === undefined ? NaN : Number.isNaN(Number(y)) ? env[y] : Number(y);
		if (op === "set") {
			if (Number.isNaN(ynum)) return { output, error: `bad: ${ln}`, steps };
			env[x] = ynum;
		} else if (op === "add") {
			if (Number.isNaN(ynum) || !(x in env))
				return { output, error: `bad: ${ln}`, steps };
			env[x] += ynum;
		} else if (op === "sub") {
			if (Number.isNaN(ynum) || !(x in env))
				return { output, error: `bad: ${ln}`, steps };
			env[x] -= ynum;
		} else if (op === "mul") {
			if (Number.isNaN(ynum) || !(x in env))
				return { output, error: `bad: ${ln}`, steps };
			env[x] *= ynum;
		} else if (op === "print") {
			if (!(x in env)) return { output, error: `unset: ${x}`, steps };
			output.push(env[x]);
		} else {
			return { output, error: `unknown op: ${op}`, steps };
		}
	}
	return { output, error: null, steps };
}

function arrEq(a: number[], b: number[]): boolean {
	return a.length === b.length && a.every((v, i) => v === b[i]);
}

function playTone(
	ref: React.MutableRefObject<AudioContext | null>,
	freq: number,
	dur = 0.12,
	type: OscillatorType = "triangle",
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

const NUM_LEVELS = 6;

export default function Game096_Refactor() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const levels = useMemo<Level[]>(
		() => Array.from({ length: NUM_LEVELS }, (_, i) => genLevel(seed, i)),
		[seed],
	);

	const [levelIdx, setLevelIdx] = useState(0);
	const level = levels[levelIdx];
	const [code, setCode] = useState(level.start);
	const [history, setHistory] = useState<string[]>([level.start]);
	const audio = useRef<AudioContext | null>(null);

	const bestKey = `refactor_best_${seed}`;
	const [bests, setBests] = useState<Record<number, number>>(() => {
		try {
			return JSON.parse(localStorage.getItem(bestKey) || "{}");
		} catch {
			return {};
		}
	});

	const { output, error, steps } = useMemo(() => runCode(code), [code]);
	const passes = !error && arrEq(output, level.expected);
	const lineCount = code.split("\n").filter((l) => l.trim()).length;
	const charCount = code.replace(/\s+/g, "").length;

	useEffect(() => {
		setCode(levels[levelIdx].start);
		setHistory([levels[levelIdx].start]);
	}, [levelIdx, levels]);

	useEffect(() => {
		if (!passes) return;
		const cur = bests[levelIdx];
		if (cur == null || lineCount < cur) {
			const nb = { ...bests, [levelIdx]: lineCount };
			setBests(nb);
			try {
				localStorage.setItem(bestKey, JSON.stringify(nb));
			} catch {
				/* ignore */
			}
			playTone(audio, 660, 0.14, "triangle");
			setTimeout(() => playTone(audio, 880, 0.18, "triangle"), 90);
		}
	}, [passes, lineCount, levelIdx, bests, bestKey]);

	function updateCode(next: string) {
		setCode(next);
		setHistory((h) =>
			h[h.length - 1] === next ? h : [...h.slice(-50), next],
		);
	}
	function undo() {
		setHistory((h) => {
			if (h.length <= 1) return h;
			const nh = h.slice(0, -1);
			setCode(nh[nh.length - 1]);
			return nh;
		});
	}
	function nextLvl() {
		if (levelIdx < levels.length - 1) setLevelIdx(levelIdx + 1);
	}
	function newSeed() {
		setSeed(Math.floor(Math.random() * 1e9));
		setLevelIdx(0);
		setBests({});
	}
	function reset() {
		updateCode(level.start);
	}

	const allCleared =
		passes &&
		levelIdx === levels.length - 1 &&
		Object.keys(bests).length === levels.length;
	const totalPar = levels.reduce((s, l) => s + l.parScore, 0);
	const totalBest = Object.values(bests).reduce((s, v) => s + v, 0);

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
				Shrink the program. Tests must still pass. Aim for par. Seed:{" "}
				<code>{seed}</code>
			</p>

			<div
				style={{
					marginBottom: 8,
					fontFamily: "system-ui",
					display: "flex",
					gap: 8,
					alignItems: "center",
					flexWrap: "wrap",
				}}
			>
				<strong>
					Level {levelIdx + 1}/{levels.length}: {level.title}
				</strong>
				<span style={{ opacity: 0.7 }}>— {level.hint}</span>
				<span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
					Total best: {totalBest || "—"} / par {totalPar}
				</span>
			</div>

			<div style={{ display: "flex", gap: 16 }}>
				<textarea
					value={code}
					onChange={(e) => updateCode(e.target.value)}
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
						{bests[levelIdx] != null && (
							<span style={{ marginLeft: 6, opacity: 0.7 }}>
								best {bests[levelIdx]}
							</span>
						)}
					</div>
					<div style={{ opacity: 0.6, fontSize: 11 }}>
						Chars: {charCount} • Ops: {steps}
					</div>
					<div
						style={{
							color: passes ? "#2a9d8f" : "#c00",
							fontWeight: 600,
							marginTop: 6,
						}}
					>
						{passes
							? lineCount <= level.parScore
								? "Tests pass — at or under par!"
								: "Tests pass"
							: "Tests failing"}
					</div>
				</div>
			</div>

			<div style={{ marginTop: 10, fontFamily: "system-ui" }}>
				<button onClick={reset}>Reset</button>
				<button
					onClick={undo}
					disabled={history.length <= 1}
					style={{ marginLeft: 8 }}
				>
					Undo
				</button>
				<button
					onClick={nextLvl}
					disabled={!passes || levelIdx >= levels.length - 1}
					style={{ marginLeft: 8 }}
				>
					Next level
				</button>
				<button onClick={newSeed} style={{ marginLeft: 8 }}>
					New seed
				</button>
				{allCleared && (
					<span style={{ marginLeft: 12, color: "#2a9d8f" }}>
						Campaign cleared! {totalBest <= totalPar ? "At par." : ""}
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
				<pre style={{ fontFamily: "inherit" }}>{`set X N|Y    X = N or Y
add X N|Y    X += N or Y
sub X N|Y    X -= N or Y
mul X N|Y    X *= N or Y
print X      emit X`}</pre>
			</details>
		</div>
	);
}
