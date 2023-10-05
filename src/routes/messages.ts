import assert from 'node:assert';
import {Elysia, t} from 'elysia';
import {prisma} from '../prisma';
import {
	getOrInitCurNodeInstance,
	joinPath,
	toNodeInstance,
	toUnixMicros,
} from '../helpers';
import {schemas} from './schemas';

export const messagesRoute = new Elysia({prefix: '/messages'})
	.post(
		'',
		async ({body}) => {
			const curNodeInstance = await getOrInitCurNodeInstance(
				body.environmentKey,
			);
			const fullPath = joinPath(curNodeInstance, body.path);

			await prisma.message.create({
				data: {
					environmentKey: body.environmentKey,
					path: fullPath,
					ts: toUnixMicros(new Date()),
					data: body.data,
				},
				select: {},
			});
		},
		{
			detail: {
				summary: 'Upload a single message from a given environment and path.',
			},
			body: t.Object({
				environmentKey: t.String(),
				path: schemas.pathWithoutNodeInstance,
				data: schemas.data,
			}),
		},
	)
	.get(
		'/next',
		async ({query}) => {
			const afterTs =
				query.afterTs === undefined ? undefined : Number(query.afterTs);

			assert(!Number.isNaN(afterTs), 'afterTs must be a number');

			const curNodeInstance =
				query.session === undefined
					? await getOrInitCurNodeInstance(query.environmentKey)
					: toNodeInstance(query.session);

			const fullPath = joinPath(curNodeInstance, query.path);
			const matchPrefix = fullPath.endsWith('/');

			const message = await prisma.message.findFirst({
				where: {
					environmentKey: query.environmentKey,
					path: matchPrefix ? {startsWith: fullPath} : fullPath,
					ts: {gt: afterTs},
				},
				orderBy: {ts: 'asc'},
				select: {ts: true, data: true},
			});

			if (!message) {
				return null;
			}

			return {
				ts: Number(message.ts),
				data: message.data,
			};
		},
		{
			detail: {
				summary:
					'List the next message from a given environment and path after a given `ts`.',
			},
			query: t.Object({
				environmentKey: t.String(),
				path: schemas.pathPrefixWithoutNodeInstance,
				session: t.Optional(
					t.String({
						default: 'Current session',
					}),
				),
				afterTs: t.Optional(
					t.String({
						description:
							'Unix microseconds, exclusive. E.g. the exact `ts` of the last message received.',
						default: 'Start of time',
					}),
				),
			}),
			response: t.Union([
				t.Object({
					ts: schemas.unixMicros,
					data: schemas.data,
				}),
				t.Null(),
			]),
		},
	);
