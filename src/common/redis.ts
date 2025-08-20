import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedis(): Redis {
	if (!redis) {
		const url = process.env.REDIS_URL || 'redis://localhost:6379/0';
		redis = new Redis(url, { lazyConnect: false });
	}
	return redis;
}
