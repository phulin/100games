import { useCallback, useEffect, useRef, useState } from "react";

// Game 51: Lost Letter
// Guide a paper letter through the wind to reach the mailbox.
// Improvements:
//   1. Seeded procedural levels (daily seed + level index), no Math.random in gameplay
//   2. WebAudio: ambient wind hum + delivery chime + crash thud
//   3. Wind-shear ribbon zones that streak across the screen
//   4. Per-level time bonus + delivery streak combo
//   5. Pause (P), level seed shown, daily/random toggle

type Vec = { x: number; y: number };
type Gust = { x: number; y: number; vx: number; vy: number; r: number };
type Obstacle = { x: number; y: number; r: number };
type Shear = { y: number; vx: number; thickness: number; phase: number };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; ttl: number };

const W = 900;
const H = 600;

function mulberry32(a: number) {
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function todayUTCSeed(): number {
	const d = new Date();
	return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

function hash32(x: number, y: number): number {
	let h = (x ^ Math.imul(y, 0x9e3779b1)) | 0;
	h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
	h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
	return (h ^ (h >>> 16)) >>> 0;
}

export default function LostLetter() {
	const [score, setScore] = useState(0);
	const [best, setBest] = useState(() => {
		const v = localStorage.getItem("g51_best");
		return v ? parseInt(v, 10) : 0;
	});
	const [streak, setStreak] = useState(0);
	const [message, setMessage] = useState("");
	const [paused, setPaused] = useState(false);
	const [dailyMode, setDailyMode] = useState(true);
	const [runSeed, setRunSeed] = useState<number>(() => todayUTCSeed());
	const [levelInfo, setLevelInfo] = useState({ level: 1, timeLeft: 30 });
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const audioRef = useRef<AudioContext | null>(null);
	const windNodeRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);

	const stateRef = useRef({
		letter: { x: 80, y: 300 } as Vec,
		vel: { x: 0, y: 0 } as Vec,
		mail: { x: 800, y: 300 },
		gusts: [] as Gust[],
		obstacles: [] as Obstacle[],
		shears: [] as Shear[],
		particles: [] as Particle[],
		keys: {} as Record<string, boolean>,
		level: 1,
		alive: true,
		timeLeft: 30,
		runSeed: 0,
	});

	function ensureAudio() {
		if (!audioRef.current) {
			try {
				audioRef.current = new (window.AudioContext ||
					(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
			} catch {
				/* ignore */
			}
		}
		const ac = audioRef.current;
		if (ac && !windNodeRef.current) {
			const o = ac.createOscillator();
			const g = ac.createGain();
			o.type = "sawtooth";
			o.frequency.value = 60;
			g.gain.value = 0.0;
			const filt = ac.createBiquadFilter();
			filt.type = "lowpass";
			filt.frequency.value = 220;
			o.connect(filt);
			filt.connect(g);
			g.connect(ac.destination);
			o.start();
			windNodeRef.current = { osc: o, gain: g };
		}
	}

	function blip(freq: number, dur = 0.15, type: OscillatorType = "sine", vol = 0.18) {
		const ac = audioRef.current;
		if (!ac) return;
		const o = ac.createOscillator();
		const g = ac.createGain();
		o.type = type;
		o.frequency.value = freq;
		o.connect(g);
		g.connect(ac.destination);
		g.gain.setValueAtTime(0.0001, ac.currentTime);
		g.gain.exponentialRampToValueAtTime(vol, ac.currentTime + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
		o.start();
		o.stop(ac.currentTime + dur + 0.05);
	}

	function chime() {
		blip(523, 0.18);
		setTimeout(() => blip(784, 0.22), 70);
		setTimeout(() => blip(1046, 0.3), 160);
	}

	const resetLevel = useCallback((lvl: number, baseSeed: number) => {
		const s = stateRef.current;
		const rng = mulberry32((baseSeed ^ hash32(lvl, 0x51a1)) >>> 0);
		s.letter = { x: 80, y: 200 + rng() * 200 };
		s.vel = { x: 0, y: 0 };
		s.mail = { x: 760 + rng() * 60, y: 100 + rng() * 400 };
		s.gusts = Array.from({ length: 3 + lvl }, () => ({
			x: 200 + rng() * 500,
			y: 100 + rng() * 400,
			vx: (rng() - 0.5) * (1.2 + lvl * 0.15),
			vy: (rng() - 0.5) * (1.2 + lvl * 0.15),
			r: 40 + rng() * 40,
		}));
		s.obstacles = Array.from({ length: lvl + 1 }, () => ({
			x: 250 + rng() * 450,
			y: 80 + rng() * 440,
			r: 18 + rng() * 16,
		}));
		s.shears = Array.from({ length: Math.min(3, Math.floor(lvl / 2)) }, () => ({
			y: 80 + rng() * 440,
			vx: (rng() < 0.5 ? -1 : 1) * (1.0 + rng() * 1.5 + lvl * 0.1),
			thickness: 18 + rng() * 22,
			phase: rng() * Math.PI * 2,
		}));
		s.particles = [];
		s.alive = true;
		s.timeLeft = Math.max(12, 30 - lvl * 1.2);
		setLevelInfo({ level: lvl, timeLeft: s.timeLeft });
	}, []);

	const restartRun = useCallback(
		(sd: number) => {
			const s = stateRef.current;
			s.level = 1;
			s.runSeed = sd;
			setScore(0);
			setStreak(0);
			setMessage("");
			resetLevel(1, sd);
		},
		[resetLevel],
	);

	useEffect(() => {
		stateRef.current.runSeed = runSeed;
		restartRun(runSeed);
	}, [runSeed, restartRun]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent, down: boolean) => {
			stateRef.current.keys[e.key.toLowerCase()] = down;
			if (down && e.key.toLowerCase() === "p") setPaused((p) => !p);
		};
		const kd = (e: KeyboardEvent) => onKey(e, true);
		const ku = (e: KeyboardEvent) => onKey(e, false);
		window.addEventListener("keydown", kd);
		window.addEventListener("keyup", ku);
		return () => {
			window.removeEventListener("keydown", kd);
			window.removeEventListener("keyup", ku);
			windNodeRef.current?.osc.stop();
			windNodeRef.current = null;
			audioRef.current?.close().catch(() => {});
			audioRef.current = null;
		};
	}, []);

	useEffect(() => {
		let raf = 0;
		let last = performance.now();
		const tick = (now: number) => {
			const dt = Math.min(40, now - last);
			last = now;
			const ctx = canvasRef.current?.getContext("2d");
			if (!ctx) {
				raf = requestAnimationFrame(tick);
				return;
			}
			const s = stateRef.current;
			const f = dt / 16;

			if (!paused && s.alive) {
				const k = s.keys;
				const ax = (k["arrowright"] || k["d"] ? 1 : 0) - (k["arrowleft"] || k["a"] ? 1 : 0);
				const ay = (k["arrowdown"] || k["s"] ? 1 : 0) - (k["arrowup"] || k["w"] ? 1 : 0);
				s.vel.x += ax * 0.12 * f;
				s.vel.y += ay * 0.12 * f;

				for (const g of s.gusts) {
					const dx = s.letter.x - g.x;
					const dy = s.letter.y - g.y;
					const d = Math.hypot(dx, dy);
					if (d < g.r) {
						const ff = (g.r - d) / g.r;
						s.vel.x += g.vx * ff * 0.3 * f;
						s.vel.y += g.vy * ff * 0.3 * f;
					}
					g.x += g.vx * f;
					g.y += g.vy * f;
					if (g.x < 100 || g.x > 800) g.vx *= -1;
					if (g.y < 50 || g.y > 550) g.vy *= -1;
				}

				for (const sh of s.shears) {
					sh.phase += 0.03 * f;
					if (Math.abs(s.letter.y - sh.y) < sh.thickness) {
						s.vel.x += sh.vx * 0.08 * f;
					}
				}

				s.vel.x *= Math.pow(0.97, f);
				s.vel.y *= Math.pow(0.97, f);
				s.letter.x += s.vel.x * f;
				s.letter.y += s.vel.y * f;

				if (Math.hypot(s.vel.x, s.vel.y) > 0.3 && s.particles.length < 80) {
					s.particles.push({
						x: s.letter.x,
						y: s.letter.y,
						vx: -s.vel.x * 0.2,
						vy: -s.vel.y * 0.2,
						life: 0,
						ttl: 0.6,
					});
				}

				if (s.letter.x < 10 || s.letter.x > W - 10 || s.letter.y < 10 || s.letter.y > H - 10) {
					s.alive = false;
					setMessage("Letter blown away! Press R to restart.");
					blip(110, 0.4, "sawtooth", 0.22);
					setStreak(0);
				}
				for (const o of s.obstacles) {
					if (Math.hypot(s.letter.x - o.x, s.letter.y - o.y) < o.r + 8) {
						s.alive = false;
						setMessage("Letter caught in branches! Press R to restart.");
						blip(85, 0.5, "sawtooth", 0.22);
						setStreak(0);
					}
				}

				if (Math.hypot(s.letter.x - s.mail.x, s.letter.y - s.mail.y) < 30) {
					const tBonus = Math.max(0, Math.round(s.timeLeft * 2));
					setStreak((st) => {
						const ns = st + 1;
						const mult = 1 + Math.floor(ns / 3) * 0.5;
						const gained = Math.max(1, Math.round((10 + tBonus) * mult));
						setScore((sc) => {
							const newSc = sc + gained;
							setBest((b) => {
								const nb = Math.max(b, newSc);
								localStorage.setItem("g51_best", String(nb));
								return nb;
							});
							return newSc;
						});
						setMessage(`Delivered! +${gained} (x${mult.toFixed(1)})`);
						return ns;
					});
					chime();
					s.level += 1;
					resetLevel(s.level, s.runSeed);
				}

				s.timeLeft -= dt / 1000;
				if (s.timeLeft <= 0 && s.alive) {
					s.alive = false;
					setMessage("Out of time! Press R to restart.");
					blip(120, 0.5, "sawtooth", 0.22);
					setStreak(0);
				}

				for (const pt of s.particles) {
					pt.x += pt.vx * f;
					pt.y += pt.vy * f;
					pt.life += dt / 1000;
				}
				s.particles = s.particles.filter((p) => p.life < p.ttl);

				const w = windNodeRef.current;
				if (w && audioRef.current) {
					const speed = Math.hypot(s.vel.x, s.vel.y);
					const target = Math.min(0.08, speed * 0.04);
					w.gain.gain.setTargetAtTime(target, audioRef.current.currentTime, 0.1);
				}

				setLevelInfo({ level: s.level, timeLeft: s.timeLeft });
			}

			if (s.keys["r"]) {
				restartRun(s.runSeed);
			}

			ctx.fillStyle = "#0d1b2a";
			ctx.fillRect(0, 0, W, H);

			for (const sh of s.shears) {
				ctx.fillStyle = "rgba(180,220,255,0.08)";
				ctx.fillRect(0, sh.y - sh.thickness, W, sh.thickness * 2);
				ctx.strokeStyle = "rgba(180,220,255,0.35)";
				ctx.beginPath();
				for (let xx = 0; xx < W; xx += 20) {
					const yy = sh.y + Math.sin(xx * 0.02 + sh.phase) * 4;
					if (xx === 0) ctx.moveTo(xx, yy);
					else ctx.lineTo(xx, yy);
				}
				ctx.stroke();
			}

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

			ctx.fillStyle = "#c8553d";
			ctx.fillRect(s.mail.x - 18, s.mail.y - 12, 36, 24);
			ctx.fillStyle = "#fff";
			ctx.fillRect(s.mail.x - 4, s.mail.y - 2, 8, 4);
			ctx.strokeStyle = "#3a2218";
			ctx.beginPath();
			ctx.moveTo(s.mail.x, s.mail.y + 12);
			ctx.lineTo(s.mail.x, s.mail.y + 40);
			ctx.stroke();

			for (const pt of s.particles) {
				const a = 1 - pt.life / pt.ttl;
				ctx.fillStyle = `rgba(255,248,231,${a * 0.4})`;
				ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
			}

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

			if (paused) {
				ctx.fillStyle = "rgba(0,0,0,0.5)";
				ctx.fillRect(0, 0, W, H);
				ctx.fillStyle = "#fff";
				ctx.font = "bold 36px Georgia, serif";
				ctx.textAlign = "center";
				ctx.fillText("Paused (P)", W / 2, H / 2);
				ctx.textAlign = "start";
			}

			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	}, [resetLevel, restartRun, paused]);

	const seedLabel = dailyMode ? `Daily ${runSeed}` : `Seed ${runSeed}`;

	return (
		<div style={{ background: "#06101a", color: "#e8eaf0", padding: 12, fontFamily: "Georgia, serif" }}>
			<h2 style={{ margin: 0 }}>Lost Letter</h2>
			<div style={{ fontSize: 13, opacity: 0.8 }}>
				Arrow keys / WASD to fly the letter through the wind to the red mailbox. Avoid tree-knots and shear ribbons. R to restart, P to pause.
			</div>
			<div style={{ display: "flex", gap: 16, marginTop: 4, alignItems: "center", flexWrap: "wrap" }}>
				<div>Delivered: {score}</div>
				<div>Best: {best}</div>
				<div>Streak: {streak}</div>
				<div>Level: {levelInfo.level}</div>
				<div>Time: {levelInfo.timeLeft.toFixed(1)}s</div>
				<div style={{ opacity: 0.7 }}>{seedLabel}</div>
				<button
					type="button"
					onClick={() => {
						setDailyMode(true);
						setRunSeed(todayUTCSeed());
					}}
					style={{ background: "#34506a", color: "#fff", border: 0, padding: "2px 8px", borderRadius: 4 }}
				>
					Daily
				</button>
				<button
					type="button"
					onClick={() => {
						setDailyMode(false);
						setRunSeed(Math.floor(Math.random() * 0x7fffffff));
					}}
					style={{ background: "#6a3a8a", color: "#fff", border: 0, padding: "2px 8px", borderRadius: 4 }}
				>
					New Seed
				</button>
				<div style={{ color: "#ffb86b" }}>{message}</div>
			</div>
			<canvas
				ref={canvasRef}
				width={W}
				height={H}
				onClick={ensureAudio}
				style={{ display: "block", marginTop: 8, borderRadius: 6, boxShadow: "0 0 30px #000a" }}
			/>
		</div>
	);
}
