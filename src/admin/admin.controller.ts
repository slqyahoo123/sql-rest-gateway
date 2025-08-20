import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { MetadataService } from '../metadata/metadata.service';
import crypto from 'crypto';
import { Pool } from 'pg';
import { AdminAuthGuard } from './auth.guard';
import { encryptDsn, decryptDsn } from '../metadata/metadata.service';

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
	constructor(private readonly meta: MetadataService) {}

	@Get()
	index(@Res() res: any) {
		return res.redirect('/admin.html');
	}

	@Get('projects')
	async listProjects() {
		const { rows } = await this.meta.getPool().query('SELECT * FROM projects ORDER BY id ASC');
		return rows;
	}

	@Post('projects')
	async createProject(@Body() body: any) {
		const { name } = body;
		const { rows } = await this.meta.getPool().query('INSERT INTO projects(name) VALUES($1) RETURNING *', [name]);
		return rows[0];
	}

	@Delete('projects/:id')
	async deleteProject(@Param('id') id: string) {
		await this.meta.getPool().query('DELETE FROM projects WHERE id = $1', [id]);
		return { ok: true };
	}

	@Put('datasources/:projectId')
	async upsertDatasource(@Param('projectId') projectId: string, @Body() body: any) {
		let { dsn_enc } = body as { dsn_enc: string };
		const hasKey = !!process.env.DSN_ENC_KEY;
		let toStore = dsn_enc;
		let encrypted = false;
		if (hasKey) {
			try {
				const maybePlain = decryptDsn(dsn_enc);
				if (maybePlain.startsWith('postgres://') || maybePlain.startsWith('postgresql://')) {
					// 传入已加密值，直接存
					toStore = dsn_enc;
					encrypted = true;
				} else {
					toStore = encryptDsn(dsn_enc);
					encrypted = true;
				}
			} catch {
				// 传入明文，进行加密
				toStore = encryptDsn(dsn_enc);
				encrypted = true;
			}
		}
		const pool = this.meta.getPool();
		const sel = await pool.query('SELECT id FROM datasources WHERE project_id = $1 AND type = $2 LIMIT 1', [projectId, 'postgres']);
		if (sel.rowCount) {
			const { rows } = await pool.query('UPDATE datasources SET dsn_enc=$1 WHERE id=$2 RETURNING *', [toStore, sel.rows[0].id]);
			return { ...rows[0], encrypted };
		} else {
			const { rows } = await pool.query('INSERT INTO datasources(project_id, type, dsn_enc) VALUES ($1,$2,$3) RETURNING *', [projectId, 'postgres', toStore]);
			return { ...rows[0], encrypted };
		}
	}

	@Post('datasources/:projectId/test')
	async testDatasource(@Param('projectId') projectId: string, @Body() body: any) {
		const overrideDsn = body?.dsn_enc as string | undefined;
		let dsn = overrideDsn;
		if (!dsn) {
			const { rows } = await this.meta.getPool().query('SELECT dsn_enc FROM datasources WHERE project_id = $1 AND type = $2 LIMIT 1', [projectId, 'postgres']);
			if (!rows.length) return { ok: false, message: 'No datasource configured' };
			dsn = rows[0].dsn_enc;
		}
		// 兼容加密/明文
		try { dsn = decryptDsn(dsn!); } catch {}
		const testPool = new Pool({ connectionString: dsn!, max: 1 });
		try {
			const q = await testPool.query('SELECT version() as v');
			return { ok: true, version: q.rows[0]?.v || '' };
		} catch (e: any) {
			return { ok: false, message: e.message };
		} finally {
			await testPool.end();
		}
	}

	@Get('keys')
	async listKeys(@Query('project_id') projectId?: string, @Query('q') q?: string) {
		const pool = this.meta.getPool();
		if (projectId) {
			if (q) {
				const { rows } = await pool.query(
					`SELECT id, project_id, key_prefix, active, rate_rps, daily_quota, note, created_at FROM api_keys WHERE project_id = $1 AND (key_prefix ILIKE $2 OR note ILIKE $2) ORDER BY id DESC`,
					[projectId, `%${q}%`],
				);
				return rows;
			}
			const { rows } = await pool.query('SELECT id, project_id, key_prefix, active, rate_rps, daily_quota, note, created_at FROM api_keys WHERE project_id = $1 ORDER BY id DESC', [projectId]);
			return rows;
		}
		if (q) {
			const { rows } = await pool.query(
				`SELECT id, project_id, key_prefix, active, rate_rps, daily_quota, note, created_at FROM api_keys WHERE key_prefix ILIKE $1 OR note ILIKE $1 ORDER BY id DESC LIMIT 200`,
				[`%${q}%`],
			);
			return rows;
		}
		const { rows } = await pool.query('SELECT id, project_id, key_prefix, active, rate_rps, daily_quota, note, created_at FROM api_keys ORDER BY id DESC LIMIT 100');
		return rows;
	}

	@Post('keys')
	async createKey(@Body() body: any) {
		const { project_id, key_hash, key_prefix, rate_rps = 5, daily_quota = 10000, note = null } = body;
		const { rows } = await this.meta.getPool().query(
			'INSERT INTO api_keys(project_id, key_hash, key_prefix, active, rate_rps, daily_quota, note) VALUES ($1,$2,$3,TRUE,$4,$5,$6) RETURNING *',
			[project_id, key_hash, key_prefix, rate_rps, daily_quota, note],
		);
		return rows[0];
	}

	@Put('keys/:id/note')
	async updateKeyNote(@Param('id') id: string, @Body() body: any) {
		const { note } = body;
		const { rows } = await this.meta.getPool().query('UPDATE api_keys SET note = $1 WHERE id = $2 RETURNING *', [note, id]);
		return rows[0];
	}

	@Post('keys/issue')
	async issueKey(@Body() body: any) {
		const { project_id, rate_rps = 5, daily_quota = 10000, table_fqn, allowed_fields, row_filter_sql, note = null } = body;
		const salt = process.env.API_KEY_HASH_SALT || '';
		const rawKey = crypto.randomBytes(18).toString('base64url');
		const key_prefix = rawKey.slice(0, 8);
		const key_hash = crypto.createHash('sha256').update(`${salt}:${rawKey}`).digest('hex');
		const pool = this.meta.getPool();
		const keyIns = await pool.query(
			'INSERT INTO api_keys(project_id, key_hash, key_prefix, active, rate_rps, daily_quota, note) VALUES ($1,$2,$3,TRUE,$4,$5,$6) RETURNING *',
			[project_id, key_hash, key_prefix, rate_rps, daily_quota, note],
		);
		let policy = null;
		if (table_fqn && allowed_fields) {
			const pol = await pool.query(
				'INSERT INTO key_policies(api_key_id, table_fqn, allowed_fields, row_filter_sql) VALUES ($1,$2,$3,$4) RETURNING *',
				[keyIns.rows[0].id, table_fqn, JSON.stringify(allowed_fields), row_filter_sql ?? null],
			);
			policy = pol.rows[0];
		}
		return { api_key_plaintext: rawKey, api_key_prefix: key_prefix, api_key: keyIns.rows[0], policy };
	}

	@Put('keys/:id/revoke')
	async revokeKey(@Param('id') id: string) {
		const { rows } = await this.meta.getPool().query('UPDATE api_keys SET active = FALSE WHERE id = $1 RETURNING *', [id]);
		return rows[0];
	}

	@Post('policies')
	async createPolicy(@Body() body: any) {
		const { api_key_id, table_fqn, allowed_fields = [], row_filter_sql = null } = body;
		const { rows } = await this.meta.getPool().query(
			'INSERT INTO key_policies(api_key_id, table_fqn, allowed_fields, row_filter_sql) VALUES($1,$2,$3,$4) RETURNING *',
			[api_key_id, table_fqn, JSON.stringify(allowed_fields), row_filter_sql],
		);
		return rows[0];
	}

	@Delete('policies/:id')
	async deletePolicy(@Param('id') id: string) {
		await this.meta.getPool().query('DELETE FROM key_policies WHERE id = $1', [id]);
		return { ok: true };
	}

	@Get('export/:projectId/json')
	async exportJson(@Param('projectId') projectId: string) {
		const pool = this.meta.getPool();
		const keys = (await pool.query('SELECT id, project_id, key_prefix, active, rate_rps, daily_quota, note, created_at FROM api_keys WHERE project_id = $1 ORDER BY id ASC', [projectId])).rows;
		const policies = (await pool.query('SELECT id, api_key_id, table_fqn, allowed_fields, row_filter_sql FROM key_policies WHERE api_key_id = ANY($1::int[]) ORDER BY id ASC', [keys.map(k => k.id)])).rows;
		return { keys, policies };
	}

	@Get('export/:projectId/csv')
	async exportCsv(@Param('projectId') projectId: string, @Res() res: any) {
		const pool = this.meta.getPool();
		const keys = (await pool.query('SELECT id, project_id, key_prefix, active, rate_rps, daily_quota, note, created_at FROM api_keys WHERE project_id = $1 ORDER BY id ASC', [projectId])).rows;
		const policies = (await pool.query('SELECT id, api_key_id, table_fqn, allowed_fields, row_filter_sql FROM key_policies WHERE api_key_id = ANY($1::int[]) ORDER BY id ASC', [keys.map(k => k.id)])).rows;
		const colsToCsv = (rows: any[]) => {
			if (!rows.length) return '';
			const cols = Object.keys(rows[0]);
			const header = cols.join(',');
			const lines = rows.map(r => cols.map(c => {
				const v = r[c] ?? '';
				const s = String(v).replace(/"/g, '""');
				return /[",\n]/.test(s) ? `"${s}"` : s;
			}).join(','));
			return [header, ...lines].join('\n');
		};
		const out = `# api_keys\n${colsToCsv(keys)}\n\n# key_policies\n${colsToCsv(policies)}`;
		res.setHeader('Content-Type', 'text/csv; charset=utf-8');
		res.setHeader('Content-Disposition', `attachment; filename="project_${projectId}_keys_policies.csv"`);
		return res.send(out);
	}

	@Get('audits')
	async audits(@Query('project_id') projectId?: string, @Query('status') status?: string) {
		const pool = this.meta.getPool();
		const conds: string[] = [];
		const params: any[] = [];
		if (projectId) { params.push(projectId); conds.push(`project_id = $${params.length}`); }
		if (status) { params.push(Number(status)); conds.push(`status = $${params.length}`); }
		const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
		const { rows } = await pool.query(`SELECT id, project_id, api_key_id, route, method, status, duration_ms, row_count, created_at FROM audit_logs ${where} ORDER BY created_at DESC LIMIT 100`, params);
		return rows;
	}
}
