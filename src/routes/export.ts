/* eslint-disable @typescript-eslint/no-duplicate-type-constituents */
import {Elysia, t} from 'elysia';
import {Prisma} from '@prisma/client';
import {getSessionTimeRange, parseQueryFilterTs} from '../helpers';
import {prisma} from '../prisma';
import {queryFilterTsDesc} from './schemas';

export const exportRoute = new Elysia({prefix: '/export'}).get(
	'/:environmentKey/:sessionName/:device/records',
	async ({params, query, set}) => {
		const startTs = parseQueryFilterTs(query.startTs);
		const endTs = parseQueryFilterTs(query.endTs);

		const sessionTimeRange = await getSessionTimeRange(
			params.environmentKey,
			params.sessionName === 'latest' ? undefined : params.sessionName,
		);

		// @ts-expect-error - unused type; guard $queryRaw against schema changes
		type _assertTypesForQueryRaw =
			| Prisma.RecordSelect['ts']
			| Prisma.RecordSelect['data']
			| Prisma.RecordWhereInput['environmentKey']
			| Prisma.RecordWhereInput['device']
			| Prisma.RecordWhereInput['ts']
			| Prisma.RecordOrderByWithRelationInput['ts'];

		type Record = {ts: string; data: string};

		const records = await prisma.$queryRaw<Record[]>`
			select "ts"::text, "data"::text
			from "Record"
			where "environmentKey" = ${params.environmentKey}
				and "device" = ${params.device}
				${startTs === undefined ? Prisma.empty : Prisma.sql`and "ts" >= ${startTs}`}
				${endTs === undefined ? Prisma.empty : Prisma.sql`and "ts" <= ${endTs}`}
				${
					sessionTimeRange.start === undefined
						? Prisma.empty
						: Prisma.sql`and "ts" >= ${sessionTimeRange.start}`
				}
				${
					sessionTimeRange.end === undefined
						? Prisma.empty
						: Prisma.sql`and "ts" <= ${sessionTimeRange.end}`
				}
			order by "ts" asc
			;`;

		let csv = 'ts,data\n'; // Start with header

		for (const record of records) {
			csv += `${record.ts},"${record.data.replaceAll('"', '""')}"\n`;
		}

		set.headers['Content-Type'] = 'text/csv';
		return csv;
	},
	{
		detail: {
			summary:
				'List all records from a given environment, session, and device, in CSV format. Records are sorted by timestamp (ascending).',
		},
		params: t.Object({
			environmentKey: t.String(),
			sessionName: t.String({
				description: 'Use `latest` to get the latest session.',
			}),
			device: t.String(),
		}),
		query: t.Object({
			startTs: t.Optional(
				t.String({
					description: `${queryFilterTsDesc} Inclusive (add 1 to get records after a known record). Defaults to the start of time.`,
				}),
			),
			endTs: t.Optional(
				t.String({
					description: `${queryFilterTsDesc} Inclusive (subtract 1 to get records before a known record). Defaults to the end of time.`,
				}),
			),
		}),

		response: t.String({
			description: 'CSV file',
		}),
	},
);
