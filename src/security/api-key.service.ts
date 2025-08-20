import { Injectable } from '@nestjs/common';
import { MetadataService } from '../metadata/metadata.service';
import crypto from 'crypto';
import { ApiKeyRecord, KeyPolicy } from '../common/tokens';

@Injectable()
export class ApiKeyService {
	constructor(private readonly meta: MetadataService) {}

	private hashKey(rawKey: string): string {
		const salt = process.env.API_KEY_HASH_SALT || '';
		return crypto.createHash('sha256').update(`${salt}:${rawKey}`).digest('hex');
	}

	async loadApiKey(rawKey: string): Promise<ApiKeyRecord | null> {
		const keyHash = this.hashKey(rawKey);
		const pool = this.meta.getPool();
		const { rows } = await pool.query(
			`SELECT id, project_id, active, rate_rps, daily_quota FROM api_keys WHERE key_hash = $1 LIMIT 1`,
			[keyHash],
		);
		if (rows.length === 0) return null;
		const keyRow = rows[0];
		const polRes = await pool.query(
			`SELECT id, table_fqn, allowed_fields, row_filter_sql FROM key_policies WHERE api_key_id = $1`,
			[keyRow.id],
		);
		const policies: KeyPolicy[] = polRes.rows.map((r: any) => ({
			id: r.id,
			table_fqn: r.table_fqn,
			allowed_fields: Array.isArray(r.allowed_fields) ? r.allowed_fields : [],
			row_filter_sql: r.row_filter_sql ?? null,
		}));
		return {
			id: keyRow.id,
			project_id: keyRow.project_id,
			active: keyRow.active,
			rate_rps: keyRow.rate_rps,
			daily_quota: keyRow.daily_quota,
			policies,
		};
	}
}
