import { useCallback, useEffect, useRef, useState } from "react";

// Game 51: Lost Letter
// Guide a paper letter through the wind to reach the mailbox.

type Vec = { x: number; y: number };

const W = 900;
const H = 600;

export default function LostLetter() {
	const [score, setScore] = useState(0);
	const [best, setBest] = useState(() => {
		const v = localStorage.getItem("g51_best");
		return v ? parseInt(v, 10) : 0;
	});
	const [message, setMessage] = useState("");
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const stateRef = useRef({
		letter: { x: 80, y: 300 } as Vec,
		vel: { x: 0, y: 0 } as Vec,
		mail: { x: 800, y: 300 },
		gusts: [] as { x: number; y: number; vx: number; vy: number; r: number }[],
		obstacles: [] as { x: number; y: number; r: number }[],
		keys: {} as Record<string, boolean>,
		level: 1,
		alive: true,
	});

	const resetLevel = useCallback((lvl: number) => {
		const s = stateRef.current;
		s.letter = { x: 80, y: 300 };
		s.vel = { x: 0, y: 0 };
		s.mail = { x: 820, y: 100 + Math.random() * 400 };
		s.gusts = Array.from({ length: 3 + lvl }, () => ({
			x: 200 + Math.random() * 500,
			y: 100 + Math.random() * 400,
			vx: (Math.random() - 0.5) * 1.5,
			vy: (Math.random() - 0.5) * 1.5,
			r: 40 + Math.random() * 40,
		}));
		s.obstacles = Array.from({ length: lvl + 1 }, () => ({
			x: 250 + Math.random() * 450,
			y: 80 + Math.random() * 440,
			r: 20 + Math.random() * 15,
		}));
		s.alive = true;
	}, []);

	useEffect(() => {
		resetLevel(1);
		const onKey = (e: KeyboardEvent, down: boolean) => {
			stateRef.current.keys[e.key.toLowerCase()] = down;
		};
		const kd = (e: KeyboardEvent) => onKey(e, true);
		const ku = (e: KeyboardEvent) => onKey(e, false);
		window.addEventListener("keydown", kd);
		window.addEventListener("keyup", ku);
		return () => {
			window.removeEventListener("keydown", kd);
			window.removeEventListener("keyup", ku);
		};
	}, [resetLevel]);

	useEffect(() => {
		let raf = 0;
		const tick = () => {
			const ctx = canvasRef.current?.getContext("2d");
			if (!ctx) {
				raf = requestAnimationFrame(tick);
				return;
			}
			const s = stateRef.current;

			// Input thrust
			const k = s.keys;
			const ax = (k["arrowright"] || k["d"] ? 1 : 0) - (k["arrowleft"] || k["a"] ? 1 : 0);
			const ay = (k["arrowdown"] || k["s"] ? 1 : 0) - (k["arrowup"] || k["w"] ? 1 : 0);
			s.vel.x += ax * 0.12;
			s.vel.y += ay * 0.12;

			// Gust influence
			for (const g of s.gusts) {
				const dx = s.letter.x - g.x;
				const dy = s.letter.y - g.y;
				const d = Math.hypot(dx, dy);
				if (d < g.r) {
					const f = (g.r - d) / g.r;
					s.vel.x += g.vx * f * 0.3;
					s.vel.y += g.vy * f * 0.3;
				}
				g.x += g.vx;
				g.y += g.vy;
				if (g.x < 100 || g.x > 800) g.vx *= -1;
				if (g.y < 50 || g.y > 550) g.vy *= -1;
			}
			// Drag
			s.vel.x *= 0.97;
			s.vel.y *= 0.97;
			s.letter.x += s.vel.x;
			s.letter.y += s.vel.y;

			// Walls
			if (s.letter.x < 10 || s.letter.x > W - 10 || s.letter.y < 10 || s.letter.y > H - 10) {
				s.alive = false;
				setMessage("Letter blown away! Press R to restart.");
			}

			// Obstacles
			for (const o of s.obstacles) {
				if (Math.hypot(s.letter.x - o.x, s.letter.y - o.y) < o.r + 8) {
					s.alive = false;
					setMessage("Letter caught in branches! Press R to restart.");
				}
			}

			// Mailbox
			if (Math.hypot(s.letter.x - s.mail.x, s.letter.y - s.mail.y) < 30) {
				setScore((sc) => {
					const ns = sc + 1;
					setBest((b) => {
						const nb = Math.max(b, ns);
						localStorage.setItem("g51_best", String(nb));
						return nb;
					});
					return ns;
				});
				s.level += 1;
				resetLevel(s.level);
			}

			if (k["r"]) {
				setScore(0);
				s.level = 1;
				resetLevel(1);
				setMessage("");
			}

			// Render
			ctx.fillStyle = "#0d1b2a";
			ctx.fillRect(0, 0, W, H);

			// Gusts
			for (const g of s.gusts) {
				const grd = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
				grd.addColorStop(0, "rgba(120,200,255,0.25)");
				grd.addColorStop(1, "rgba(120,200,255,0)");
				ctx.fillStyle = grd;
				ctx.beginPath();
				ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
				ctx.fill();
				ctx.strokeStyle = "rgba(180,220,255,0.5)";
				ctx.beginPath();
				ctx.moveTo(g.x, g.y);
				ctx.lineTo(g.x + g.vx * 12, g.y + g.vy * 12);
				ctx.stroke();
			}

			// Obstacles
			for (const o of s.obstacles) {
				ctx.fillStyle = "#4a3b2a";
				ctx.beginPath();
				ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#7a5b3a";
				ctx.beginPath();
				ctx.arc(o.x - 3, o.y - 3, o.r - 5, 0, Math.PI * 2);
				ctx.fill();
			}

			// Mailbox
			ctx.fillStyle = "#c8553d";
			ctx.fillRect(s.mail.x - 18, s.mail.y - 12, 36, 24);
			ctx.fillStyle = "#fff";
			ctx.fillRect(s.mail.x - 4, s.mail.y - 2, 8, 4);
			ctx.strokeStyle = "#3a2218";
			ctx.beginPath();
			ctx.moveTo(s.mail.x, s.mail.y + 12);
			ctx.lineTo(s.mail.x, s.mail.y + 40);
			ctx.stroke();

			// Letter
			if (s.alive) {
				ctx.save();
				ctx.translate(s.letter.x, s.letter.y);
				ctx.rotate(Math.atan2(s.vel.y, s.vel.x) * 0.3);
				ctx.fillStyle = "#fff8e7";
				ctx.fillRect(-12, -8, 24, 16);
				ctx.strokeStyle = "#b8997a";
				ctx.strokeRect(-12, -8, 24, 16);
				ctx.beginPath();
				ctx.moveTo(-12, -8);
				ctx.lineTo(0, 0);
				ctx.lineTo(12, -8);
				ctx.stroke();
				ctx.restore();
			}

			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [resetLevel]);

	return (
		<div style={{ background: "#06101a", color: "#e8eaf0", padding: 12, fontFamily: "Georgia, serif" }}>
			<h2 style={{ margin: 0 }}>Lost Letter</h2>
			<div style={{ fontSize: 13, opacity: 0.8 }}>
				Arrow keys / WASD to fly the letter through the wind to the red mailbox. Avoid tree-knots. R to restart.
			</div>
			<div style={{ display: "flex", gap: 16, marginTop: 4 }}>
				<div>Delivered: {score}</div>
				<div>Best: {best}</div>
				<div style={{ color: "#ffb86b" }}>{message}</div>
			</div>
			<canvas
				ref={canvasRef}
				width={W}
				height={H}
				style={{ display: "block", marginTop: 8, borderRadius: 6, boxShadow: "0 0 30px #000a" }}
			/>
		</div>
	);
}
