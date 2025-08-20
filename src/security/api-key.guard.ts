import { UnauthorizedException, ForbiddenException, Injectable, Inject } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';

export interface RequestWithApiKey extends Request {
	apiKey?: {
		id: number;
		project_id: number;
		rate_rps: number;
		daily_quota: number;
		policies: Array<{ table_fqn: string; allowed_fields: string[]; row_filter_sql: string | null }>;
	};
}

@Injectable()
export class ApiKeyGuard {
	constructor(@Inject(ApiKeyService) private readonly apiKeys: ApiKeyService) {}

	async canActivate(context: any): Promise<boolean> {
		const req: any = context.switchToHttp().getRequest();
		const rawKey = (req.headers['x-api-key'] || req.headers['authorization']) as string | undefined;
		if (!rawKey) throw new UnauthorizedException('Missing API key');
		const keyValue = rawKey.startsWith('Bearer ') ? rawKey.slice(7) : rawKey;
		const key = await this.apiKeys.loadApiKey(keyValue);
		if (!key || !key.active) throw new ForbiddenException('Invalid or inactive API key');
		req.apiKey = key;
		return true;
	}
}
