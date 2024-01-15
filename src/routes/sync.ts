import {Elysia, t} from 'elysia';
import {prisma} from '../prisma';
import {env} from '../env';

export const syncRoute = new Elysia({prefix: '/sync'}).get(
	'/status',
	async () => {
		const [recordsTotal, recordsSentToParent] = await prisma.$transaction([
			prisma.record.count(),
			prisma.record.count({where: {sentToParent: true}}),
		]);
		const recordsNotSentToParent = recordsTotal - recordsSentToParent;

		return {
			parentNodeUrl: env.PARENT_NODE_URL ?? null,
			recordsTotal,
			recordsSentToParent,
			recordsSentToParentFraction: recordsSentToParent / recordsTotal,
			recordsNotSentToParent,
			recordsNotSentToParentFraction: recordsNotSentToParent / recordsTotal,
		};
	},
	{
		detail: {
			summary: 'Get the status of the global sync worker',
		},
		response: t.Object({
			parentNodeUrl: t.Union([t.String(), t.Null()]),
			recordsTotal: t.Number(),
			recordsSentToParent: t.Number(),
			recordsSentToParentFraction: t.Number(),
			recordsNotSentToParent: t.Number(),
			recordsNotSentToParentFraction: t.Number(),
		}),
	},
);
