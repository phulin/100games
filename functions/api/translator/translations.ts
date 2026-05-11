interface Env {
	DB: D1Database;
}

interface Entry {
	id: number;
	poem_id: string;
	text: string;
	author: string | null;
	votes: number;
	created_at: number;
}

const MAX_LEN = 600;
const LIMIT = 20;

function sanitize(input: unknown): string {
	if (typeof input !== "string") return "";
	const stripped = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
	const trimmed = stripped.trim();
	return trimmed.slice(0, MAX_LEN);
}

function sanitizeAuthor(input: unknown): string | null {
	if (typeof input !== "string") return null;
	const clean = input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
	return clean.length > 0 ? clean : null;
}

function sanitizePoemId(input: unknown): string | null {
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
			const poemId = sanitizePoemId(url.searchParams.get("poem"));
			if (!poemId) {
				return jsonResponse({ error: "poem is required" }, 400);
			}

			const result = await env.DB.prepare(
				"SELECT id, poem_id, text, author, votes, created_at FROM translator_entries WHERE poem_id = ? ORDER BY votes DESC, id DESC LIMIT ?",
			)
				.bind(poemId, LIMIT)
				.all<Entry>();

			return jsonResponse({ entries: result.results ?? [] });
		}

		if (request.method === "POST") {
			let body: {
				action?: unknown;
				poem_id?: unknown;
				text?: unknown;
				author?: unknown;
				entry_id?: unknown;
			};
			try {
				body = await request.json();
			} catch {
				return jsonResponse({ error: "Invalid JSON" }, 400);
			}

			const action = typeof body.action === "string" ? body.action : "create";

			if (action === "vote") {
				const entryId =
					typeof body.entry_id === "number" && Number.isFinite(body.entry_id)
						? Math.floor(body.entry_id)
						: null;
				const author = sanitizeAuthor(body.author);
				if (entryId === null || entryId <= 0) {
					return jsonResponse({ error: "entry_id is required" }, 400);
				}
				if (!author) {
					return jsonResponse({ error: "author is required to vote" }, 400);
				}

				const createdAt = Date.now();
				const voteInsert = await env.DB.prepare(
					"INSERT OR IGNORE INTO translator_votes (entry_id, author, created_at) VALUES (?, ?, ?)",
				)
					.bind(entryId, author, createdAt)
					.run();

				const changes = voteInsert.meta?.changes ?? 0;
				if (changes > 0) {
					await env.DB.prepare(
						"UPDATE translator_entries SET votes = votes + 1 WHERE id = ?",
					)
						.bind(entryId)
						.run();
				}

				const row = await env.DB.prepare(
					"SELECT id, poem_id, text, author, votes, created_at FROM translator_entries WHERE id = ?",
				)
					.bind(entryId)
					.first<Entry>();

				if (!row) {
					return jsonResponse({ error: "Entry not found" }, 404);
				}

				return jsonResponse({ entry: row, counted: changes > 0 });
			}

			// Default action: create
			const poemId = sanitizePoemId(body.poem_id);
			const text = sanitize(body.text);
			if (!poemId) {
				return jsonResponse({ error: "poem_id is required" }, 400);
			}
			if (!text) {
				return jsonResponse({ error: "text is required" }, 400);
			}
			if (text.length > MAX_LEN) {
				return jsonResponse({ error: `text exceeds ${MAX_LEN} characters` }, 400);
			}

			const author = sanitizeAuthor(body.author);
			const createdAt = Date.now();

			// Dedupe: same author + same poem + same text → return existing entry.
			if (author) {
				const existing = await env.DB.prepare(
					"SELECT id, poem_id, text, author, votes, created_at FROM translator_entries WHERE poem_id = ? AND author = ? AND text = ? LIMIT 1",
				)
					.bind(poemId, author, text)
					.first<Entry>();
				if (existing) {
					return jsonResponse({ entry: existing, deduped: true }, 200);
				}
			}

			const insert = await env.DB.prepare(
				"INSERT INTO translator_entries (poem_id, text, author, votes, created_at) VALUES (?, ?, ?, 0, ?)",
			)
				.bind(poemId, text, author, createdAt)
				.run();

			const id = insert.meta?.last_row_id ?? 0;
			const entry: Entry = {
				id: typeof id === "number" ? id : 0,
				poem_id: poemId,
				text,
				author,
				votes: 0,
				created_at: createdAt,
			};

			return jsonResponse({ entry }, 201);
		}

		return jsonResponse({ error: "Method not allowed" }, 405);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return jsonResponse({ error: message }, 500);
	}
};
