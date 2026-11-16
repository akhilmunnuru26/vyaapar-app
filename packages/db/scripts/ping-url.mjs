import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL required')
  process.exit(1)
}
const sql = postgres(url, { max: 1 })
try {
  const rows = await sql`select 1 as ok`
  console.log('ok', rows[0])
} catch (error) {
  console.error('fail', error)
  process.exitCode = 1
} finally {
  await sql.end()
}
