import assert from 'node:assert';
import {Elysia, t} from 'elysia';
import {prisma} from '../prisma';
import {curTimeMicros, getSessionTimeRange} from '../helpers';
import {maybeSyncWorker} from '../sync-worker';
import {schemas} from './schemas';

export const recordsRoute = new Elysia({prefix: '/records'})
	.post(
		'',
		async ({body}) => {
			// Use createMany to skip duplicates
			await prisma.record.createMany({
				data: [
					{
						environmentKey: body.environmentKey,
						device: body.device,
						ts: body.ts ?? curTimeMicros(),
						data: body.data,
					},
				],
				skipDuplicates: true,
			});

			maybeSyncWorker?.onReceiveRecord();
		},
		{
			detail: {
				summary: 'Upload a single record from a given environment and device.',
			},
			body: t.Object({
				environmentKey: t.String(),
				device: t.String(),
				ts: t.Optional(
					t.Integer({
						description:
							'Unix microseconds. Defaults to the current time of this node.',
					}),
				),
				data: schemas.data,
			}),
		},
	)
	.post(
		'/batch',
		async ({body}) => {
			await prisma.record.createMany({
				data: body.records.map((record) => ({
					environmentKey: body.environmentKey,
					device: body.device,
					ts: record.ts,
					data: record.data,
				})),
				skipDuplicates: true,
			});

			maybeSyncWorker?.onReceiveRecord();
		},
		{
			detail: {
				summary:
					'Upload multiple records from the same environment and device.',
			},
			body: t.Object({
				environmentKey: t.String(),
				device: t.String(),
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
		'/batchGlobal',
		async ({body}) => {
			await prisma.record.createMany({
				data: body.records.map((record) => ({
					environmentKey: record.environmentKey,
					device: record.device,
					ts: record.ts,
					data: record.data,
				})),
				skipDuplicates: true,
			});

			maybeSyncWorker?.onReceiveRecord();
		},
		{
			detail: {
				summary:
					'Upload records across multiple environments and devices at once.',
			},
			body: t.Object({
				records: t.Array(
					t.Object({
						environmentKey: t.String(),
						device: t.String(),
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
			const take = query.take === undefined ? undefined : Number(query.take);

			assert(!Number.isNaN(startTs), 'startTs must be a number');
			assert(!Number.isNaN(endTs), 'endTs must be a number');
			assert(!Number.isNaN(take), 'take must be a number');

			const sessionTimeRange = await getSessionTimeRange(
				query.environmentKey,
				query.sessionName,
			);

			const records = await prisma.record.findMany({
				where: {
					environmentKey: query.environmentKey,
					device: query.device,
					AND: [
						{ts: {gte: startTs, lte: endTs}},
						{ts: {gte: sessionTimeRange.start, lte: sessionTimeRange.end}},
					],
				},
				orderBy: {ts: startTs === undefined ? 'desc' : 'asc'},
				take,
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
				summary: 'List records from a given environment and device.',
			},
			query: t.Object({
				environmentKey: t.String(),
				device: t.String(),
				sessionName: t.Optional(
					t.String({
						description: 'Defaults to the current session.',
					}),
				),
				startTs: t.Optional(
					t.String({
						description:
							'Unix microseconds, inclusive (add 1 to get records after a known record). Defaults to the start of time.',
					}),
				),
				endTs: t.Optional(
					t.String({
						description:
							'Unix microseconds, inclusive (subtract 1 to get records before a known record). Defaults to the end of time.',
					}),
				),
				take: t.Optional(
					t.String({
						description:
							'Maximum number of records to return. If `startTs` is specified, returns earliest records first. Otherwise, returns latest records first. Defaults to infinity.',
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
	)
	.get(
		'/multiDevice',
		async ({query}) => {
			const sessionTimeRange = await getSessionTimeRange(
				query.environmentKey,
				query.sessionName,
			);

			const devices = query.devices.split(',');

			// eslint-disable-next-line @typescript-eslint/ban-types
			const records: Record<string, {ts: number; data: unknown} | null> = {};

			await Promise.all(
				devices.map(async (device) => {
					const record = await prisma.record.findFirst({
						where: {
							environmentKey: query.environmentKey,
							device,
							ts: {gte: sessionTimeRange.start, lte: sessionTimeRange.end},
						},
						orderBy: {ts: 'desc'},
						select: {ts: true, data: true},
					});

					records[device] = record
						? {
								ts: Number(record.ts),
								data: record.data,
						  }
						: null;
				}),
			);

			return records;
		},
		{
			detail: {
				summary:
					'List the latest record from each of the given devices in a given environment.',
			},
			query: t.Object({
				environmentKey: t.String(),
				devices: t.String({
					description: 'A comma-separated list of devices to poll.',
				}),
				sessionName: t.Optional(
					t.String({
						description: 'Defaults to the current session.',
					}),
				),
			}),
			response: t.Record(
				t.String(),
				t.Union([
					t.Object({
						ts: schemas.unixMicros,
						data: schemas.data,
					}),
					t.Null(),
				]),
				{
					description:
						'Returns a record with a key for each device. Each value will either be an object with `ts` and `data` fields, or `null` if no record exists for that device.',
				},
			),
		},
	);
