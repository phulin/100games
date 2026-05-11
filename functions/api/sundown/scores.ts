interface Env {
	DB: D1Database;
}

const MAX_HANDLE_LEN = 20;
const MAX_AUTHOR_LEN = 128;
const MAX_OFFSET_ABS = 60000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Histogram: 11 buckets across -500..+500 with overflow on the ends.
// Buckets centered every 100ms: [-Inf,-450), [-450,-350), [-350,-250),
// [-250,-150), [-150,-50), [-50,+50), [+50,+150), [+150,+250),
// [+250,+350), [+350,+450), [+450,+Inf).
const BUCKET_COUNT = 11;
const BUCKET_WIDTH = 100;
const BUCKET_CENTERS = Array.from(
	{ length: BUCKET_COUNT },
	(_, i) => (i - 5) * BUCKET_WIDTH,
);

function bucketFor(offset_ms: number): number {
	// Map offset to nearest center index, clamped to [0, BUCKET_COUNT-1].
	const idx = Math.round(offset_ms / BUCKET_WIDTH) + 5;
	if (idx < 0) return 0;
	if (idx > BUCKET_COUNT - 1) return BUCKET_COUNT - 1;
	return idx;
}

function todayUTC(): string {
	const d = new Date();
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

export const onRequest: PagesFunction<Env> = async (context) => {
	const { request, env } = context;
	const url = new URL(request.url);

	if (request.method === "GET") {
		const day = url.searchParams.get("day") || todayUTC();
		if (!DAY_RE.test(day)) {
			return json({ error: "invalid 'day' format, want YYYY-MM-DD" }, 400);
		}
		try {
			const lbRes = await env.DB.prepare(
				"SELECT handle, author, offset_ms, abs_offset_ms, created_at FROM sundown_scores WHERE day = ?1 ORDER BY abs_offset_ms ASC, created_at ASC LIMIT 20",
			)
				.bind(day)
				.all<{
					handle: string;
					author: string;
					offset_ms: number;
					abs_offset_ms: number;
					created_at: number;
				}>();

			const allRes = await env.DB.prepare(
				"SELECT offset_ms FROM sundown_scores WHERE day = ?1",
			)
				.bind(day)
				.all<{ offset_ms: number }>();

			const counts = new Array<number>(BUCKET_COUNT).fill(0);
			for (const r of allRes.results ?? []) {
				counts[bucketFor(r.offset_ms)]++;
			}

			return json({
				day,
				leaderboard: (lbRes.results ?? []).map((r, i) => ({
					rank: i + 1,
					handle: r.handle,
					offset_ms: r.offset_ms,
					abs_offset_ms: r.abs_offset_ms,
					created_at: r.created_at,
				})),
				histogram: {
					bucket_width_ms: BUCKET_WIDTH,
					centers_ms: BUCKET_CENTERS,
					counts,
					total: (allRes.results ?? []).length,
				},
			});
		} catch (e) {
			return json({ error: "db error", detail: String(e) }, 500);
		}
	}

	if (request.method === "POST") {
		let body: any;
		try {
			body = await request.json();
		} catch {
			return json({ error: "invalid JSON" }, 400);
		}
		const day = typeof body?.day === "string" ? body.day : null;
		const offset_ms = body?.offset_ms;
		const author = typeof body?.author === "string" ? body.author : "";
		const rawHandle = typeof body?.handle === "string" ? body.handle : "";
		const handle = rawHandle.trim().slice(0, MAX_HANDLE_LEN) || "anon";

		if (!day || !DAY_RE.test(day)) {
			return json({ error: "missing or invalid 'day'" }, 400);
		}
		if (day !== todayUTC()) {
			return json({ error: "'day' must match today UTC" }, 400);
		}
		if (
			!Number.isInteger(offset_ms) ||
			Math.abs(offset_ms) >= MAX_OFFSET_ABS
		) {
			return json(
				{ error: "'offset_ms' must be integer with |offset| < 60000" },
				400,
			);
		}
		if (!author || author.length === 0 || author.length > MAX_AUTHOR_LEN) {
			return json({ error: "missing or invalid 'author'" }, 400);
		}
		const abs_offset_ms = Math.abs(offset_ms);
		const created_at = Date.now();

		try {
			// UPSERT keeping best (lowest abs_offset_ms).
			await env.DB.prepare(
				`INSERT INTO sundown_scores (day, author, handle, offset_ms, abs_offset_ms, created_at)
				 VALUES (?1, ?2, ?3, ?4, ?5, ?6)
				 ON CONFLICT(day, author) DO UPDATE SET
				   handle = excluded.handle,
				   offset_ms = excluded.offset_ms,
				   abs_offset_ms = excluded.abs_offset_ms,
				   created_at = excluded.created_at
				 WHERE excluded.abs_offset_ms < sundown_scores.abs_offset_ms`,
			)
				.bind(day, author, handle, offset_ms, abs_offset_ms, created_at)
				.run();

			const best = await env.DB.prepare(
				"SELECT offset_ms, abs_offset_ms FROM sundown_scores WHERE day = ?1 AND author = ?2",
			)
				.bind(day, author)
				.first<{ offset_ms: number; abs_offset_ms: number }>();

			return json({
				ok: true,
				day,
				submitted: { offset_ms, abs_offset_ms },
				best,
			});
		} catch (e) {
			return json({ error: "db error", detail: String(e) }, 500);
		}
	}

	return json({ error: "method not allowed" }, 405);
};
