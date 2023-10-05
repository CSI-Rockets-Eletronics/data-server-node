import assert from 'node:assert';
import {Elysia, t} from 'elysia';
import {prisma} from '../prisma';
import {getOrInitCurNodeInstance, joinPath, toNodeInstance} from '../helpers';
import {schemas} from './schemas';

export const recordsRoute = new Elysia({prefix: '/records'})
	.post(
		'',
		async ({body}) => {
			const curNodeInstance = await getOrInitCurNodeInstance(
				body.environmentKey,
			);
			const fullPath = joinPath(curNodeInstance, body.path);

			await prisma.record.upsert({
				where: {
					environmentKey_path_ts: {
						environmentKey: body.environmentKey,
						path: fullPath,
						ts: body.ts,
					},
				},
				create: {
					environmentKey: body.environmentKey,
					path: fullPath,
					ts: body.ts,
					data: body.data,
				},
				update: {}, // Do nothing, as records are immutable
				select: {},
			});
		},
		{
			detail: {
				summary: 'Upload a single record from a given environment and path.',
			},
			body: t.Object({
				environmentKey: t.String(),
				path: schemas.pathWithoutNodeInstance,
				ts: schemas.unixMicros,
				data: schemas.data,
			}),
		},
	)
	.post(
		'/batch',
		async ({body}) => {
			const curNodeInstance = await getOrInitCurNodeInstance(
				body.environmentKey,
			);
			const fullPath = joinPath(curNodeInstance, body.path);

			await prisma.record.createMany({
				data: body.records.map((record) => ({
					environmentKey: body.environmentKey,
					path: fullPath,
					ts: record.ts,
					data: record.data,
				})),
				skipDuplicates: true,
			});
		},
		{
			detail: {
				summary: 'Upload multiple records from the same environment and path.',
			},
			body: t.Object({
				environmentKey: t.String(),
				path: schemas.pathWithoutNodeInstance,
				records: t.Array(
					t.Object({
						ts: schemas.unixMicros,
						data: schemas.data,
					}),
				),
			}),
		},
	)
	.post(
		'/batchMany',
		async ({body}) => {
			const uniqueEnvironmentKeys = [
				...new Set(body.records.map((r) => r.environmentKey)),
			];

			// `environmentKey` -> `curNodeInstance` for that environment
			const curNodeInstancesMap = new Map(
				await Promise.all(
					uniqueEnvironmentKeys.map(
						async (environmentKey) =>
							[
								environmentKey,
								await getOrInitCurNodeInstance(environmentKey),
							] as const,
					),
				),
			);

			await prisma.record.createMany({
				data: body.records.map((record) => {
					const curNodeInstance = curNodeInstancesMap.get(
						record.environmentKey,
					)!;
					const fullPath = joinPath(curNodeInstance, record.path);

					return {
						environmentKey: record.environmentKey,
						path: fullPath,
						ts: record.ts,
						data: record.data,
					};
				}),
				skipDuplicates: true,
			});
		},
		{
			detail: {
				summary:
					'Upload records across multiple environments and paths at once.',
			},
			body: t.Object({
				records: t.Array(
					t.Object({
						environmentKey: t.String(),
						path: schemas.pathWithoutNodeInstance,
						ts: schemas.unixMicros,
						data: schemas.data,
					}),
				),
			}),
		},
	)
	.get(
		'',
		async ({query}) => {
			const startTs =
				query.startTs === undefined ? undefined : Number(query.startTs);
			const endTs = query.endTs === undefined ? undefined : Number(query.endTs);

			assert(!Number.isNaN(startTs), 'startTs must be a number');
			assert(!Number.isNaN(endTs), 'endTs must be a number');

			const curNodeInstance =
				query.session === undefined
					? await getOrInitCurNodeInstance(query.environmentKey)
					: toNodeInstance(query.session);

			const fullPath = joinPath(curNodeInstance, query.path);
			const matchPrefix = fullPath.endsWith('/');

			const records = await prisma.record.findMany({
				where: {
					environmentKey: query.environmentKey,
					path: matchPrefix ? {startsWith: fullPath} : fullPath,
					ts: {gte: startTs, lte: endTs},
				},
				orderBy: {ts: startTs === undefined ? 'desc' : 'asc'},
				take: query.take,
				select: {ts: true, data: true},
			});

			return {
				records: records.map((record) => ({
					ts: Number(record.ts),
					data: record.data,
				})),
			};
		},
		{
			detail: {
				summary: 'List records from a given environment and path.',
			},
			query: t.Object({
				environmentKey: t.String(),
				path: schemas.pathPrefixWithoutNodeInstance,
				session: t.Optional(
					t.String({
						default: 'Current session',
					}),
				),
				startTs: t.Optional(
					t.String({
						description:
							'Unix microseconds, inclusive (add 1 to get records after a known record).',
						default: 'Start of time',
					}),
				),
				endTs: t.Optional(
					t.String({
						description:
							'Unix microseconds, inclusive (subtract 1 to get records before a known record).',
						default: 'End of time',
					}),
				),
				take: t.Optional(
					t.Integer({
						description:
							'Maximum number of records to return. If `startTs` is specified, returns earliest records first. Otherwise, returns latest records first.',
						default: 'Infinity',
					}),
				),
			}),
			response: t.Object({
				records: t.Array(
					t.Object({
						ts: schemas.unixMicros,
						data: schemas.data,
					}),
				),
			}),
		},
	);
