import {t} from 'elysia';

export const schemas = {
	unixMicros: t.Integer({description: 'Unix microseconds.'}),
	data: t.Any(),
};

export const queryFilterTsDesc =
	'Unix microseconds. Negative to subtract from current time.';
