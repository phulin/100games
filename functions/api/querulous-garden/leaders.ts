interface Env {
	DB: D1Database;
}

interface Leader {
	player: string;
	score: number;
	seed: number;
	created_at: number;
}

function sanitizePlayer(input: unknown): string | null {
	if (typeof input !== "string") return null;
	const clean = input.replace(/[^a-zA-Z0-9_\- ]/g, "").trim().slice(0, 64);
	return clean.length > 0 ? clean : null;
}

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
			"cache-control": "no-store",
		},
	});
}

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, env } = context;

	if (!env.DB) {
		return jsonResponse({ error: "Database not bound" }, 500);
	}

	try {
		if (request.method === "GET") {
			// Return top 10 scores (best-per-player), ranked by score desc then earliest.
			const rows = await env.DB.prepare(
				`SELECT player, MAX(score) AS score, seed, MIN(created_at) AS created_at
				 FROM querulous_garden_scores
				 GROUP BY player
				 ORDER BY score DESC, created_at ASC
				 LIMIT 10`,
			).all<Leader>();

			return jsonResponse({ leaders: rows.results ?? [] });
		}

		if (request.method === "POST") {
			let body: { player?: unknown; score?: unknown; seed?: unknown };
			try {
				body = await request.json();
			} catch {
				return jsonResponse({ error: "Invalid JSON" }, 400);
			}

			const player = sanitizePlayer(body.player);
			const score =
				typeof body.score === "number" ? body.score : Number(body.score);
			const seed =
				typeof body.seed === "number" ? body.seed : Number(body.seed);

			if (!player) return jsonResponse({ error: "Player required" }, 400);
			if (!Number.isInteger(score) || score < 0 || score > 6) {
				return jsonResponse({ error: "Score must be 0-6" }, 400);
			}
			if (!Number.isFinite(seed)) {
				return jsonResponse({ error: "Seed required" }, 400);
			}

			const createdAt = Date.now();
			await env.DB.prepare(
				"INSERT INTO querulous_garden_scores (player, score, seed, created_at) VALUES (?, ?, ?, ?)",
			)
				.bind(player, score, Math.floor(seed), createdAt)
				.run();

			return jsonResponse({ ok: true });
		}

		return jsonResponse({ error: "Method not allowed" }, 405);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return jsonResponse({ error: message }, 500);
	}
};
