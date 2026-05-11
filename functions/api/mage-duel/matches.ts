interface Env {
	DB: D1Database;
}

interface MatchRow {
	id: number;
	challenger: string;
	challenger_seq: string;
	defender: string | null;
	defender_seq: string | null;
	result: "challenger_win" | "defender_win" | "draw" | null;
	created_at: number;
	resolved_at: number | null;
}

const ELEMENT_COUNT = 7;
const MAX_ROUNDS = 9;
const MIN_ROUNDS = 1;
const LIST_LIMIT = 30;

function sanitizeAuthor(input: unknown): string | null {
	if (typeof input !== "string") return null;
	const clean = input.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
	return clean.length > 0 ? clean : null;
}

function sanitizeSeq(input: unknown): number[] | null {
	if (!Array.isArray(input)) return null;
	if (input.length < MIN_ROUNDS || input.length > MAX_ROUNDS) return null;
	const out: number[] = [];
	for (const v of input) {
		if (typeof v !== "number" || !Number.isFinite(v)) return null;
		const n = Math.floor(v);
		if (n < 0 || n >= ELEMENT_COUNT) return null;
		out.push(n);
	}
	return out;
}

// a beats b if (b - a) mod 7 is in {1,2,3}.
function beats(a: number, b: number): "a" | "b" | "tie" {
	if (a === b) return "tie";
	const diff = (b - a + ELEMENT_COUNT) % ELEMENT_COUNT;
	if (diff >= 1 && diff <= 3) return "a";
	return "b";
}

