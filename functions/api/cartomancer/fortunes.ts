interface Env {
	DB: D1Database;
}

interface Fortune {
	id: number;
	spread_key: string;
	text: string;
	author: string | null;
	votes: number;
	created_at: number;
}

const MAX_LEN = 400;
const LIMIT = 20;

function sanitize(input: unknown): string {
	if (typeof input !== "string") return "";
	// Strip control chars (except common whitespace like \t, \n, \r), then trim.
	const stripped = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
	const trimmed = stripped.trim();
	return trimmed.slice(0, MAX_LEN);
}

function sanitizeAuthor(input: unknown): string | null {
	if (typeof input !== "string") return null;
	const clean = input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
	return clean.length > 0 ? clean : null;
}

function sanitizeSpreadKey(input: unknown): string | null {
	if (typeof input !== "string") return null;
	const clean = input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
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
			const url = new URL(request.url);
			const spreadKey = sanitizeSpreadKey(url.searchParams.get("spread"));
			if (!spreadKey) {
				return jsonResponse({ error: "spread is required" }, 400);
			}

			const result = await env.DB.prepare(
				"SELECT id, spread_key, text, author, votes, created_at FROM cartomancer_fortunes WHERE spread_key = ? ORDER BY id DESC LIMIT ?",
			)
				.bind(spreadKey, LIMIT)
				.all<Fortune>();

			return jsonResponse({ fortunes: result.results ?? [] });
		}

		if (request.method === "POST") {
			let body: {
				action?: unknown;
				spread_key?: unknown;
				text?: unknown;
				author?: unknown;
				fortune_id?: unknown;
			};
			try {
				body = await request.json();
			} catch {
				return jsonResponse({ error: "Invalid JSON" }, 400);
			}

			const action = typeof body.action === "string" ? body.action : "create";

			if (action === "vote") {
				const fortuneId =
					typeof body.fortune_id === "number" && Number.isFinite(body.fortune_id)
						? Math.floor(body.fortune_id)
						: null;
				const author = sanitizeAuthor(body.author);
				if (fortuneId === null || fortuneId <= 0) {
					return jsonResponse({ error: "fortune_id is required" }, 400);
				}
				if (!author) {
					return jsonResponse({ error: "author is required to vote" }, 400);
				}

				const createdAt = Date.now();
				// Insert into vote-tracking table; ignore if already voted.
				const voteInsert = await env.DB.prepare(
					"INSERT OR IGNORE INTO cartomancer_votes (fortune_id, author, created_at) VALUES (?, ?, ?)",
				)
					.bind(fortuneId, author, createdAt)
					.run();

				const changes = voteInsert.meta?.changes ?? 0;
				if (changes > 0) {
					await env.DB.prepare(
						"UPDATE cartomancer_fortunes SET votes = votes + 1 WHERE id = ?",
					)
						.bind(fortuneId)
						.run();
				}

				const row = await env.DB.prepare(
					"SELECT id, spread_key, text, author, votes, created_at FROM cartomancer_fortunes WHERE id = ?",
				)
					.bind(fortuneId)
					.first<Fortune>();

				if (!row) {
					return jsonResponse({ error: "Fortune not found" }, 404);
				}

				return jsonResponse({ fortune: row, counted: changes > 0 });
			}

			// Default action: create
			const spreadKey = sanitizeSpreadKey(body.spread_key);
			const text = sanitize(body.text);
			if (!spreadKey) {
				return jsonResponse({ error: "spread_key is required" }, 400);
			}
			if (!text) {
				return jsonResponse({ error: "text is required" }, 400);
			}
			if (text.length > MAX_LEN) {
				return jsonResponse({ error: `text exceeds ${MAX_LEN} characters` }, 400);
			}

			const author = sanitizeAuthor(body.author);
			const createdAt = Date.now();

			const insert = await env.DB.prepare(
				"INSERT INTO cartomancer_fortunes (spread_key, text, author, votes, created_at) VALUES (?, ?, ?, 0, ?)",
			)
				.bind(spreadKey, text, author, createdAt)
				.run();

			const id = insert.meta?.last_row_id ?? 0;
			const fortune: Fortune = {
				id: typeof id === "number" ? id : 0,
				spread_key: spreadKey,
				text,
				author,
				votes: 0,
				created_at: createdAt,
			};

			return jsonResponse({ fortune }, 201);
		}

		return jsonResponse({ error: "Method not allowed" }, 405);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return jsonResponse({ error: message }, 500);
	}
};
