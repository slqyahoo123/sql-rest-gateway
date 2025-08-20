#!/usr/bin/env node
/*
Usage examples:
  node scripts/gen-api-key.js --project 1 --rate 10 --quota 50000 --table public.products --fields id,name,price --row-filter "is_active = true"
  node scripts/gen-api-key.js --project-name demo --rate 5 --quota 10000
Env required:
  META_DB_URL, API_KEY_HASH_SALT
*/
const { Pool } = require('pg');
const crypto = require('crypto');

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

function generateKey(len = 32) {
	return crypto.randomBytes(len).toString('base64url');
}

function sha256Hex(input) {
	return crypto.createHash('sha256').update(input).digest('hex');
}

async function main() {
	const META_DB_URL = process.env.META_DB_URL;
	const SALT = process.env.API_KEY_HASH_SALT || '';
	if (!META_DB_URL) throw new Error('META_DB_URL is required');
	if (!SALT) throw new Error('API_KEY_HASH_SALT is required');
	const args = parseArgs(process.argv);
	const pool = new Pool({ connectionString: META_DB_URL });
	try {
		let projectId = args.project ? Number(args.project) : null;
		if (!projectId) {
			const projectName = args['project-name'] || 'demo';
			const sel = await pool.query('SELECT id FROM projects WHERE name = $1 LIMIT 1', [projectName]);
			if (sel.rowCount && sel.rows[0]) {
				projectId = sel.rows[0].id;
			} else {
				const ins = await pool.query('INSERT INTO projects(name) VALUES($1) RETURNING id', [projectName]);
				projectId = ins.rows[0].id;
			}
		}

		const rawKey = args.key || generateKey(24);
		const keyPrefix = rawKey.slice(0, 8);
		const keyHash = sha256Hex(`${SALT}:${rawKey}`);
		const rate = args.rate ? Number(args.rate) : 5;
		const quota = args.quota ? Number(args.quota) : 10000;

		const keyIns = await pool.query(
			`INSERT INTO api_keys(project_id, key_hash, key_prefix, active, rate_rps, daily_quota) VALUES ($1,$2,$3,TRUE,$4,$5) RETURNING id`,
			[projectId, keyHash, keyPrefix, rate, quota]
		);
		const apiKeyId = keyIns.rows[0].id;

		let policyId = null;
		if (args.table && args.fields) {
			const tableFqn = String(args.table);
			const fields = String(args.fields).split(',').map((s) => s.trim()).filter(Boolean);
			const rowFilter = args['row-filter'] ? String(args['row-filter']) : null;
			const polIns = await pool.query(
				`INSERT INTO key_policies(api_key_id, table_fqn, allowed_fields, row_filter_sql) VALUES ($1,$2,$3,$4) RETURNING id`,
				[apiKeyId, tableFqn, JSON.stringify(fields), rowFilter]
			);
			policyId = polIns.rows[0].id;
		}

		const out = {
			project_id: projectId,
			api_key_id: apiKeyId,
			api_key_prefix: keyPrefix,
			api_key_plaintext: rawKey,
			policy_id: policyId,
			rate_rps: rate,
			daily_quota: quota,
		};
		console.log(JSON.stringify(out, null, 2));
	} finally {
		await pool.end();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
