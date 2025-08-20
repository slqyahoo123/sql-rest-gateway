import { Injectable } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

@Injectable()
export class RequestIdMiddleware {
	use(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
		const existing = (req.headers['x-request-id'] as string) || '';
		const requestId = existing || crypto.randomBytes(8).toString('hex');
		req.requestId = requestId;
		res.setHeader('x-request-id', requestId);
		next();
	}
}
