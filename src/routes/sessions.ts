import {Elysia, t} from 'elysia';
import {env} from '../env';
import {createSession} from '../helpers';
import {schemas} from './schemas';

export const sessionsRoute = new Elysia({prefix: '/sessions'}).post(
	'/create',
	async ({body}) => {
		if (!env.IS_SESSION_MAKER) {
			throw new Error('This node is not a session maker');
		}

		const session = await createSession(body.environmentKey);
		return {
			session: session.session,
			createdAt: Number(session.createdAt),
		};
	},
	{
		body: t.Object({
			environmentKey: t.String(),
		}),
		response: t.Object({
			session: t.String(),
			createdAt: schemas.unixMicros,
		}),
	},
);
