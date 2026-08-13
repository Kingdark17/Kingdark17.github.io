/**
 * Estado da conexão com o banco pra `/api/account/status` e `/health`.
 *
 * O original respondia `{configured, connected}` onde `connected` era um
 * booleano gravado no boot, quando `init()` rodava o schema. Aqui não
 * existe esse boot (migração é `drizzle-kit`, fora do processo), então
 * `connected` é medido na hora com um `SELECT 1`. Sai mais honesto: o
 * flag do original continuava `true` mesmo depois do banco cair.
 */

import { sql } from 'drizzle-orm';

import { getDb, isDatabaseConfigured } from '../db/client';

export interface DatabaseStatus {
  configured: boolean;
  connected: boolean;
}

export async function probeDatabase(): Promise<DatabaseStatus> {
  if (!isDatabaseConfigured()) return { configured: false, connected: false };
  try {
    await getDb().execute(sql`SELECT 1`);
    return { configured: true, connected: true };
  } catch {
    return { configured: true, connected: false };
  }
}
