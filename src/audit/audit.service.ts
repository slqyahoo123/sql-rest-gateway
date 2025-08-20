import { Injectable } from '@nestjs/common';
import { MetadataService } from '../metadata/metadata.service';

@Injectable()
export class AuditService {
	constructor(private readonly meta: MetadataService) {}

	async write(projectId: number, apiKeyId: number | null, route: string, method: string, status: number, durationMs: number, rowCount: number | null, queryJson: any) {
		try {
			const pool = this.meta.getPool();
			await pool.query(
				`INSERT INTO audit_logs(project_id, api_key_id, route, method, query_json, status, duration_ms, row_count) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
				[projectId, apiKeyId, route, method, JSON.stringify(queryJson ?? {}), status, durationMs, rowCount],
			);
		} catch (e) {
			// eslint-disable-next-line no-console
			console.error('audit failed', e);
		}
	}
}
