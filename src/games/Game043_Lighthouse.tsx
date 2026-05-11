import { useEffect, useRef, useState } from "react";

// Lighthouse — aim a rotating beam to warn ships off rocks.

type Ship = {
	id: number;
	angle: number; // direction from lighthouse, radians
	dist: number; // current distance from rocks (>0 = far)
	warned: boolean;
	saved: boolean;
	crashed: boolean;
	speed: number;
};

const CX = 440;
const CY = 380;
const W = 880;
const H = 560;
const ROCK_RADIUS = 80;
const BEAM_WIDTH = 0.45; // radians half-width

export default function Game043_Lighthouse() {
	const [beam, setBeam] = useState(0);
	const beamRef = useRef(0);
	const aimRef = useRef(0);
	const [ships, setShips] = useState<Ship[]>([]);
	const shipsRef = useRef<Ship[]>([]);
	const [saved, setSaved] = useState(0);
	const [crashed, setCrashed] = useState(0);
	const [time, setTime] = useState(60);
	const [over, setOver] = useState(false);
	const lastT = useRef(0);
	const spawnT = useRef(0);
	const nextId = useRef(1);

	useEffect(() => {
		shipsRef.current = ships;
	}, [ships]);

	useEffect(() => {
		let raf = 0;
		const step = (t: number) => {
			if (!lastT.current) lastT.current = t;
			const dt = Math.min(0.05, (t - lastT.current) / 1000);
			lastT.current = t;
			if (!over) {
				// rotate beam toward aim
				let diff = aimRef.current - beamRef.current;
				while (diff > Math.PI) diff -= 2 * Math.PI;
				while (diff < -Math.PI) diff += 2 * Math.PI;
				const maxSpd = 2.5; // rad/sec
				beamRef.current += Math.max(-maxSpd * dt, Math.min(maxSpd * dt, diff));
				setBeam(beamRef.current);

				// spawn ships
				spawnT.current -= dt;
				if (spawnT.current <= 0) {
					spawnT.current = 1.2 + Math.random() * 1.5;
					const angle = Math.random() * Math.PI * 2;
					shipsRef.current = [
						...shipsRef.current,
						{
							id: nextId.current++,
							angle,
							dist: 280,
							warned: false,
							saved: false,
							crashed: false,
							speed: 25 + Math.random() * 15,
						},
					];
				}
				// update ships
				let dSaved = 0;
				let dCrashed = 0;
				const newShips = shipsRef.current
					.map((s) => {
						if (s.saved || s.crashed) return s;
						// beam illuminates if angle within beam cone
						let angDiff = ((s.angle - beamRef.current) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
						if (angDiff > Math.PI) angDiff -= 2 * Math.PI;
						const inBeam = Math.abs(angDiff) < BEAM_WIDTH;
						let dist = s.dist;
						let warned = s.warned;
						if (inBeam) {
							warned = true;
						}
						if (warned) {
							// ship retreats
							dist += s.speed * 0.7 * dt;
							if (dist > 320) {
								dSaved += 1;
								return { ...s, dist, warned, saved: true };
							}
						} else {
							dist -= s.speed * dt;
							if (dist <= ROCK_RADIUS) {
								dCrashed += 1;
								return { ...s, dist: ROCK_RADIUS, crashed: true };
							}
						}
						return { ...s, dist, warned };
					})
					.filter((s) => !(s.saved && s.dist > 360) && !(s.crashed && Math.random() < 0.01));
				shipsRef.current = newShips;
				setShips(newShips);
				if (dSaved) setSaved((v) => v + dSaved);
				if (dCrashed) setCrashed((v) => v + dCrashed);

				setTime((tt) => {
					const nt = tt - dt;
					if (nt <= 0) {
						setOver(true);
						return 0;
					}
					return nt;
				});
			}
			raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
		return () => cancelAnimationFrame(raf);
	}, [over]);

	const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
		const rect = e.currentTarget.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		const my = e.clientY - rect.top;
		aimRef.current = Math.atan2(my - CY, mx - CX);
	};

	const reset = () => {
		shipsRef.current = [];
		setShips([]);
		setSaved(0);
		setCrashed(0);
		setTime(60);
		setOver(false);
		lastT.current = 0;
		spawnT.current = 0;
	};

	return (
		<div
			style={{
				width: "100%",
				height: "100%",
				background: "#040a18",
				color: "#cde",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "system-ui, sans-serif",
				userSelect: "none",
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between", width: W, padding: "4px 8px" }}>
				<div>
					<strong>Lighthouse</strong>
					<span style={{ opacity: 0.7, marginLeft: 10 }}>
						Move mouse to aim the beam. Light ships to turn them back.
					</span>
				</div>
				<div>
					Saved: {saved} · Crashed: {crashed} · Time: {time.toFixed(1)}s
				</div>
			</div>
			<svg
				width={W}
				height={H}
				onMouseMove={onMove}
				style={{ background: "linear-gradient(#01040c,#02091a)", cursor: "crosshair" }}
			>
				{/* sea horizon */}
				<rect x={0} y={H - 80} width={W} height={80} fill="#031628" />
				{/* rocks ring */}
				<circle cx={CX} cy={CY} r={ROCK_RADIUS} fill="#2a2820" stroke="#3a342a" />
				{Array.from({ length: 14 }).map((_, i) => {
					const a = (i / 14) * Math.PI * 2;
					return (
						<circle
							key={i}
							cx={CX + Math.cos(a) * ROCK_RADIUS}
							cy={CY + Math.sin(a) * ROCK_RADIUS}
							r={8 + (i % 3) * 3}
							fill="#3a3328"
						/>
					);
				})}
				{/* beam */}
				<path
					d={`M ${CX} ${CY} L ${CX + Math.cos(beam - BEAM_WIDTH) * 600} ${
						CY + Math.sin(beam - BEAM_WIDTH) * 600
					} A 600 600 0 0 1 ${CX + Math.cos(beam + BEAM_WIDTH) * 600} ${
						CY + Math.sin(beam + BEAM_WIDTH) * 600
					} Z`}
					fill="url(#beamGrad)"
					opacity={0.5}
				/>
				<defs>
					<radialGradient id="beamGrad" cx={CX} cy={CY} r={600} gradientUnits="userSpaceOnUse">
						<stop offset="0" stopColor="#ffe7a0" stopOpacity={0.9} />
						<stop offset="1" stopColor="#ffe7a0" stopOpacity={0} />
					</radialGradient>
				</defs>
				{/* lighthouse */}
				<rect x={CX - 12} y={CY - 30} width={24} height={36} fill="#888" />
				<circle cx={CX} cy={CY - 30} r={6} fill="#ffe080" />
				{/* ships */}
				{ships.map((s) => {
					const sx = CX + Math.cos(s.angle) * s.dist;
					const sy = CY + Math.sin(s.angle) * s.dist;
					return (
						<g key={s.id} transform={`translate(${sx},${sy}) rotate(${(s.angle * 180) / Math.PI})`}>
							<polygon
								points="-10,-5 10,0 -10,5"
								fill={s.crashed ? "#f44" : s.saved ? "#4a4" : s.warned ? "#fc4" : "#abc"}
							/>
						</g>
					);
				})}
			</svg>
			{over && (
				<div style={{ marginTop: 12 }}>
					<strong>Time up.</strong> Final score:{" "}
					<span style={{ color: "#fc4" }}>{saved - crashed * 2}</span> (saved {saved}, crashed {crashed})
					<button type="button" onClick={reset} style={btn}>
						Play again
					</button>
				</div>
			)}
		</div>
	);
}

const btn: React.CSSProperties = {
	background: "#2a3045",
	color: "#fff",
	border: "1px solid #445",
	padding: "6px 12px",
	borderRadius: 6,
	cursor: "pointer",
	marginLeft: 12,
};
