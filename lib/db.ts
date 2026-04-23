import { Pool } from 'pg';

// Verbindung wird für serverless Umgebung als globale Variable gecacht
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool() {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
}

const pool = global._pgPool ?? createPool();
if (process.env.NODE_ENV !== 'production') global._pgPool = pool;

export default pool;

// Hilfsfunktion für Aktivitätslog
export async function addLog(username: string, action: string, details: string) {
  try {
    await pool.query(
      'INSERT INTO activity_log (username, action, details) VALUES ($1, $2, $3)',
      [username, action, details]
    );
  } catch { /* nicht kritisch */ }
}
