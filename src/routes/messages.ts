import assert from 'node:assert';
import {Elysia, t} from 'elysia';
import {prisma} from '../prisma';
import {
	curTimeMicros,
	getOrInitCurNodeInstance,
	joinPath,
	splitPath,
	toNodeInstance,
} from '../helpers';
import {schemas} from './schemas';

export async function createMessage(message: {
	environmentKey: string;
	path: string;
	data: any;
}) {
	const curNodeInstance = await getOrInitCurNodeInstance(
		message.environmentKey,
	);
	const fullPath = joinPath(curNodeInstance, message.path);

	await prisma.message.create({
		data: {
			environmentKey: message.environmentKey,
			path: fullPath,
			ts: curTimeMicros(),
			data: message.data,
		},
		select: {ts: true},
	});
}

export const messagesRoute = new Elysia({prefix: '/messages'})
	.post(
		'',
		async ({body}) => {
			await createMessage(body);
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
	)
	.get(
		'/nextGlobal',
		async ({query}) => {
			const afterTs =
				query.afterTs === undefined ? undefined : Number(query.afterTs);

			assert(!Number.isNaN(afterTs), 'afterTs must be a number');

			const message = await prisma.message.findFirst({
				where: {
					ts: {gt: afterTs},
				},
				orderBy: {ts: 'asc'},
				select: {environmentKey: true, path: true, ts: true, data: true},
			});

			if (!message) {
				return null;
			}

			const pathWithoutNodeInstance = joinPath(
				...splitPath(message.path).slice(1),
			);

			return {
				environmentKey: message.environmentKey,
				path: pathWithoutNodeInstance,
				ts: Number(message.ts),
				data: message.data,
			};
		},
		{
			detail: {
				summary:
					'List the next message across all environments, sessions, and paths after a given `ts`.',
			},
			query: t.Object({
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
					environmentKey: t.String(),
					path: schemas.pathPrefixWithoutNodeInstance,
					ts: schemas.unixMicros,
					data: schemas.data,
				}),
				t.Null(),
			]),
		},
	);
