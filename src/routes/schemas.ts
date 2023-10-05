import {t} from 'elysia';

export const schemas = {
	pathWithoutNodeInstance: t.String({
		description:
			"Path without the current node instance ('nodeName:nodeSession/' if this node is a session maker, or 'nodeName/' otherwise).",
	}),
	pathPrefixWithoutNodeInstance: t.String({
		description:
			"Path without the current node instance. If ending in a '/', the path will be matched by prefix. Otherwise, the path will be matched exactly.",
	}),
	unixMicros: t.Integer({description: 'Unix microseconds.'}),
	data: t.Any(),
};
