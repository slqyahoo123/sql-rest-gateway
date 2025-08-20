export const TOKENS = {
	META_DB: Symbol('META_DB'),
	REDIS: Symbol('REDIS'),
};

export type TableFqn = string; // e.g., 'public.products'

export type KeyPolicy = {
	id: number;
	table_fqn: TableFqn;
	allowed_fields: string[];
	row_filter_sql: string | null;
};

export type ApiKeyRecord = {
	id: number;
	project_id: number;
	active: boolean;
	rate_rps: number;
	daily_quota: number;
	policies: KeyPolicy[];
};
