import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import crypto from 'crypto';

function getKey() {
	const key = process.env.DSN_ENC_KEY || '';
	if (!key) throw new Error('DSN_ENC_KEY is required to decrypt datasource DSN');
	return crypto.createHash('sha256').update(key).digest(); // 32 bytes
}

export function encryptDsn(plain: string): string {
	const iv = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
	const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptDsn(encB64: string): string {
	const raw = Buffer.from(encB64, 'base64');
	const iv = raw.subarray(0, 12);
	const tag = raw.subarray(12, 28);
	const enc = raw.subarray(28);
	const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
	decipher.setAuthTag(tag);
	const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
	return dec.toString('utf8');
}

@Injectable()
export class MetadataService {
	private pool: Pool;

	constructor() {
		const url = process.env.META_DB_URL;
		if (!url) throw new Error('META_DB_URL is required');
		this.pool = new Pool({ connectionString: url, max: 10 });
	}

	getPool(): Pool {
		return this.pool;
	}

	async onModuleDestroy() {
		await this.pool.end();
	}
}
