import { Injectable } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AuditService } from './audit.service';

@Injectable()
export class AuditMiddleware {
	constructor(private readonly audit: AuditService) {}

	use(req: Request & { apiKey?: any }, res: Response & { row_count?: number }, next: NextFunction) {
		const start = Date.now();
		const originalEnd = res.end;
		const auditService = this.audit;
		(res as any).end = async function (...args: any[]) {
			const duration = Date.now() - start;
			try {
				const disabled = String(process.env.DISABLE_AUDIT || '').toLowerCase() === 'true';
				if (!disabled) {
					const status = res.statusCode;
					const route = (req as any).originalUrl as string;
					const method = req.method;
					const rowCount = (res as any).row_count ?? null;
					const projectId = (req as any).apiKey?.project_id ?? null;
					const apiKeyId = (req as any).apiKey?.id ?? null;
					// 仅记录 API 路径且存在 projectId 的请求
					if (projectId && route.startsWith('/api/')) {
						await auditService.write(projectId, apiKeyId, route, method, status, duration, rowCount, (req as any).query);
					}
				}
			} catch (e) {
				// eslint-disable-next-line no-console
				console.error('audit failed', e);
			}
			return originalEnd.apply(res, args as any);
		} as any;
		next();
	}
}
