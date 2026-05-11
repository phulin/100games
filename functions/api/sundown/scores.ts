interface Env {
	DB: D1Database;
}

const MAX_HANDLE_LEN = 20;
const MAX_AUTHOR_LEN = 128;
const MAX_OFFSET_ABS = 60000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

const BUCKET_COUNT = 11;
const BUCKET_WIDTH = 100;
const BUCKET_CENTERS = Array.from(
	{ length: BUCKET_COUNT },
	(_, i) => (i - 5) * BUCKET_WIDTH,
);

function bucketFor(offset_ms: number): number {
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

function prevDay(day: string): string {
	const d = new Date(`${day}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() - 1);
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const dd = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${dd}`;
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
		const author = url.searchParams.get("author") || "";
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
				"SELECT offset_ms, abs_offset_ms FROM sundown_scores WHERE day = ?1",
			)
				.bind(day)
				.all<{ offset_ms: number; abs_offset_ms: number }>();

			const counts = new Array<number>(BUCKET_COUNT).fill(0);
			const allAbs: number[] = [];
			for (const r of allRes.results ?? []) {
				counts[bucketFor(r.offset_ms)]++;
				allAbs.push(r.abs_offset_ms);
			}

			let authorInfo: {
				rank: number | null;
				percentile: number | null;
				best_abs_offset_ms: number | null;
				current_streak: number;
				longest_streak: number;
				total_plays: number;
			} | null = null;
			if (author && author.length <= MAX_AUTHOR_LEN) {
				const myToday = await env.DB.prepare(
					"SELECT abs_offset_ms FROM sundown_scores WHERE day = ?1 AND author = ?2",
				)
					.bind(day, author)
					.first<{ abs_offset_ms: number }>();
				let stats: {
					current_streak: number;
					longest_streak: number;
					total_plays: number;
					best_abs_offset_ms: number | null;
				} | null = null;
				try {
					stats = await env.DB.prepare(
						"SELECT current_streak, longest_streak, total_plays, best_abs_offset_ms FROM sundown_author_stats WHERE author = ?1",
					)
						.bind(author)
						.first();
				} catch {
					/* table may not exist yet — ignore */
				}
				let rank: number | null = null;
				let percentile: number | null = null;
				if (myToday) {
					let better = 0;
					for (const a of allAbs) if (a < myToday.abs_offset_ms) better++;
					rank = better + 1;
					percentile =
						allAbs.length > 0
							? Math.round(((allAbs.length - better) / allAbs.length) * 100)
							: null;
				}
				authorInfo = {
					rank,
					percentile,
					best_abs_offset_ms: stats?.best_abs_offset_ms ?? null,
					current_streak: stats?.current_streak ?? 0,
					longest_streak: stats?.longest_streak ?? 0,
					total_plays: stats?.total_plays ?? 0,
				};
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
				author: authorInfo,
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

			let current_streak = 1;
			let longest_streak = 1;
			let total_plays = 1;
			let best = abs_offset_ms;
			try {
				const prior = await env.DB.prepare(
					"SELECT current_streak, longest_streak, last_day, total_plays, best_abs_offset_ms FROM sundown_author_stats WHERE author = ?1",
				)
					.bind(author)
					.first<{
						current_streak: number;
						longest_streak: number;
						last_day: string | null;
						total_plays: number;
						best_abs_offset_ms: number | null;
					}>();

				if (prior) {
					total_plays = prior.total_plays + (prior.last_day === day ? 0 : 1);
					best =
						prior.best_abs_offset_ms == null
							? abs_offset_ms
							: Math.min(prior.best_abs_offset_ms, abs_offset_ms);
					if (prior.last_day === day) {
						current_streak = prior.current_streak || 1;
						longest_streak = Math.max(prior.longest_streak, current_streak);
					} else if (prior.last_day === prevDay(day)) {
						current_streak = prior.current_streak + 1;
						longest_streak = Math.max(prior.longest_streak, current_streak);
					} else {
						current_streak = 1;
						longest_streak = Math.max(prior.longest_streak, 1);
					}
				}

				await env.DB.prepare(
					`INSERT INTO sundown_author_stats (author, handle, current_streak, longest_streak, last_day, total_plays, best_abs_offset_ms, updated_at)
					 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
					 ON CONFLICT(author) DO UPDATE SET
					   handle = excluded.handle,
					   current_streak = excluded.current_streak,
					   longest_streak = excluded.longest_streak,
					   last_day = excluded.last_day,
					   total_plays = excluded.total_plays,
					   best_abs_offset_ms = excluded.best_abs_offset_ms,
					   updated_at = excluded.updated_at`,
				)
					.bind(
						author,
						handle,
						current_streak,
						longest_streak,
						day,
						total_plays,
						best,
						created_at,
					)
					.run();
			} catch {
				/* stats table may not yet exist; non-fatal */
			}

			const bestRow = await env.DB.prepare(
				"SELECT offset_ms, abs_offset_ms FROM sundown_scores WHERE day = ?1 AND author = ?2",
			)
				.bind(day, author)
				.first<{ offset_ms: number; abs_offset_ms: number }>();

			return json({
				ok: true,
				day,
				submitted: { offset_ms, abs_offset_ms },
				best: bestRow,
				stats: {
					current_streak,
					longest_streak,
					total_plays,
					best_abs_offset_ms: best,
				},
			});
		} catch (e) {
			return json({ error: "db error", detail: String(e) }, 500);
		}
	}

	return json({ error: "method not allowed" }, 405);
};
