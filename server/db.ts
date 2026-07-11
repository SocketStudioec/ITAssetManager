import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
});

// Sin este listener, un error en un cliente idle (reinicio de Postgres,
// timeout de red) emite 'error' sin manejar y tumba el proceso completo.
pool.on("error", (err) => {
  console.error("Error inesperado en cliente idle de PostgreSQL:", err.message);
});
