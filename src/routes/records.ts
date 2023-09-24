import {Elysia, t} from 'elysia';
import {prisma} from '../prisma';

export const recordsRoute = new Elysia({prefix: '/records'}).post(
	'',
	async ({body}) => {
		const pathCreatedAtMs = Date.now() - body.ts / 1000;

		await prisma.record.upsert({
			where: {
				environmentKey_path_ts: {
					environmentKey: body.environmentKey,
					path: body.path,
					ts: body.ts,
				},
			},
			create: {
				pathInstance: {
					connectOrCreate: {
						where: {
							environmentKey_path: {
								environmentKey: body.environmentKey,
								path: body.path,
							},
						},
						create: {
							environmentKey: body.environmentKey,
							path: body.path,
							createdAt: new Date(pathCreatedAtMs),
						},
					},
				},
				ts: body.ts,
				data: body.data, // eslint-disable-line @typescript-eslint/no-unsafe-assignment
				sentToParent: false,
			},
			update: {}, // Do nothing, as records are immutable
		});
	},
	{
		body: t.Object({
			environmentKey: t.String(),
			path: t.String(),
			ts: t.Integer(),
			data: t.Any(),
		}),
	},
);
