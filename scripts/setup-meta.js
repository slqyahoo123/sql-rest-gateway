#!/usr/bin/env node
/*
Ensure metadata DB exists and run migrations.

Usage (env required):
  META_DB_URL=postgres://user:pass@host:5432/sqlrest_meta node scripts/setup-meta.js
*/
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

function parseDsn(dsn) {
  const u = new URL(dsn);
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') {
    throw new Error('Only postgres:// DSN is supported');
  }
  const user = decodeURIComponent(u.username || '');
  const password = decodeURIComponent(u.password || '');
  const host = u.hostname || 'localhost';
  const port = u.port ? Number(u.port) : 5432;
  const dbName = (u.pathname || '/').replace(/^\//, '') || 'postgres';
  const search = u.search || '';
  return { user, password, host, port, dbName, search, protocol: u.protocol };
}

function buildDsn({ user, password, host, port, dbName, protocol, search }) {
  const auth = user ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@` : '';
  return `${protocol}//${auth}${host}:${port}/${dbName}${search}`;
}

async function ensureDb(adminPool, dbName) {
  const { rows } = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (rows.length) return false;
  if (!/^[-_a-zA-Z0-9]+$/.test(dbName)) throw new Error('Unsafe database name');
  await adminPool.query(`CREATE DATABASE "${dbName}"`);
  return true;
}

async function runMigrations(targetPool) {
  const migs = ['001_init.sql', '002_add_key_note.sql'];
  for (const file of migs) {
    const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', file), 'utf8');
    if (sql.trim().length === 0) continue;
    await targetPool.query(sql);
    // eslint-disable-next-line no-console
    console.log(`Applied migration: ${file}`);
  }
}

async function main() {
  const dsn = process.env.META_DB_URL;
  if (!dsn) throw new Error('META_DB_URL is required');
  const parsed = parseDsn(dsn);
  const adminDsn = buildDsn({ ...parsed, dbName: 'postgres' });

  const adminPool = new Pool({ connectionString: adminDsn });
  try {
    const created = await ensureDb(adminPool, parsed.dbName);
    // eslint-disable-next-line no-console
    console.log(created ? `Created database ${parsed.dbName}` : `Database ${parsed.dbName} already exists`);
  } finally {
    await adminPool.end();
  }

  const targetPool = new Pool({ connectionString: dsn });
  try {
    await runMigrations(targetPool);
    // eslint-disable-next-line no-console
    console.log('Migrations complete');
  } finally {
    await targetPool.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
