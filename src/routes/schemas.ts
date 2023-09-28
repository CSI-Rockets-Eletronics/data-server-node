import {t} from 'elysia';

export const schemas = {
	pathWithoutNodeInstance: t.String({
		description:
			"Path without the current node instance ('nodeName:nodeSession/' if this node is a session maker, or 'nodeName/' otherwise).",
	}),
	unixMicros: t.Integer({description: 'Unix microseconds.'}),
	data: t.Any(),
};
