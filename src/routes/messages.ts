import assert from 'node:assert';
import {Elysia, t} from 'elysia';
import {prisma} from '../prisma';
import {curTimeMicros, getSessionTimeRange} from '../helpers';
import {schemas} from './schemas';

export const messagesRoute = new Elysia({prefix: '/messages'})
	.post(
		'',
		async ({body}) => {
			await prisma.message.create({
				data: {
					environmentKey: body.environmentKey,
					device: body.device,
					ts: curTimeMicros(),
					data: body.data,
				},
				select: {environmentKey: true}, // Can't select nothing
			});
		},
		{
			detail: {
				summary: 'Upload a single message from a given environment and device.',
			},
			body: t.Object({
				environmentKey: t.String(),
				device: t.String(),
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

			const sessionTimeRange =
				query.sessionName === undefined
					? undefined
					: await getSessionTimeRange(query.environmentKey, query.sessionName);

			const message = await prisma.message.findFirst({
				where: {
					environmentKey: query.environmentKey,
					device: query.device,
					AND: [
						{ts: {gt: afterTs}},
						sessionTimeRange
							? {ts: {gte: sessionTimeRange.start, lte: sessionTimeRange.end}}
							: {},
					],
				},
				orderBy: {ts: 'asc'},
				select: {ts: true, data: true},
			});

			if (!message) {
				return 'NONE';
			}

			return {
				ts: Number(message.ts),
				data: message.data,
			};
		},
		{
			detail: {
				summary:
					'List the next message from a given environment and device after a given `ts`.',
			},
			query: t.Object({
				environmentKey: t.String(),
				device: t.String(),
				sessionName: t.Optional(
					t.String({
						description: 'Defaults to the current session.',
					}),
				),
				afterTs: t.Optional(
					t.String({
						description:
							'Unix microseconds, exclusive. E.g. the exact `ts` of the last message received. Defaults to the start of time.',
					}),
				),
			}),
			response: t.Union([
				t.Object({
					ts: schemas.unixMicros,
					data: schemas.data,
				}),
				t.Literal('NONE'), // Elysia doesn't like returning null
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
				select: {environmentKey: true, device: true, ts: true, data: true},
			});

			if (!message) {
				return 'NONE';
			}

			return {
				environmentKey: message.environmentKey,
				device: message.device,
				ts: Number(message.ts),
				data: message.data,
			};
		},
		{
			detail: {
				summary:
					'List the next message across all environments, sessions, and devices after a given `ts`.',
			},
			query: t.Object({
				afterTs: t.Optional(
					t.String({
						description:
							'Unix microseconds, exclusive. E.g. the exact `ts` of the last message received. Defaults to the start of time.',
					}),
				),
			}),
			response: t.Union([
				t.Object({
					environmentKey: t.String(),
					device: t.String(),
					ts: schemas.unixMicros,
					data: schemas.data,
				}),
				t.Literal('NONE'), // Elysia doesn't like returning null
			]),
		},
	);