function resolveSequences(
	challengerSeq: number[],
	defenderSeq: number[],
): "challenger_win" | "defender_win" | "draw" {
	const rounds = Math.min(challengerSeq.length, defenderSeq.length);
	let cWins = 0;
	let dWins = 0;
	let lastOutcome: "a" | "b" | "tie" | null = null;
	for (let i = 0; i < rounds; i++) {
		// Treat challenger as "a", defender as "b". beats(a,b) returns "a" if challenger wins.
		const outcome = beats(challengerSeq[i], defenderSeq[i]);
		const cascade =
			lastOutcome === outcome && outcome !== "tie" ? 2 : 1;
		if (outcome === "a") cWins += cascade;
		else if (outcome === "b") dWins += cascade;
		lastOutcome = outcome;
	}
	if (cWins > dWins) return "challenger_win";
	if (dWins > cWins) return "defender_win";
	return "draw";
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

function publicMatch(row: MatchRow, hideChallengerSeq: boolean) {
	return {
		id: row.id,
		challenger: row.challenger,
		challenger_seq: hideChallengerSeq ? null : row.challenger_seq,
		defender: row.defender,
		defender_seq: row.defender_seq,
		result: row.result,
		created_at: row.created_at,
		resolved_at: row.resolved_at,
		rounds: (() => {
			try {
				const parsed = JSON.parse(row.challenger_seq);
				return Array.isArray(parsed) ? parsed.length : 0;
			} catch {
				return 0;
			}
		})(),
	};
}

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, env } = context;

	if (!env.DB) {
		return jsonResponse({ error: "Database not bound" }, 500);
	}

	try {
		if (request.method === "POST") {
			let body: {
				action?: unknown;
				author?: unknown;
				challenger_seq?: unknown;
				defender_seq?: unknown;
				match_id?: unknown;
			};
			try {
				body = await request.json();
			} catch {
				return jsonResponse({ error: "Invalid JSON" }, 400);
			}

			const action = typeof body.action === "string" ? body.action : "";

			if (action === "create") {
				const author = sanitizeAuthor(body.author);
				const seq = sanitizeSeq(body.challenger_seq);
				if (!author) {
					return jsonResponse({ error: "author is required" }, 400);
				}
				if (!seq) {
					return jsonResponse({ error: "challenger_seq invalid" }, 400);
				}
				const createdAt = Date.now();
				const insert = await env.DB.prepare(
					"INSERT INTO mage_matches (challenger, challenger_seq, created_at) VALUES (?, ?, ?)",
				)
					.bind(author, JSON.stringify(seq), createdAt)
					.run();
				const id = insert.meta?.last_row_id ?? 0;
				return jsonResponse(
					{
						match: {
							id,
							challenger: author,
							rounds: seq.length,
							created_at: createdAt,
						},
					},
					201,
				);
			}

			if (action === "open") {
				const author = sanitizeAuthor(body.author);
				const rows = await env.DB.prepare(
					"SELECT id, challenger, challenger_seq, defender, defender_seq, result, created_at, resolved_at FROM mage_matches WHERE resolved_at IS NULL AND challenger != ? ORDER BY id DESC LIMIT ?",
				)
					.bind(author ?? "", LIST_LIMIT)
					.all<MatchRow>();
				const matches = (rows.results ?? []).map((r) => publicMatch(r, true));
				return jsonResponse({ matches });
			}

			if (action === "play") {
				const author = sanitizeAuthor(body.author);
				const seq = sanitizeSeq(body.defender_seq);
				const matchId =
					typeof body.match_id === "number" && Number.isFinite(body.match_id)
						? Math.floor(body.match_id)
						: null;
				if (!author) {
					return jsonResponse({ error: "author is required" }, 400);
				}
				if (!seq) {
					return jsonResponse({ error: "defender_seq invalid" }, 400);
				}
				if (matchId === null || matchId <= 0) {
					return jsonResponse({ error: "match_id is required" }, 400);
				}

				const row = await env.DB.prepare(
					"SELECT id, challenger, challenger_seq, defender, defender_seq, result, created_at, resolved_at FROM mage_matches WHERE id = ?",
				)
					.bind(matchId)
					.first<MatchRow>();
				if (!row) {
					return jsonResponse({ error: "Match not found" }, 404);
				}
				if (row.resolved_at !== null) {
					return jsonResponse({ error: "Match already resolved" }, 409);
				}
				if (row.challenger === author) {
					return jsonResponse({ error: "Cannot answer your own challenge" }, 403);
				}

				let challengerSeq: number[];
				try {
					const parsed = JSON.parse(row.challenger_seq);
					const v = sanitizeSeq(parsed);
					if (!v) throw new Error("bad seq");
					challengerSeq = v;
				} catch {
					return jsonResponse({ error: "Stored sequence corrupt" }, 500);
				}

				if (seq.length !== challengerSeq.length) {
					return jsonResponse(
						{ error: "defender_seq length must match challenge" },
						400,
					);
				}

				const result = resolveSequences(challengerSeq, seq);
				const resolvedAt = Date.now();

				await env.DB.prepare(
					"UPDATE mage_matches SET defender = ?, defender_seq = ?, result = ?, resolved_at = ? WHERE id = ? AND resolved_at IS NULL",
				)
					.bind(author, JSON.stringify(seq), result, resolvedAt, matchId)
					.run();

				return jsonResponse({
					match: {
						id: matchId,
						challenger: row.challenger,
						challenger_seq: challengerSeq,
						defender: author,
						defender_seq: seq,
						result,
						created_at: row.created_at,
						resolved_at: resolvedAt,
					},
				});
			}

			if (action === "history") {
				const author = sanitizeAuthor(body.author);
				if (!author) {
					return jsonResponse({ error: "author is required" }, 400);
				}
				const rows = await env.DB.prepare(
					"SELECT id, challenger, challenger_seq, defender, defender_seq, result, created_at, resolved_at FROM mage_matches WHERE challenger = ? OR defender = ? ORDER BY id DESC LIMIT ?",
				)
					.bind(author, author, LIST_LIMIT)
					.all<MatchRow>();
				const matches = (rows.results ?? []).map((r) => {
					// Reveal sequences only if resolved or if requester is challenger.
					const reveal = r.resolved_at !== null || r.challenger === author;
					return publicMatch(r, !reveal);
				});
				return jsonResponse({ matches });
			}

			return jsonResponse({ error: "Unknown action" }, 400);
		}

		if (request.method === "GET") {
			// Convenience: list open matches.
			const url = new URL(request.url);
			const author = sanitizeAuthor(url.searchParams.get("author"));
			const rows = await env.DB.prepare(
				"SELECT id, challenger, challenger_seq, defender, defender_seq, result, created_at, resolved_at FROM mage_matches WHERE resolved_at IS NULL AND challenger != ? ORDER BY id DESC LIMIT ?",
			)
				.bind(author ?? "", LIST_LIMIT)
				.all<MatchRow>();
			const matches = (rows.results ?? []).map((r) => publicMatch(r, true));
			return jsonResponse({ matches });
		}

		return jsonResponse({ error: "Method not allowed" }, 405);
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return jsonResponse({ error: message }, 500);
	}
};
