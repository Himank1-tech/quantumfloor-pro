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

      // Check active wealth SIPs and basket SIP schedules
      const sipRes = await client.query(
        "SELECT * FROM wealth_sips WHERE status = 'ACTIVE' LIMIT 20"
      );
      const basketRes = await client.query(
        "SELECT * FROM baskets_sip WHERE status = 'ACTIVE' LIMIT 20"
      );

      const executedSips = [];
      for (const row of sipRes.rows) {
        executedSips.push({
          sip_id: row.sip_id,
          type: "WEALTH_SIP",
          amount: row.monthly_amount,
          frequency: row.frequency,
          status: "SIMULATED_TRIGGERED"
        });
      }

      for (const row of basketRes.rows) {
        executedSips.push({
          sip_id: row.sip_id,
          type: "BASKET_SIP",
          basket_id: row.basket_id,
          amount: row.amount,
          status: "SIMULATED_TRIGGERED"
        });
      }

      // Record audit entry for the scheduler run matching audit_logs schema
      const auditLogId = `AUD-SCHED-${Date.now().toString(36).toUpperCase()}`;
      await client.query(`
        INSERT INTO audit_logs (log_id, user_id, username, action, resource, status, ip_address, details_json, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        auditLogId,
        "SYSTEM-SCHEDULER",
        "neon-functions",
        "SIP_SCHEDULE_EVALUATION",
        "WEALTH_SERVICES",
        "SUCCESS",
        "127.0.0.1",
        JSON.stringify({ evaluated_count: executedSips.length, timestamp: now }),
        now
      ]);

      return new Response(JSON.stringify({
        status: "success",
        function: "sip-scheduler",
        evaluated_sips: executedSips.length,
        items: executedSips,
        timestamp: now
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return new Response(JSON.stringify({
      error: "Scheduler execution failed",
      message: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  } finally {
    await pool.end();
  }
}
