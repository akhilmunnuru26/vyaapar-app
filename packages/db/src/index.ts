import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

export type DbResources = {
  db: ReturnType<typeof drizzle<typeof schema>>
  sql: postgres.Sql
  close: () => Promise<void>
}

export function createDb(databaseUrl: string): DbResources {
  const sql = postgres(databaseUrl, {
    max: 10,
    prepare: false,
    connect_timeout: 10,
  })
  const db = drizzle(sql, { schema })
  return {
    db,
    sql,
    close: async () => {
      await sql.end({ timeout: 5 })
    },
  }
}

export async function pingDatabase(sql: postgres.Sql): Promise<void> {
  await sql`select 1 as ok`
}

export * from './schema.js'
