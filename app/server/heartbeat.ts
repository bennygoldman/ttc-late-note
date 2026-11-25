// Records how each scheduled job went, for /health.

export type Job = "alerts" | "opendata";

// Run a job, then record whether it worked. Errors are re-thrown so they
// still show up in Cloudflare's logs.
export async function withHeartbeat<T>(db: D1Database, job: Job, run: () => Promise<T>) {
  const now = new Date().toISOString();
  try {
    const result = await run();
    await db
      .prepare(
        `INSERT INTO heartbeats (job, last_run, last_ok) VALUES (?, ?, ?)
         ON CONFLICT (job) DO UPDATE SET last_run = excluded.last_run, last_ok = excluded.last_ok`,
      )
      .bind(job, now, now)
      .run();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .prepare(
        `INSERT INTO heartbeats (job, last_run, last_error) VALUES (?, ?, ?)
         ON CONFLICT (job) DO UPDATE SET last_run = excluded.last_run, last_error = excluded.last_error`,
      )
      .bind(job, now, message.slice(0, 500))
      .run();
    throw error;
  }
}
