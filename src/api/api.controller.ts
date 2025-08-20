import { Controller, Get, Param, Query, Res, BadRequestException, UseGuards, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { QueryService, quoteIdent } from './query.service';
import { DatasourceService } from '../datasource/datasource.service';
import { ApiKeyGuard } from '../security/api-key.guard';
import { RateLimitInterceptor } from '../security/rate-limit.interceptor';

@Controller('api')
@UseGuards(ApiKeyGuard)
@UseInterceptors(RateLimitInterceptor)
export class ApiController {
	constructor(private readonly qs: QueryService, private readonly ds: DatasourceService) {}

	@Get(':fqn')
	async list(@Param('fqn') fqn: string, @Query() query: Record<string, any>, @Res() res: Response & { row_count?: number }, req?: any) {
		const limit = Math.min(Number(query.limit ?? 50), 100);
		const offset = Number(query.offset ?? 0);
		const cursorField = (query.cursor_field as string | undefined) || '';
		const cursor = (query.cursor as string | undefined) || '';
		const isCursor = !!cursorField && !!cursor;
		const apiKey = (req as any)?.apiKey || (res.req as any)?.apiKey;
		if (!apiKey) throw new BadRequestException('Missing api key context');
		const policy = apiKey.policies.find((p: any) => p.table_fqn === fqn) || null;
		const allowed = policy ? policy.allowed_fields : null;
		const selectCols = this.qs.parseSelect(query.select as string | undefined, allowed);
		const params: any[] = [];
		const where = this.qs.parseWhere(query.where as string | undefined, params, 1);
		const order = this.qs.parseOrder(query.order as string | undefined);
		let extraCursor = '';
		if (isCursor) {
			const isDesc = (query.order as string | undefined)?.startsWith('-') || false;
			const cur = this.qs.addCursorWhere(params, cursorField, cursor, isDesc);
			extraCursor = cur.sql;
		}
		const { schema, table } = fqn.includes('.') ? { schema: fqn.split('.')[0], table: fqn.split('.')[1] } : { schema: 'public', table: fqn };
		const tableRef = `${quoteIdent(schema)}.${quoteIdent(table)}`;
		const cols = selectCols.length ? selectCols.map(quoteIdent).join(', ') : '*';
		const filters = [where.clause.replace(/^WHERE\s+/, '').trim(), policy?.row_filter_sql?.trim(), extraCursor].filter(Boolean);
		const whereCombined = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
		const sql = `SELECT ${cols} FROM ${tableRef} ${whereCombined} ${order} LIMIT ${limit}`.trim();
		const pool = await this.ds.getPoolForProject(apiKey.project_id);
		const { rows } = await pool.query(sql, params);
		const nextCursor = (rows.length > 0 && cursorField) ? this.qs.encodeCursor(rows[rows.length - 1][cursorField]) : null;
		(res as any).row_count = rows.length;
		return res.json({ data: rows, page: { limit, cursor: nextCursor } });
	}

	@Get(':fqn/:id')
	async detail(@Param('fqn') fqn: string, @Param('id') id: string, @Res() res: Response & { row_count?: number }, req?: any, @Query('pk') pk?: string) {
		const apiKey = (req as any)?.apiKey || (res.req as any)?.apiKey;
		if (!apiKey) throw new BadRequestException('Missing api key context');
		const policy = apiKey.policies.find((p: any) => p.table_fqn === fqn) || null;
		const allowed = policy ? policy.allowed_fields : null;
		const selectCols = this.qs.parseSelect(undefined, allowed);
		const pkCol = pk || 'id';
		const params: any[] = [id];
		const where = { clause: `WHERE ${quoteIdent(pkCol)} = $1`, nextIndex: 2 };
		const order = '';
		const sql = this.qs.buildSelectSql(fqn, selectCols, where.clause, order, 1, 0, policy?.row_filter_sql ?? null);
		const pool = await this.ds.getPoolForProject(apiKey.project_id);
		const { rows } = await pool.query(sql, params);
		(res as any).row_count = rows.length;
		return res.json({ data: rows[0] ?? null });
	}
}
