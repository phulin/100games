import { useEffect, useRef, useState } from "react";

type NPC = {
	id: number;
	age: "child" | "adult" | "elder";
	hat: boolean;
	color: string;
	// true demographic. May be visually altered when lying — but only on
	// passes after the first. We model "lying" as flicker between values
	// on subsequent passes.
	liar: boolean;
};

const AGES: NPC["age"][] = ["child", "adult", "elder"];
const COLORS = ["red", "blue", "green", "yellow"];

function makeNPCs(): NPC[] {
	const arr: NPC[] = [];
	for (let i = 0; i < 30; i++) {
		arr.push({
			id: i,
			age: AGES[Math.floor(Math.random() * AGES.length)],
			hat: Math.random() < 0.5,
			color: COLORS[Math.floor(Math.random() * COLORS.length)],
			liar: Math.random() < 0.25,
		});
	}
	return arr;
}

const DURATION = 60; // seconds

export default function Game087_Census() {
	const [npcs] = useState<NPC[]>(() => makeNPCs());
	const [running, setRunning] = useState(false);
	const [time, setTime] = useState(0);
	const [pass, setPass] = useState(0);
	const [counts, setCounts] = useState({
		child: 0,
		adult: 0,
		elder: 0,
		hat: 0,
		red: 0,
		blue: 0,
		green: 0,
		yellow: 0,
	});
	const [submitted, setSubmitted] = useState(false);
	const startRef = useRef(0);

	useEffect(() => {
		if (!running) return;
		startRef.current = performance.now();
		let raf = 0;
		const tick = (t: number) => {
			const elapsed = (t - startRef.current) / 1000;
			setTime(elapsed);
			setPass(Math.floor(elapsed / 20)); // 3 passes in 60s
			if (elapsed >= DURATION) {
				setRunning(false);
				return;
			}
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [running]);

	// Visible NPCs at given time. Each NPC moves L-to-R; they appear in waves.
	// Total of 30 over 60s spread 3 passes of 10 each.
	const visibleNow = () => {
		const inPass = (time % 20) / 20;
		const start = pass * 10;
		const ids = [];
		for (let i = 0; i < 10; i++) {
			const npc = npcs[start + i];
			if (!npc) continue;
			const offset = i / 10;
			const x = ((inPass - offset) * 1.6 + 1) % 1;
			if (x > 0 && x < 1) {
				ids.push({ npc, x });
			}
		}
		return ids;
	};

	const visible = running ? visibleNow() : [];

	// When liar and pass > 0, randomly mutate visible attributes.
	const displayFor = (npc: NPC): NPC => {
		if (!npc.liar || pass === 0) return npc;
		// deterministic-ish based on pass+id
		const seed = (npc.id * 7 + pass * 13) % 100;
		return {
			...npc,
			age: AGES[seed % 3],
			color: COLORS[(seed >> 2) % 4],
			hat: (seed >> 4) % 2 === 0 ? !npc.hat : npc.hat,
		};
	};

	const truth = () => {
		const t = {
			child: 0,
			adult: 0,
			elder: 0,
			hat: 0,
			red: 0,
			blue: 0,
			green: 0,
			yellow: 0,
		};
		for (const n of npcs) {
			t[n.age]++;
			if (n.hat) t.hat++;
			(t as any)[n.color]++;
		}
		return t;
	};

	const score = () => {
		const t = truth();
		let err = 0;
		for (const k of Object.keys(t) as (keyof typeof t)[]) {
			err += Math.abs(t[k] - (counts as any)[k]);
		}
		return err;
	};

	const start = () => {
		setSubmitted(false);
		setTime(0);
		setPass(0);
		setCounts({
			child: 0,
			adult: 0,
			elder: 0,
			hat: 0,
			red: 0,
			blue: 0,
			green: 0,
			yellow: 0,
		});
		setRunning(true);
	};

	const adjust = (k: keyof typeof counts, d: number) => {
		setCounts((c) => ({ ...c, [k]: Math.max(0, c[k] + d) }));
	};

	const t = truth();

	return (
		<div
			style={{
				fontFamily: "system-ui, sans-serif",
				color: "#eee",
				background: "#1a1a22",
				padding: 16,
				minHeight: 600,
			}}
		>
			<h2 style={{ margin: 0 }}>87. Census</h2>
			<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
				Count the townsfolk passing through. Three passes; some lie (their look
				changes). Cross-check.
			</div>
			<div style={{ marginBottom: 8 }}>
				Time {time.toFixed(1)}/{DURATION}s · Pass {pass + 1}/3
				<button type="button" onClick={start} style={{ ...btn, marginLeft: 8 }}>
					{running ? "Restart" : "Begin"}
				</button>
			</div>
			<div
				style={{
					position: "relative",
					height: 140,
					background: "#0e0e16",
					border: "1px solid #333",
					borderRadius: 6,
					overflow: "hidden",
				}}
			>
				{visible.map(({ npc, x }) => {
					const d = displayFor(npc);
					const size = d.age === "child" ? 22 : d.age === "elder" ? 30 : 34;
					return (
						<div
							key={npc.id}
							style={{
								position: "absolute",
								left: `${x * 100}%`,
								bottom: 10,
								transform: "translateX(-50%)",
								textAlign: "center",
							}}
						>
							{d.hat && (
								<div
									style={{
										width: size,
										height: 6,
										background: "#222",
										border: "1px solid #555",
										margin: "0 auto",
									}}
								/>
							)}
							<div
								style={{
									width: size,
									height: size,
									background: d.color,
									borderRadius: "50%",
									border: "1px solid #000",
								}}
							/>
						</div>
					);
				})}
			</div>
			<div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
				{(
					[
						"child",
						"adult",
						"elder",
						"hat",
						"red",
						"blue",
						"green",
						"yellow",
					] as (keyof typeof counts)[]
				).map((k) => (
					<div
						key={k}
						style={{
							background: "#252530",
							padding: 8,
							borderRadius: 4,
							minWidth: 90,
						}}
					>
						<div style={{ fontSize: 11, opacity: 0.8 }}>{k}</div>
						<div style={{ display: "flex", alignItems: "center", gap: 4 }}>
							<button type="button" onClick={() => adjust(k, -1)} style={btn}>
								-
							</button>
							<div style={{ minWidth: 22, textAlign: "center" }}>
								{counts[k]}
							</div>
							<button type="button" onClick={() => adjust(k, 1)} style={btn}>
								+
							</button>
						</div>
					</div>
				))}
			</div>
			<div style={{ marginTop: 12 }}>
				<button
					type="button"
					onClick={() => setSubmitted(true)}
					disabled={running}
					style={btn}
				>
					Submit census
				</button>
				{submitted && (
					<div style={{ marginTop: 8 }}>
						Total error: <strong>{score()}</strong>. Truth: child {t.child},
						adult {t.adult}, elder {t.elder}, hat {t.hat}, red {t.red}, blue {t.blue},
						green {t.green}, yellow {t.yellow}.
					</div>
				)}
			</div>
		</div>
	);
}

const btn: React.CSSProperties = {
	padding: "4px 10px",
	background: "#345",
	color: "#fff",
	border: "1px solid #567",
	borderRadius: 4,
	cursor: "pointer",
};
