import { neon } from '@neondatabase/serverless';
import { drizzle as neonDrizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema.js';

export const storageMode = process.env.DATABASE_URL ? 'Neon Postgres' : 'Local persistent Postgres (PGlite)';
async function connect(): Promise<NeonHttpDatabase<typeof schema>> {
  if (process.env.DATABASE_URL) return neonDrizzle(neon(process.env.DATABASE_URL), { schema });
  if (process.env.VERCEL) throw new Error('Configure DATABASE_URL for hosted deployments. Local storage cannot run on ephemeral functions.');
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { readFile, mkdir } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const path = process.env.ESCROWPAL_DATA_DIR || resolve('.data/escrowpal');
  await mkdir(path, { recursive: true, mode: 0o700 });
  const pg = new PGlite(path); await pg.waitReady;
  const existing = await pg.query<{ name: string | null }>("select to_regclass('public.deals')::text as name");
  if (!existing.rows[0]?.name) {
    const sql = await readFile(new URL('../../drizzle/0000_brave_nova.sql', import.meta.url), 'utf8');
    await pg.exec('BEGIN;\n' + sql + '\nCOMMIT;');
  }
  const market = await pg.query<{ name: string | null }>("select to_regclass('public.market_analyses')::text as name");
  if (!market.rows[0]?.name) {
    const sql = await readFile(new URL('../../drizzle/0001_market_analyses.sql', import.meta.url), 'utf8');
    await pg.exec('BEGIN;\n' + sql + '\nCOMMIT;');
  }
  // Both adapters implement Drizzle's PostgreSQL query builder; no driver-specific methods escape here.
  return drizzle(pg, { schema }) as unknown as NeonHttpDatabase<typeof schema>;
}
export const db = await connect();
export { schema };
