import { useEffect, useRef, useState } from "react";

// A combination dial. As you turn it, ticks sound. Near the correct number
// for the current digit, a subtle low resonance grows. Lock in a digit with
// the button. Find all 4 numbers.

const N = 100; // dial positions
const DIGITS = 4;

function genCombo(): number[] {
	return Array.from({ length: DIGITS }, () => Math.floor(Math.random() * N));
}

export default function VaultCracker() {
	const [combo] = useState<number[]>(genCombo);
	const [pos, setPos] = useState(0);
	const [locked, setLocked] = useState<number[]>([]);
	const [tries, setTries] = useState(0);
	const [won, setWon] = useState(false);
	const [msg, setMsg] = useState("Turn the dial slowly. Lock in when you feel close.");

	const audioRef = useRef<AudioContext | null>(null);
	const resOscRef = useRef<OscillatorNode | null>(null);
	const resGainRef = useRef<GainNode | null>(null);
	const lastPosRef = useRef(0);

	const ensureAudio = () => {
		if (audioRef.current) return audioRef.current;
		const Ctor =
			(window as unknown as { AudioContext: typeof AudioContext }).AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext;
		const ctx = new Ctor();
		audioRef.current = ctx;
		const osc = ctx.createOscillator();
		osc.type = "sine";
		osc.frequency.value = 80;
		const g = ctx.createGain();
		g.gain.value = 0;
		osc.connect(g);
		g.connect(ctx.destination);
		osc.start();
		resOscRef.current = osc;
		resGainRef.current = g;
		return ctx;
	};

	useEffect(() => {
		return () => {
			audioRef.current?.close();
		};
	}, []);

	const target = combo[locked.length] ?? -1;

	// Update resonance based on distance from target
	useEffect(() => {
		const ctx = audioRef.current;
		if (!ctx || !resGainRef.current || !resOscRef.current) return;
		if (target < 0) {
			resGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
			return;
		}
		let d = Math.abs(pos - target);
		d = Math.min(d, N - d); // wrap distance
		const closeness = Math.max(0, 1 - d / 20);
		resGainRef.current.gain.setTargetAtTime(
			closeness * 0.25,
			ctx.currentTime,
			0.05,
		);
		resOscRef.current.frequency.value = 60 + closeness * 60;
	}, [pos, target]);

	const tick = (ctx: AudioContext) => {
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = "square";
		osc.frequency.value = 1200;
		g.gain.value = 0;
		osc.connect(g);
		g.connect(ctx.destination);
		const t = ctx.currentTime;
		g.gain.setValueAtTime(0.08, t);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
		osc.start(t);
		osc.stop(t + 0.05);
	};

	const turn = (delta: number) => {
		const ctx = ensureAudio();
		const next = ((pos + delta) % N + N) % N;
		setPos(next);
		if (next !== lastPosRef.current) {
			tick(ctx);
			lastPosRef.current = next;
		}
	};

	const lockIn = () => {
		ensureAudio();
		setTries((t) => t + 1);
		let d = Math.abs(pos - target);
		d = Math.min(d, N - d);
		if (d === 0) {
			const nl = [...locked, pos];
			setLocked(nl);
			setMsg(`Click — digit ${nl.length} locked!`);
			if (nl.length >= DIGITS) {
				setWon(true);
				setMsg(`Vault opened in ${tries + 1} attempts!`);
			}
		} else {
			setMsg(`Wrong — off by ${d}. Try again.`);
		}
	};

	const angle = (pos / N) * 360;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "radial-gradient(circle,#2a2a2a,#0a0a0a)",
				color: "#d4c8a8",
				fontFamily: "monospace",
				padding: 20,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
			}}
		>
			<h2 style={{ margin: 0 }}>Vault Cracker</h2>
			<div style={{ fontSize: 12, opacity: 0.7 }}>
				Listen for the low resonance. Tick clicks as you turn.
			</div>
			<div
				style={{
					marginTop: 16,
					width: 280,
					height: 280,
					borderRadius: "50%",
					background:
						"radial-gradient(circle, #5a4a30 0%, #3a2a18 60%, #2a1a0a 100%)",
					border: "6px solid #8a7a5a",
					position: "relative",
					boxShadow: "0 0 30px rgba(0,0,0,0.8), inset 0 0 30px rgba(0,0,0,0.5)",
				}}
			>
				{/* tick marks */}
				{Array.from({ length: 20 }).map((_, i) => {
					const a = (i / 20) * 360;
					const major = i % 5 === 0;
					return (
						<div
							key={`tick-${i}`}
							style={{
								position: "absolute",
								left: "50%",
								top: "50%",
								width: 2,
								height: major ? 18 : 10,
								background: "#c9b890",
								transform: `translate(-50%, -100%) rotate(${a}deg) translateY(-110px)`,
								transformOrigin: "50% 110px",
							}}
						/>
					);
				})}
				{/* numbers */}
				{[0, 25, 50, 75].map((v) => {
					const a = (v / N) * 360 - 90;
					const rad = (a * Math.PI) / 180;
					return (
						<div
							key={`label-${v}`}
							style={{
								position: "absolute",
								left: `calc(50% + ${Math.cos(rad) * 95}px)`,
								top: `calc(50% + ${Math.sin(rad) * 95}px)`,
								transform: "translate(-50%,-50%)",
								fontSize: 16,
								color: "#e4d4a8",
							}}
						>
							{v}
						</div>
					);
				})}
				{/* pointer */}
				<div
					style={{
						position: "absolute",
						left: "50%",
						top: "50%",
						width: 4,
						height: 100,
						background:
							"linear-gradient(180deg,#ff8c3a,#a04020)",
						transform: `translate(-50%, -100%) rotate(${angle}deg)`,
						transformOrigin: "50% 100%",
						borderRadius: 2,
					}}
				/>
				{/* center */}
				<div
					style={{
						position: "absolute",
						left: "50%",
						top: "50%",
						width: 30,
						height: 30,
						background: "#1a1208",
						border: "2px solid #8a7a5a",
						borderRadius: "50%",
						transform: "translate(-50%,-50%)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						fontSize: 12,
					}}
				>
					{pos}
				</div>
			</div>
			<div style={{ marginTop: 16, display: "flex", gap: 8 }}>
				<button
					type="button"
					onClick={() => turn(-5)}
					style={btnStyle}
				>
					◀◀
				</button>
				<button
					type="button"
					onClick={() => turn(-1)}
					style={btnStyle}
				>
					◀
				</button>
				<button
					type="button"
					onClick={lockIn}
					disabled={won}
					style={{
						...btnStyle,
						background: "#a05020",
					}}
				>
					LOCK
				</button>
				<button
					type="button"
					onClick={() => turn(1)}
					style={btnStyle}
				>
					▶
				</button>
				<button
					type="button"
					onClick={() => turn(5)}
					style={btnStyle}
				>
					▶▶
				</button>
			</div>
			<div style={{ marginTop: 14, display: "flex", gap: 12 }}>
				{Array.from({ length: DIGITS }).map((_, i) => (
					<div
						key={`digit-${i}`}
						style={{
							width: 50,
							height: 40,
							background: "#1a1208",
							border: "1px solid #8a7a5a",
							borderRadius: 3,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 18,
							color: locked[i] !== undefined ? "#9bcc70" : "#6a5a3a",
						}}
					>
						{locked[i] !== undefined
							? locked[i].toString().padStart(2, "0")
							: i === locked.length
								? "?"
								: "—"}
					</div>
				))}
			</div>
			<div style={{ marginTop: 10, fontSize: 13, minHeight: 18 }}>{msg}</div>
			<div style={{ marginTop: 4, fontSize: 12, opacity: 0.6 }}>
				Attempts: {tries}
			</div>
			{won && (
				<button
					type="button"
					onClick={() => window.location.reload()}
					style={{ ...btnStyle, marginTop: 10, background: "#9bcc70", color: "#000" }}
				>
					Play again
				</button>
			)}
		</div>
	);
}

const btnStyle: React.CSSProperties = {
	padding: "8px 14px",
	background: "#3a2a18",
	color: "#e4d4a8",
	border: "1px solid #8a7a5a",
	borderRadius: 3,
	cursor: "pointer",
	fontFamily: "monospace",
	fontSize: 14,
};
