import { Injectable, BadRequestException } from '@nestjs/common';

const ALLOWED_OPS = new Set(['eq', 'gt', 'gte', 'lt', 'lte', 'in', 'like', 'ilike', 'neq']);

function parseFqn(fqn: string): { schema: string; table: string } {
	const parts = fqn.split('.');
	if (parts.length !== 2) throw new BadRequestException('Invalid FQN, must be schema.table');
	return { schema: parts[0], table: parts[1] };
}

export function quoteIdent(identifier: string): string {
	if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) throw new BadRequestException(`Invalid identifier: ${identifier}`);
	return '"' + identifier.replace(/"/g, '""') + '"';
}

function b64encode(obj: any): string {
	return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

function b64decode<T = any>(s: string): T {
	try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')); } catch { throw new BadRequestException('Invalid cursor'); }
}

@Injectable()
export class QueryService {
	parseSelect(selectParam: string | undefined, allowed: string[] | null): string[] {
		if (!selectParam) return allowed ?? [];
		const cols = selectParam.split(',').map((c) => c.trim()).filter(Boolean);
		if (allowed && allowed.length > 0) {
			for (const c of cols) if (!allowed.includes(c)) throw new BadRequestException(`Column not allowed: ${c}`);
		}
		return cols;
	}

	parseWhere(whereParam: string | undefined, params: any[], startIndex: number): { clause: string; nextIndex: number } {
		if (!whereParam) return { clause: '', nextIndex: startIndex };
		const parts = whereParam.split(',').map((p) => p.trim()).filter(Boolean);
		const clauses: string[] = [];
		let idx = startIndex;
		for (const p of parts) {
			// example: price.gt.100  OR brand.in.(nike,adidas)
			const inMatch = p.match(/^(\w+)\.in\.\((.*)\)$/);
			if (inMatch) {
				const col = inMatch[1];
				const values = inMatch[2].split(/\s*,\s*/);
				const placeholders = values.map(() => `$${idx++}`);
				params.push(...values);
				clauses.push(`${quoteIdent(col)} IN (${placeholders.join(',')})`);
				continue;
			}
			const m = p.match(/^(\w+)\.(\w+)\.(.*)$/);
			if (!m) throw new BadRequestException(`Invalid where segment: ${p}`);
			const col = m[1];
			const op = m[2];
			let val = m[3];
			if (!ALLOWED_OPS.has(op)) throw new BadRequestException(`Operator not allowed: ${op}`);
			if (op === 'like' || op === 'ilike') {
				// allow % in value
			} else {
				// strip quotes for safety on non-like
				val = val.replace(/^\"|\"$/g, '');
			}
			params.push(val);
			const placeholder = `$${idx++}`;
			const operator =
				op === 'eq' ? '=' :
				op === 'neq' ? '!=' :
				op === 'gt' ? '>' :
				op === 'gte' ? '>=' :
				op === 'lt' ? '<' :
				op === 'lte' ? '<=' :
				op === 'like' ? 'LIKE' :
				op === 'ilike' ? 'ILIKE' :
				(() => { throw new BadRequestException(`Unsupported operator: ${op}`); })();
			clauses.push(`${quoteIdent(col)} ${operator} ${placeholder}`);
		}
		return { clause: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '', nextIndex: idx };
	}

	parseOrder(orderParam: string | undefined): string {
		if (!orderParam) return '';
		const col = orderParam.replace(/^-/, '');
		const dir = orderParam.startsWith('-') ? 'DESC' : 'ASC';
		return `ORDER BY ${quoteIdent(col)} ${dir}`;
	}

	buildSelectSql(fqn: string, selectCols: string[], whereSql: string, orderSql: string, limit: number, offset: number, rowFilterSql?: string | null): string {
		const { schema, table } = parseFqn(fqn);
		const cols = selectCols.length ? selectCols.map(quoteIdent).join(', ') : '*';
		const base = `SELECT ${cols} FROM ${quoteIdent(schema)}.${quoteIdent(table)}`;
		const filters = [whereSql.replace(/^WHERE\s+/, '').trim(), rowFilterSql?.trim()].filter(Boolean);
		const whereCombined = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
		return `${base} ${whereCombined} ${orderSql} LIMIT ${limit} OFFSET ${offset}`.trim();
	}

	addCursorWhere(params: any[], cursorField: string, cursorB64: string, isDesc: boolean): { sql: string; nextIndex: number } {
		if (!cursorField || !cursorB64) return { sql: '', nextIndex: params.length + 1 };
		const value = b64decode<any>(cursorB64);
		params.push(value);
		const idx = params.length;
		const op = isDesc ? '<' : '>';
		return { sql: `${quoteIdent(cursorField)} ${op} $${idx}`, nextIndex: idx + 1 };
	}

	encodeCursor(val: any): string { return b64encode(val); }
}
