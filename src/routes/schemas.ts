import {t} from 'elysia';

export const schemas = {
	unixMicros: t.Integer({description: 'Unix microseconds.'}),
	data: t.Any(),
};
