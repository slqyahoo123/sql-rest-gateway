import { Injectable, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';

@Injectable()
export class AdminAuthGuard {
	private async match(token: string | undefined): Promise<boolean> {
		if (!token) return false;
		const adminHash = process.env.ADMIN_HASH || '';
		if (adminHash) {
			try { return await bcrypt.compare(String(token), adminHash); } catch { return false; }
		}
		const adminToken = process.env.ADMIN_TOKEN || 'admin_dev';
		return String(token) === adminToken;
	}

	canActivate(context: any): boolean | Promise<boolean> {
		const req: any = context.switchToHttp().getRequest();
		const cookieToken = req.cookies?.admin_session || '';
		const headerToken = req.headers?.['x-admin-token'] || '';
		return (async () => {
			if (await this.match(cookieToken)) return true;
			if (await this.match(headerToken)) return true;
			throw new UnauthorizedException('Unauthorized');
		})();
	}
}
