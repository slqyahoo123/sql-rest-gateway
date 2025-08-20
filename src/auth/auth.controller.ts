import { Controller, Post, Body, Res } from '@nestjs/common';
import { Response } from 'express';
import crypto from 'crypto';

@Controller('auth')
export class AuthController {
	@Post('login')
	login(@Body() body: any, @Res() res: Response) {
		const token = body?.token as string | undefined;
		const adminToken = process.env.ADMIN_TOKEN || 'admin_dev';
		if (token && String(token) === adminToken) {
			res.cookie('admin_session', adminToken, { httpOnly: true, sameSite: 'lax' });
			const csrf = crypto.randomBytes(16).toString('hex');
			res.cookie('csrf_token', csrf, { httpOnly: false, sameSite: 'lax' });
			return res.json({ ok: true, csrf_token: csrf });
		}
		return res.status(401).json({ error: { code: 401, message: 'Invalid token' } });
	}
}
