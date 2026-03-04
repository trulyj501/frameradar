import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";

config();

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getProjectRefFromUrl(supabaseUrl) {
  if (!supabaseUrl) return null;

  try {
    const host = new URL(supabaseUrl).hostname;
    return host.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

function getConnectionString() {
  if (process.env.SUPABASE_DB_URL) {
    return process.env.SUPABASE_DB_URL;
  }

  const projectRef = process.env.SUPABASE_PROJECT_REF ?? getProjectRefFromUrl(process.env.SUPABASE_URL);
  const password = process.env.SUPABASE_DB_PASSWORD;

  if (!projectRef || !password) {
    throw new Error(
      "SUPABASE_DB_URL 또는 (SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD) 환경변수가 필요합니다."
    );
  }

  const user = process.env.SUPABASE_DB_USER ?? "postgres";
  const host = process.env.SUPABASE_DB_HOST ?? `db.${projectRef}.supabase.co`;
  const port = process.env.SUPABASE_DB_PORT ?? "5432";
  const database = process.env.SUPABASE_DB_NAME ?? "postgres";

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

async function run() {
  const connectionString = getConnectionString();
  const schemaPath = path.resolve(__dirname, "../../supabase/schema.sql");
  const sql = await readFile(schemaPath, "utf8");

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    await client.query(sql);

    const verify = await client.query("select to_regclass('public.analyses') as table_name");
    const tableName = verify.rows[0]?.table_name;

    if (tableName !== "analyses" && tableName !== "public.analyses") {
      throw new Error("스키마 적용 후 public.analyses 테이블 검증에 실패했습니다.");
    }

    console.log("Supabase 테이블 초기화 완료: public.analyses");
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Supabase 테이블 초기화 실패:", error.message || error);
  process.exit(1);
});
