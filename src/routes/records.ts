import {Elysia, t} from 'elysia';
import {prisma} from '../prisma';
import {getOrInitCurNodeInstance, joinPath} from '../helpers';

export const recordsRoute = new Elysia({prefix: '/records'})
	.post(
		'',
		async ({body}) => {
			const curNodeInstance = await getOrInitCurNodeInstance(
				body.environmentKey,
			);

			const fullPath = joinPath(curNodeInstance, body.path);
			const pathCreatedAtMs = Date.now() - body.ts / 1000;

			await prisma.record.upsert({
				where: {
					environmentKey_path_ts: {
						environmentKey: body.environmentKey,
						path: fullPath,
						ts: body.ts,
					},
				},
				create: {
					pathInstance: {
						connectOrCreate: {
							where: {
								environmentKey_path: {
									environmentKey: body.environmentKey,
									path: fullPath,
								},
							},
							create: {
								environmentKey: body.environmentKey,
								path: fullPath,
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
				path: t.String({
					description:
						"Will be prefixed with 'nodeName:nodeSession/' if this node is a session maker, or 'nodeName/' otherwise.",
				}),
				ts: t.Integer(),
				data: t.Any(),
			}),
		},
	)
	.get(
		'/list',
		async ({query}) => {
			console.log(query.startTs, query.endTs);
			// TODO
		},
		{
			query: t.Object({
				environmentKey: t.String(),
				path: t.String(),
				startTs: t.Optional(
					t.String({
						description: 'Inclusive (+1 to get records after a known record).',
						default: 'Start of time',
					}),
				),
				endTs: t.Optional(
					t.String({
						description: 'Inclusive (-1 to get records before a known record).',
						default: 'End of time',
					}),
				),
				take: t.Optional(
					t.Integer({
						description:
							'Maximum number of records to return. If `startTs` is specified, returns earliest records. Otherwise, returns latest records.',
						default: 'Infinity',
					}),
				),
			}),
		},
	);
