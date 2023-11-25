import assert from 'node:assert';
import {Elysia, t} from 'elysia';
import {curTimeMicros} from '../helpers';
import {prisma} from '../prisma';
import {schemas} from './schemas';

function generateSessionName(createdAtMicros: number) {
	const milliseconds = Math.floor(createdAtMicros / 1000);
	const microsOnly = createdAtMicros % 1000;
	return `[${new Date(milliseconds).toISOString()}::${microsOnly}]`;
}

export const sessionsRoute = new Elysia({prefix: '/sessions'})
	.post(
		'/create',
		async ({body}) => {
			const createdAt = curTimeMicros();
			const name = body.name ?? generateSessionName(createdAt);

			await prisma.session.create({
				data: {
					environmentKey: body.environmentKey,
					name,
					createdAt,
				},
				select: {environmentKey: true}, // Can't select nothing
			});

			return {name, createdAt};
		},
		{
			detail: {
				summary: 'Start a new session for a given environment.',
			},
			body: t.Object({
				environmentKey: t.String(),
				name: t.Optional(
					t.String({
						description:
							'Defaults to an autogenerated name based with the current timestamp.',
					}),
				),
			}),
			response: t.Object({
				name: t.String(),
				createdAt: schemas.unixMicros,
			}),
		},
	)
	.get(
		'',
		async ({query}) => {
			const createdAfter =
				query.createdAfter === undefined
					? undefined
					: Number(query.createdAfter);
			const createdBefore =
				query.createdBefore === undefined
					? undefined
					: Number(query.createdBefore);

			assert(!Number.isNaN(createdAfter), 'createdAfter must be a number');
			assert(!Number.isNaN(createdBefore), 'createdBefore must be a number');

			const sessions = await prisma.session.findMany({
				where: {
					environmentKey: query.environmentKey,
					createdAt: {gte: createdAfter, lte: createdBefore},
				},
				orderBy: {createdAt: 'asc'},
				select: {name: true, createdAt: true},
			});

			return {
				sessions: sessions.map((session) => ({
					name: session.name,
					createdAt: Number(session.createdAt),
				})),
			};
		},
		{
			detail: {
				summary: 'List sessions for a given environment.',
			},
			query: t.Object({
				environmentKey: t.String(),
				createdAfter: t.Optional(
					t.String({
						description:
							'Unix microseconds, inclusive (add 1 to get sessions after a known session). Defaults to the start of time.',
					}),
				),
				createdBefore: t.Optional(
					t.String({
						description:
							'Unix microseconds, inclusive (subtract 1 to get sessions before a known session). Defaults to the end of time.',
					}),
				),
			}),
			response: t.Object({
				sessions: t.Array(
					t.Object({
						name: t.String(),
						createdAt: schemas.unixMicros,
					}),
					{
						description: 'In ascending order of creation time.',
					},
				),
			}),
		},
	)
	.get(
		'/current',
		async ({query}) => {
			const session = await prisma.session.findFirst({
				where: {
					environmentKey: query.environmentKey,
				},
				orderBy: {createdAt: 'desc'},
				select: {name: true, createdAt: true},
			});

			if (!session) {
				return 'NONE';
			}

			return {
				name: session.name,
				createdAt: Number(session.createdAt),
			};
		},
		{
			detail: {
				summary: 'Get the current session for a given environment.',
			},
			query: t.Object({
				environmentKey: t.String(),
			}),
			response: t.Union([
				t.Object({
					name: t.String(),
					createdAt: schemas.unixMicros,
				}),
				t.Literal('NONE'), // Elysia doesn't like returning null
			]),
		},
	);
