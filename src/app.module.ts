/// <reference path="./types/shims.d.ts" />
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiModule } from './api/api.module';
import { HealthModule } from './health/health.module';
import { AuditModule } from './audit/audit.module';
import { AuditMiddleware } from './audit/audit.middleware';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';

@Module({
	imports: [ConfigModule.forRoot({ isGlobal: true }), HealthModule, ApiModule, AuditModule, AdminModule, AuthModule],
})
export class AppModule {
	configure(consumer: any) {
		consumer.apply(AuditMiddleware).forRoutes('*');
	}
}
