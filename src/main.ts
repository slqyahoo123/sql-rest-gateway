/// <reference types="node" />
/// <reference path="./types/shims.d.ts" />
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalHttpExceptionFilter } from './common/http-exception.filter';
import { RequestIdMiddleware } from './common/request-id.middleware';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';

async function bootstrap() {
	if (process.env.SENTRY_DSN) {
		Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
	}
	const app: any = await NestFactory.create(AppModule, { cors: false });
	// 安全头
	app.use(helmet());
	// CORS 白名单（可通过环境变量配置，逗号分隔）
	const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((s) => s.trim());
	app.enableCors({ origin: corsOrigins, credentials: true, methods: ['GET','POST','PUT','DELETE','OPTIONS'] });
	// 解析器与大小限制
	app.use(cookieParser());
	app.use(express.json({ limit: '1mb' }));
	app.use(express.urlencoded({ extended: true, limit: '1mb' }));
	app.use(new RequestIdMiddleware().use as any);
	app.useGlobalFilters(new GlobalHttpExceptionFilter());
	app.useStaticAssets(join(__dirname, '..', 'public'));

	// /admin/* 简易限流（每分钟 120 请求/每 IP）
	const adminLimiter = rateLimit({ windowMs: 60 * 1000, max: 120 });
	app.getHttpAdapter().getInstance().use('/admin', adminLimiter);

	// CSRF 验证中间件：仅保护 /admin 的写操作
	app.getHttpAdapter().getInstance().use('/admin', (req, res, next) => {
		if (req.method === 'GET') return next();
		const csrfCookie = req.cookies?.csrf_token;
		const csrfHeader = req.headers['x-csrf-token'];
		if (csrfCookie && csrfHeader && csrfCookie === csrfHeader) return next();
		return res.status(403).json({ error: { code: 403, message: 'Invalid CSRF token' } });
	});

	// Serve external JS for Swagger pre-authorization to avoid inline CSP
	const exampleKey = process.env.EXAMPLE_API_KEY;
	if (exampleKey) {
		app.getHttpAdapter().getInstance().get('/docs-init.js', (req, res) => {
			res.type('application/javascript').send(`window.addEventListener('load',function(){try{var ui=window.ui;if(ui&&ui.preauthorizeApiKey){ui.preauthorizeApiKey('apiKey','${exampleKey}')}}catch(e){}});`);
		});
	}

	const config = new DocumentBuilder()
		.setTitle('SQL→API Gateway')
		.setDescription('Secure read-only · REST-first · Self-hosted')
		.setVersion('0.1.4')
		.addBearerAuth({ type: 'http', scheme: 'bearer' }, 'apiKey')
		.build();
	const document = SwaggerModule.createDocument(app, config);
	SwaggerModule.setup('docs', app, document, {
		swaggerOptions: { persistAuthorization: true, docExpansion: 'none' },
		customSiteTitle: 'SQL→API Gateway Docs',
		customJs: exampleKey ? ['/docs-init.js'] : undefined,
	});

	process.on('uncaughtException', (err) => { Sentry.captureException?.(err); });
	process.on('unhandledRejection', (err: any) => { Sentry.captureException?.(err); });

	const port = Number(process.env.APP_PORT || 3000);
	await app.listen(port);
	// eslint-disable-next-line no-console
	console.log(`sql-rest-gateway listening on http://localhost:${port}`);
}

bootstrap();
