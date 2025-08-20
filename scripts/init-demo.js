#!/usr/bin/env node
/*
One-click init demo

Example:
  node scripts/init-demo.js \
    --project-name demo \
    --datasource-dsn "postgres://postgres:postgres@host.docker.internal:5432/your_db" \
    --table public.products \
    --fields id,name,price,created_at \
    --row-filter "is_active = true" \
    --rate 10 --quota 50000

Env required:
  META_DB_URL, API_KEY_HASH_SALT
*/
const { Pool } = require('pg');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
	const args = {};
	for (let i = 2; i < argv.length; i++) {
		const a = argv[i];
		if (a.startsWith('--')) {
			const key = a.slice(2);
			const nxt = argv[i + 1];
			if (!nxt || nxt.startsWith('--')) {
				args[key] = true;
			} else {
				args[key] = nxt;
				i++;
			}
		}
	}
	return args;
}

async function ensureProjectAndDatasource(pool, projectName, dsn) {
	// ensure project
	let projectId = null;
	const sel = await pool.query('SELECT id FROM projects WHERE name = $1 LIMIT 1', [projectName]);
	if (sel.rowCount && sel.rows[0]) {
		projectId = sel.rows[0].id;
	} else {
		const ins = await pool.query('INSERT INTO projects(name) VALUES($1) RETURNING id', [projectName]);
		projectId = ins.rows[0].id;
	}
	// ensure datasource (update first or insert new)
	const ds = await pool.query('SELECT id FROM datasources WHERE project_id = $1 AND type = $2 ORDER BY id ASC LIMIT 1', [projectId, 'postgres']);
	if (ds.rowCount && ds.rows[0]) {
		await pool.query('UPDATE datasources SET dsn_enc = $1 WHERE id = $2', [dsn, ds.rows[0].id]);
	} else {
		await pool.query('INSERT INTO datasources(project_id, type, dsn_enc) VALUES ($1,$2,$3)', [projectId, 'postgres', dsn]);
	}
	return projectId;
}

async function main() {
	const META_DB_URL = process.env.META_DB_URL;
	const SALT = process.env.API_KEY_HASH_SALT || '';
	if (!META_DB_URL) throw new Error('META_DB_URL is required');
	if (!SALT) throw new Error('API_KEY_HASH_SALT is required');

	const args = parseArgs(process.argv);
	const projectName = args['project-name'] || 'demo';
	const dsn = args['datasource-dsn'];
	if (!dsn) throw new Error('--datasource-dsn is required');
	const table = args.table;
	const fields = args.fields;
	const rowFilter = args['row-filter'];
	const rate = args.rate || '10';
	const quota = args.quota || '50000';

	const pool = new Pool({ connectionString: META_DB_URL });
	try {
		const projectId = await ensureProjectAndDatasource(pool, projectName, dsn);

		const genArgs = [
			'scripts/gen-api-key.js',
			'--project-name', projectName,
			'--rate', String(rate),
			'--quota', String(quota),
		];
		if (table && fields) {
			genArgs.push('--table', table, '--fields', fields);
			if (rowFilter) genArgs.push('--row-filter', rowFilter);
		}
		const child = spawnSync('node', genArgs, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
		if (child.status !== 0) {
			throw new Error(`gen-api-key failed: ${child.stderr.toString()}`);
		}
		const out = JSON.parse(child.stdout.toString());
		const key = out.api_key_plaintext;
		const fqn = table || 'public.products';
		const selFields = (fields || 'id,name').split(',').slice(0, 5).join(',');

		const result = {
			project_id: projectId,
			api_key_id: out.api_key_id,
			api_key_prefix: out.api_key_prefix,
			api_key_plaintext: key,
			demo_requests: {
				list: `curl -H "Authorization: Bearer ${key}" "http://localhost:3000/api/${fqn}?select=${encodeURIComponent(selFields)}&limit=10"`,
				detail: `curl -H "Authorization: Bearer ${key}" "http://localhost:3000/api/${fqn}/1"`
			}
		};
		console.log(JSON.stringify(result, null, 2));
	} finally {
		await pool.end();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
