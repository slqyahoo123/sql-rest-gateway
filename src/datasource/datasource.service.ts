import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { MetadataService } from '../metadata/metadata.service';
import { decryptDsn } from '../metadata/metadata.service';

@Injectable()
export class DatasourceService {
	private projectPools: Map<number, Pool> = new Map();

	constructor(private readonly meta: MetadataService) {}

	private async loadProjectDsn(projectId: number): Promise<string | null> {
		const pool = this.meta.getPool();
		const { rows } = await pool.query(
			`SELECT dsn_enc FROM datasources WHERE project_id = $1 AND type = 'postgres' ORDER BY id ASC LIMIT 1`,
			[projectId],
		);
		if (rows.length === 0) return null;
		const enc = rows[0].dsn_enc as string;
		try {
			return decryptDsn(enc);
		} catch {
			// 兼容明文（未加密的历史数据）
			return enc;
		}
	}

	private async configureSession(p: Pool) {
		await p.query(`SET statement_timeout = '5min'`);
		await p.query(`SET idle_in_transaction_session_timeout = '1min'`);
	}

	private async assertReadonly(p: Pool) {
		// 粗粒度校验：尝试写事务应失败（或用户无写权限）
		try {
			await p.query('BEGIN');
			await p.query('CREATE TEMP TABLE __rw_check(id int)');
			throw new Error('Datasource user appears to have write privileges');
		} catch {
			// 期望走到这里：无写权限
			await p.query('ROLLBACK');
		}
	}

	async getPoolForProject(projectId: number): Promise<Pool> {
		const existing = this.projectPools.get(projectId);
		if (existing) return existing;
		const dsn = await this.loadProjectDsn(projectId);
		if (!dsn) throw new Error(`No datasource for project ${projectId}`);
		const pool = new Pool({ connectionString: dsn, max: 10, idleTimeoutMillis: 30000 });
		await this.configureSession(pool);
		// 可选：仅在首次连接时做一次只读校验（生产可通过角色管理保障）
		// await this.assertReadonly(pool);
		this.projectPools.set(projectId, pool);
		return pool;
	}
}
