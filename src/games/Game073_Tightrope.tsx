import { useEffect, useRef, useState } from "react";

// Game 73 — Tightrope
// Walk across. Mouse left/right balances. Procedural gusts push you.
// Balance pole slows reactions but increases stability.

export default function Game073_Tightrope() {
	const [progress, setProgress] = useState(0); // 0..1 across chasm
	const [angle, setAngle] = useState(0); // tilt in radians
	const [angVel, setAngVel] = useState(0);
	const [pole, setPole] = useState(true);
	const [gust, setGust] = useState(0);
	const [state, setState] = useState<"play" | "win" | "fall">("play");
	const [best, setBest] = useState<number>(() => {
		const v = localStorage.getItem("tightrope_best");
		return v ? parseFloat(v) : 0;
	});
	const [tries, setTries] = useState(0);

	const mouseX = useRef(0);
	const containerRef = useRef<HTMLDivElement>(null);
	const raf = useRef<number | null>(null);
	const lastTs = useRef<number | null>(null);
	const gustRef = useRef(0);
	const startTime = useRef<number>(Date.now());

	useEffect(() => {
		const onMove = (e: MouseEvent) => {
			if (!containerRef.current) return;
			const r = containerRef.current.getBoundingClientRect();
			mouseX.current = ((e.clientX - r.left) / r.width) * 2 - 1; // -1..1
		};
		window.addEventListener("mousemove", onMove);
		return () => window.removeEventListener("mousemove", onMove);
	}, []);

	useEffect(() => {
		if (state !== "play") return;
		const step = (ts: number) => {
			if (lastTs.current == null) lastTs.current = ts;
			const dt = Math.min(0.05, (ts - lastTs.current) / 1000);
			lastTs.current = ts;

			// random gusts
			if (Math.random() < 0.015) gustRef.current = (Math.random() - 0.5) * 4;
			gustRef.current *= 0.92;
			setGust(gustRef.current);

			// physics
			setAngle((a) => {
				setAngVel((v) => {
					// gravity-like instability: angle accelerates outward
					const inputResponse = pole ? 1.0 : 1.8;
					const stability = pole ? 0.5 : 0.0;
					const torque = a * 6.0 - mouseX.current * inputResponse * 8 + gustRef.current * 1.2;
					const damping = 1.5 + stability;
					const newV = v + torque * dt - v * damping * dt;
					return newV;
				});
				const newA = a + angVel * dt;
				if (Math.abs(newA) > Math.PI / 2.2) {
					setState("fall");
				}
				return newA;
			});

			setProgress((p) => {
				const speed = 0.07 * (1 - Math.min(0.8, Math.abs(angle) * 1.2));
				const np = Math.min(1, p + speed * dt);
				if (np >= 1) setState("win");
				return np;
			});

			raf.current = requestAnimationFrame(step);
		};
		raf.current = requestAnimationFrame(step);
		return () => {
			if (raf.current) cancelAnimationFrame(raf.current);
			lastTs.current = null;
		};
	}, [state, angle, angVel, pole]);

	useEffect(() => {
		if (state === "win") {
			const elapsed = (Date.now() - startTime.current) / 1000;
			if (best === 0 || elapsed < best) {
				setBest(elapsed);
				localStorage.setItem("tightrope_best", elapsed.toString());
			}
		}
	}, [state, best]);

	const reset = () => {
		setProgress(0);
		setAngle(0);
		setAngVel(0);
		setGust(0);
		gustRef.current = 0;
		setState("play");
		setTries((t) => t + 1);
		startTime.current = Date.now();
	};

	const tilt = (angle * 180) / Math.PI;

	return (
		<div
			ref={containerRef}
			style={{
				width: 900,
				height: 600,
				background: "linear-gradient(180deg,#101225,#2b3f6a 60%,#3c2a1c)",
				color: "#fff",
				fontFamily: "system-ui, sans-serif",
				position: "relative",
				overflow: "hidden",
				userSelect: "none",
				cursor: "none",
			}}
		>
			<div style={{ position: "absolute", top: 8, left: 12 }}>
				<b>Tightrope</b> — move mouse to balance. Reach the far cliff.
			</div>
			<div style={{ position: "absolute", top: 8, right: 12, textAlign: "right", fontSize: 13 }}>
				<label>
					<input
						type="checkbox"
						checked={pole}
						onChange={(e) => setPole(e.target.checked)}
					/>{" "}
					Use balance pole
				</label>
				<div>Best: {best ? best.toFixed(1) : "—"}s</div>
				<div>Attempt #{tries + 1}</div>
			</div>

			{/* cliffs */}
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 380,
					width: 120,
					height: 220,
					background: "#2a1a10",
					borderRight: "2px solid #000",
				}}
			/>
			<div
				style={{
					position: "absolute",
					right: 0,
					top: 380,
					width: 120,
					height: 220,
					background: "#2a1a10",
					borderLeft: "2px solid #000",
				}}
			/>
			{/* rope */}
			<div
				style={{
					position: "absolute",
					top: 380,
					left: 120,
					width: 660,
					height: 2,
					background: "#aaa",
				}}
			/>
			{/* gust indicator */}
			<div
				style={{
					position: "absolute",
					top: 40,
					left: 450 - 75,
					width: 150,
					height: 8,
					background: "#0006",
				}}
			>
				<div
					style={{
						position: "absolute",
						left: 75 + gust * 30,
						top: -2,
						width: 4,
						height: 12,
						background: "#f93",
					}}
				/>
			</div>

			{/* walker */}
			<div
				style={{
					position: "absolute",
					top: 280,
					left: 120 + progress * 660,
					transform: `translateX(-50%) rotate(${tilt}deg)`,
					transformOrigin: "50% 100%",
					transition: "left 0.05s linear",
				}}
			>
				{/* pole */}
				{pole && (
					<div
						style={{
							position: "absolute",
							top: 30,
							left: -70,
							width: 140,
							height: 4,
							background: "#a87",
						}}
					/>
				)}
				{/* body */}
				<div
					style={{
						width: 14,
						height: 60,
						background: "#eee",
						margin: "0 auto",
						borderRadius: 4,
					}}
				/>
				<div
					style={{
						width: 18,
						height: 18,
						background: "#fcd",
						borderRadius: "50%",
						margin: "-66px auto 0",
					}}
				/>
				<div
					style={{
						width: 14,
						height: 40,
						background: "#246",
						margin: "8px auto 0",
					}}
				/>
			</div>

			<div
				style={{
					position: "absolute",
					bottom: 12,
					left: 12,
					right: 12,
					height: 8,
					background: "#0008",
				}}
			>
				<div
					style={{
						width: `${progress * 100}%`,
						height: "100%",
						background: "#6f6",
					}}
				/>
			</div>

			{state !== "play" && (
				<div
					style={{
						position: "absolute",
						top: "40%",
						left: 0,
						right: 0,
						textAlign: "center",
						fontSize: 32,
					}}
				>
					{state === "win" ? "You made it!" : "You fell."}
					<div>
						<button
							onClick={reset}
							style={{
								fontSize: 16,
								padding: "8px 16px",
								marginTop: 12,
								cursor: "pointer",
							}}
						>
							Try again
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
