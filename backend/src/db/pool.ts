import { Pool } from 'pg';

export const pool = new Pool({
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || 'uberbuses',
  password: process.env.PGPASSWORD || 'uberbuses_pass',
  database: process.env.PGDATABASE || 'uberbuses',
});

export async function checkDbHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
