import pg from "pg";

const { Pool } = pg;

export default async function handler(req: Request): Promise<Response> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return new Response(JSON.stringify({ error: "DATABASE_URL not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const client = await pool.connect();
    try {
      const now = new Date().toISOString();

      // Query current portfolio holdings count
      const holdingRes = await client.query("SELECT COUNT(*) as pos_count FROM holdings");
      const posCount = parseInt(holdingRes.rows[0]?.pos_count || "0", 10);

      // Fetch latest equity baseline
      const lastSnapRes = await client.query(
        "SELECT total_nav_inr, inr_equity, usd_equity FROM equity_snapshots ORDER BY id DESC LIMIT 1"
      );
      const prevNav = parseFloat(lastSnapRes.rows[0]?.total_nav_inr || "1000000.0");
      const prevInr = parseFloat(lastSnapRes.rows[0]?.inr_equity || "1000000.0");
      const prevUsd = parseFloat(lastSnapRes.rows[0]?.usd_equity || "25000.0");
      
      // Calculate simulated MTM variation for the EOD snapshot
      const deltaPct = (Math.random() * 0.03 - 0.01);
      const newNav = prevNav * (1 + deltaPct);
      const newInr = prevInr * (1 + deltaPct);
      const newUsd = prevUsd * (1 + deltaPct);
      const dailyReturnPct = deltaPct * 100;
      const drawdownPct = Math.max(0, ((1000000.0 - newNav) / 1000000.0) * 100);

      await client.query(`
        INSERT INTO equity_snapshots (timestamp, total_nav_inr, total_nav_usd, inr_equity, usd_equity, drawdown_pct, daily_return_pct)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [now, newNav, newNav / 86.5, newInr, newUsd, drawdownPct, dailyReturnPct]);

      return new Response(JSON.stringify({
        status: "success",
        function: "eod-equity-snapshot",
        timestamp: now,
        total_nav_inr: newNav,
        inr_equity: newInr,
        usd_equity: newUsd,
        daily_return_pct: dailyReturnPct,
        drawdown_pct: drawdownPct,
        open_positions: posCount
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return new Response(JSON.stringify({
      error: "Execution failed",
      message: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  } finally {
    await pool.end();
  }
}
