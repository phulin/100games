import { Link, Route, Routes, useParams } from "react-router-dom";
import "./App.css";
import { GAMES } from "./gamesIndex";

const getRandomGradient = (index: number) => {
	const hues = [
		[348, 83, 58],
		[267, 73, 60],
		[200, 90, 50],
		[160, 65, 50],
		[35, 90, 55],
		[320, 80, 55],
		[230, 80, 65],
	];
	const baseHue = hues[index % hues.length];
	const h1 = (baseHue[0] + ((index * 17) % 30)) % 360;
	const h2 = (h1 + 45 + ((index * 11) % 40)) % 360;
	return {
		"--gradient-start": `hsl(${h1}, ${baseHue[1]}%, ${baseHue[2]}%)`,
		"--gradient-end": `hsl(${h2}, ${baseHue[1]}%, ${baseHue[2] - 15}%)`,
	} as React.CSSProperties;
};

function Gallery() {
	return (
		<div className="gallery-container">
			<h1 className="gallery-header">100 Games</h1>
			<div className="gallery-grid">
				{GAMES.map((game, i) => (
					<Link
						to={`/game-${game.id}`}
						key={game.id}
						className="app-card"
						style={getRandomGradient(i)}
					>
						<span className="app-number">{game.id}</span>
						<span className="app-title">{game.name}</span>
					</Link>
				))}
			</div>
		</div>
	);
}

function GamePage() {
	const { gameId } = useParams<{ gameId: string }>();
	const id = Number(gameId?.replace(/\D/g, ""));
	const entry = GAMES.find((g) => g.id === id);
	if (!entry) {
		return (
			<div style={{ color: "white", padding: "2rem" }}>
				<Link to="/" style={{ color: "white" }}>
					← back
				</Link>
				<h2>Not found</h2>
			</div>
		);
	}
	const Component = entry.Component;
	return (
		<div style={{ minHeight: "100vh", background: "#0f0f14", color: "white" }}>
			<div
				style={{
					padding: "0.75rem 1rem",
					display: "flex",
					gap: "1rem",
					alignItems: "center",
					borderBottom: "1px solid #222",
				}}
			>
				<Link to="/" style={{ color: "white", textDecoration: "none" }}>
					← back
				</Link>
				<span style={{ opacity: 0.6 }}>#{entry.id}</span>
				<strong>{entry.name}</strong>
			</div>
			<div style={{ padding: "1rem" }}>
				<Component />
			</div>
		</div>
	);
}

function App() {
	return (
		<Routes>
			<Route path="/" element={<Gallery />} />
			<Route path="/game-:gameId" element={<GamePage />} />
		</Routes>
	);
}

export default App;
