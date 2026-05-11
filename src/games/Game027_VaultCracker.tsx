import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Vault Cracker — seeded multi-vault campaign. Each vault has procedurally
// chosen difficulty (dial size, digits, resonance radius). Ticks of the dial
// are real audio cues; a low resonance grows as you near the target. Keyboard
// support; campaign scoring; vault aura intensifies near the target.

function mulberry32(seed: number) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

type VaultConfig = {
	n: number;
	digits: number;
	radius: number;
	combo: number[];
	name: string;
};

const NAMES = ["Tin", "Iron", "Bronze", "Silver", "Gold", "Adamant", "Crystal", "Obsidian", "Mythic"];

function genVault(seed: number, level: number): VaultConfig {
	const rng = mulberry32(seed + level * 9301);
	const n = 60 + Math.floor(rng() * 40) + level * 8;
	const digits = Math.min(6, 3 + Math.floor(level / 2));
	const radius = Math.max(8, 24 - level * 2);
	const combo = Array.from({ length: digits }, () => Math.floor(rng() * n));
	const name = `${NAMES[Math.min(level, NAMES.length - 1)]} Vault`;
	return { n, digits, radius, combo, name };
}

export default function VaultCracker() {
	const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
	const [level, setLevel] = useState(0);
	const vault = useMemo(() => genVault(seed, level), [seed, level]);
	const [pos, setPos] = useState(0);
	const [locked, setLocked] = useState<number[]>([]);
	const [tries, setTries] = useState(0);
	const [won, setWon] = useState(false);
	const [campaignScore, setCampaignScore] = useState(0);
	const [msg, setMsg] = useState("Turn the dial. Listen for the low resonance.");
	const [startMs] = useState(() => Date.now());

	const audioRef = useRef<AudioContext | null>(null);
	const resOscRef = useRef<OscillatorNode | null>(null);
	const resGainRef = useRef<GainNode | null>(null);
	const lastPosRef = useRef(0);

	const ensureAudio = useCallback(() => {
		if (audioRef.current) return audioRef.current;
		const Ctor =
			(window as unknown as { AudioContext: typeof AudioContext }).AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		const ctx = new Ctor();
		audioRef.current = ctx;
		const osc = ctx.createOscillator();
		osc.type = "sine"; osc.frequency.value = 80;
		const g = ctx.createGain();
		g.gain.value = 0;
		osc.connect(g); g.connect(ctx.destination);
		osc.start();
		resOscRef.current = osc;
		resGainRef.current = g;
		return ctx;
	}, []);

	useEffect(() => () => { audioRef.current?.close(); }, []);

	const target = vault.combo[locked.length] ?? -1;

	useEffect(() => {
		const ctx = audioRef.current;
		if (!ctx || !resGainRef.current || !resOscRef.current) return;
		if (target < 0 || won) {
			resGainRef.current.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
			return;
		}
		let d = Math.abs(pos - target);
		d = Math.min(d, vault.n - d);
		const closeness = Math.max(0, 1 - d / vault.radius);
		resGainRef.current.gain.setTargetAtTime(closeness * 0.25, ctx.currentTime, 0.05);
		resOscRef.current.frequency.value = 60 + closeness * 60;
	}, [pos, target, vault.n, vault.radius, won]);

	const tick = (ctx: AudioContext, strong: boolean) => {
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = "square";
		osc.frequency.value = strong ? 900 : 1400;
		g.gain.value = 0;
		osc.connect(g); g.connect(ctx.destination);
		const t = ctx.currentTime;
		g.gain.setValueAtTime(strong ? 0.12 : 0.06, t);
		g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
		osc.start(t); osc.stop(t + 0.05);
	};

	const success = (ctx: AudioContext) => {
		[400, 600, 800].forEach((f, i) => {
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.type = "sine"; o.frequency.value = f;
			o.connect(g); g.connect(ctx.destination);
			const t = ctx.currentTime + i * 0.05;
			g.gain.setValueAtTime(0.0001, t);
			g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
			g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
			o.start(t); o.stop(t + 0.65);
		});
	};

	const turn = useCallback((delta: number) => {
		const ctx = ensureAudio();
		const next = ((pos + delta) % vault.n + vault.n) % vault.n;
		setPos(next);
		if (next !== lastPosRef.current) {
			tick(ctx, next % 10 === 0);
			lastPosRef.current = next;
		}
	}, [pos, vault.n, ensureAudio]);

	const lockIn = useCallback(() => {
		if (won) return;
		const ctx = ensureAudio();
		setTries((t) => t + 1);
		let d = Math.abs(pos - target);
		d = Math.min(d, vault.n - d);
		if (d === 0) {
			const nl = [...locked, pos];
			setLocked(nl);
			setMsg(`Click — digit ${nl.length} locked!`);
			success(ctx);
			if (nl.length >= vault.digits) {
				setWon(true);
				const elapsed = (Date.now() - startMs) / 1000;
				const score = Math.max(50, 500 - tries * 5 - Math.floor(elapsed));
				setCampaignScore((s) => s + score);
				setMsg(`${vault.name} cracked! +${score}`);
			}
		} else {
			setMsg(`Off by ${d}. Listen for the hum.`);
		}
	}, [pos, target, vault, locked, won, tries, startMs, ensureAudio]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") turn(-1);
			else if (e.key === "ArrowRight") turn(1);
			else if (e.key === "ArrowDown") turn(-5);
			else if (e.key === "ArrowUp") turn(5);
			else if (e.key === " " || e.key === "Enter") { e.preventDefault(); lockIn(); }
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [turn, lockIn]);

	const nextVault = () => {
		setLevel((l) => l + 1);
		setPos(0); setLocked([]); setTries(0); setWon(false);
		setMsg("Heavier door. Closer tolerance.");
	};

	const restart = () => {
		setSeed(Math.floor(Math.random() * 1e9));
		setLevel(0); setPos(0); setLocked([]); setTries(0);
		setWon(false); setCampaignScore(0);
		setMsg("New campaign.");
	};

	const angle = (pos / vault.n) * 360;
	let darc = target >= 0 ? Math.abs(pos - target) : vault.n;
	darc = Math.min(darc, vault.n - darc);
	const peep = target >= 0 ? Math.max(0, 1 - darc / vault.radius) : 0;

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "radial-gradient(circle,#2a2a2a,#0a0a0a)",
				color: "#d4c8a8",
				fontFamily: "monospace",
				padding: 16,
				boxSizing: "border-box",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
			}}
		>
			<h2 style={{ margin: 0 }}>Vault Cracker</h2>
			<div style={{ fontSize: 12, opacity: 0.7 }}>
				{vault.name} · {vault.n} positions · {vault.digits} digits · seed {seed}
			</div>
			<div style={{ fontSize: 11, opacity: 0.5 }}>
				Arrow keys to turn, Space/Enter to lock
			</div>
			<div
				style={{
					marginTop: 12,
					width: 260,
					height: 260,
					borderRadius: "50%",
					background: "radial-gradient(circle, #5a4a30 0%, #3a2a18 60%, #2a1a0a 100%)",
					border: "6px solid #8a7a5a",
					position: "relative",
					boxShadow: `0 0 ${10 + peep * 30}px rgba(255,${180 - peep * 80},${80 - peep * 60},${0.3 + peep * 0.5}), inset 0 0 30px rgba(0,0,0,0.5)`,
				}}
			>
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
								transform: `translate(-50%, -100%) rotate(${a}deg) translateY(-100px)`,
								transformOrigin: "50% 100px",
							}}
						/>
					);
				})}
				{[0, Math.floor(vault.n / 4), Math.floor(vault.n / 2), Math.floor((vault.n * 3) / 4)].map((v) => {
					const a = (v / vault.n) * 360 - 90;
					const rad = (a * Math.PI) / 180;
					return (
						<div
							key={`label-${v}`}
							style={{
								position: "absolute",
								left: `calc(50% + ${Math.cos(rad) * 85}px)`,
								top: `calc(50% + ${Math.sin(rad) * 85}px)`,
								transform: "translate(-50%,-50%)",
								fontSize: 14,
								color: "#e4d4a8",
							}}
						>
							{v}
						</div>
					);
				})}
				<div
					style={{
						position: "absolute",
						left: "50%",
						top: "50%",
						width: 4,
						height: 90,
						background: "linear-gradient(180deg,#ff8c3a,#a04020)",
						transform: `translate(-50%, -100%) rotate(${angle}deg)`,
						transformOrigin: "50% 100%",
						borderRadius: 2,
					}}
				/>
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
			<div style={{ marginTop: 14, display: "flex", gap: 6 }}>
				<button type="button" onClick={() => turn(-5)} style={btnStyle}>◀◀</button>
				<button type="button" onClick={() => turn(-1)} style={btnStyle}>◀</button>
				<button
					type="button"
					onClick={lockIn}
					disabled={won}
					style={{ ...btnStyle, background: "#a05020" }}
				>
					LOCK
				</button>
				<button type="button" onClick={() => turn(1)} style={btnStyle}>▶</button>
				<button type="button" onClick={() => turn(5)} style={btnStyle}>▶▶</button>
			</div>
			<div style={{ marginTop: 12, display: "flex", gap: 10 }}>
				{Array.from({ length: vault.digits }).map((_, i) => (
					<div
						key={`digit-${i}`}
						style={{
							width: 46,
							height: 36,
							background: "#1a1208",
							border: "1px solid #8a7a5a",
							borderRadius: 3,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontSize: 16,
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
			<div style={{ marginTop: 8, fontSize: 13, minHeight: 18 }}>{msg}</div>
			<div style={{ marginTop: 2, fontSize: 12, opacity: 0.6 }}>
				Vault {level + 1} · Attempts: {tries} · Score: {campaignScore}
			</div>
			{won && (
				<div style={{ marginTop: 8, display: "flex", gap: 8 }}>
					<button type="button" onClick={nextVault} style={{ ...btnStyle, background: "#9bcc70", color: "#000" }}>
						Next vault →
					</button>
					<button type="button" onClick={restart} style={btnStyle}>
						New campaign
					</button>
				</div>
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
