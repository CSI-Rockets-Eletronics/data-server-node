import assert from 'node:assert';
import {Elysia, t} from 'elysia';
import {env} from '../env';
import {createSession} from '../helpers';
import {prisma} from '../prisma';
import {schemas} from './schemas';

function assertIsSessionMaker() {
	if (!env.IS_SESSION_MAKER) {
		throw new Error('This node is not a session maker');
	}
}

export const sessionsRoute = new Elysia({prefix: '/sessions'})
	.post(
		'/create',
		async ({body}) => {
			assertIsSessionMaker();

			const session = await createSession(body.environmentKey);
			return {
				session: session.session,
				createdAt: Number(session.createdAt),
			};
		},
		{
			detail: {
				summary: 'Start a new session for a given environment.',
			},
			body: t.Object({
				environmentKey: t.String(),
			}),
			response: t.Object({
				session: t.String(),
				createdAt: schemas.unixMicros,
			}),
		},
	)
	.get(
		'',
		async ({query}) => {
			assertIsSessionMaker();

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
				select: {session: true, createdAt: true},
			});

			return {
				sessions: sessions.map((session) => ({
					session: session.session,
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
							'Unix microseconds, inclusive (add 1 to get sessions after a known session).',
						default: 'Start of time',
					}),
				),
				createdBefore: t.Optional(
					t.String({
						description:
							'Unix microseconds, inclusive (subtract 1 to get sessions before a known session).',
						default: 'End of time',
					}),
				),
			}),
			response: t.Object({
				sessions: t.Array(
					t.Object({
						session: t.String(),
						createdAt: schemas.unixMicros,
					}),
					{
						description: 'In ascending order of creation time.',
					},
				),
			}),
		},
	);
