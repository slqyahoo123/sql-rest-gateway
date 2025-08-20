import { Injectable, TooManyRequestsException } from '@nestjs/common';
import { getRedis } from '../common/redis';

@Injectable()
export class RateLimitInterceptor {
	async intercept(context: any, next: any): Promise<any> {
		const http = context.switchToHttp();
		const req: any = http.getRequest();
		const res: any = http.getResponse();
		const key = req.apiKey as { id: number; rate_rps: number; daily_quota: number } | undefined;
		if (!key) return next.handle();

		const disabled = String(process.env.DISABLE_RATE_LIMIT || '').toLowerCase() === 'true';
		if (disabled) {
			return next.handle();
		}

		const redis = getRedis();
		const nowSec = Math.floor(Date.now() / 1000);
		const rpsKey = `rl:rps:${key.id}:${nowSec}`;
		const dayKey = `rl:day:${key.id}:${new Date().toISOString().slice(0, 10)}`;
		const tx = redis.multi();
		tx.incr(rpsKey);
		tx.expire(rpsKey, 2);
		tx.incr(dayKey);
		tx.expire(dayKey, 86400);
		const [rpsCount, , dayCount] = (await tx.exec())?.map((r) => (Array.isArray(r) ? r[1] : r)) as any[];

		res.setHeader('X-RateLimit-Limit', key.rate_rps);
		res.setHeader('X-RateLimit-Remaining', Math.max(0, key.rate_rps - Number(rpsCount)));
		res.setHeader('X-RateLimit-Reset', nowSec + 1);
		res.setHeader('X-RateLimit-Daily-Limit', key.daily_quota);
		res.setHeader('X-RateLimit-Daily-Remaining', Math.max(0, key.daily_quota - Number(dayCount)));

		if (Number(rpsCount) > key.rate_rps) {
			res.setHeader('Retry-After', 1);
			throw new TooManyRequestsException('RPS limit exceeded');
		}
		if (Number(dayCount) > key.daily_quota) {
			const secondsUntilTomorrow = 86400 - (nowSec % 86400);
			res.setHeader('Retry-After', secondsUntilTomorrow);
			throw new TooManyRequestsException('Daily quota exceeded');
		}
		return next.handle();
	}
}
