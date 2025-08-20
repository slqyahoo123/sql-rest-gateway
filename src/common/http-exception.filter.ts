import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';


@Catch()
export class GlobalHttpExceptionFilter {
	catch(exception: any, host: any) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse() as Response;
		const request = ctx.getRequest() as Request & { requestId?: string };

		const code = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
		const message = exception?.message ?? 'Internal Server Error';
		const reqId = request.requestId || request.headers['x-request-id'] || '';

		response.status(code).json({
			error: {
				code,
				message,
				request_id: reqId,
			},
		});
	}
}
