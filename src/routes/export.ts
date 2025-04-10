/* eslint-disable @typescript-eslint/no-duplicate-type-constituents */
import {Elysia, t} from 'elysia';
import {Prisma} from '@prisma/client';
import {getSessionTimeRange, parseQueryFilterTs} from '../helpers';
import {prisma} from '../prisma';
import {queryFilterTsDesc} from './schemas';

const LATEST = 'latest';
const ALL = 'all';

function toCsvLine(values: string[]): string {
	return (
		values.map((value) => `"${value.replaceAll('"', '""')}"`).join(',') + '\n'
	);
}

export const exportRoute = new Elysia({prefix: '/export'}).get(
	'/:environmentKey/:sessionName/:device/records',
	async ({params, query, set}) => {
		const environmentKey = decodeURIComponent(params.environmentKey);
		const sessionName = decodeURIComponent(params.sessionName);
		const device = decodeURIComponent(params.device);

		const startTs = parseQueryFilterTs(query.startTs);
		const endTs = parseQueryFilterTs(query.endTs);

		const sessionTimeRange =
			sessionName === ALL
				? null
				: await getSessionTimeRange(
						environmentKey,
						sessionName === LATEST ? undefined : sessionName,
				  );

		// @ts-expect-error - unused type; guard $queryRaw against schema changes
		type _assertTypesForQueryRaw =
			| Prisma.RecordSelect['ts']
			| Prisma.RecordSelect['data']
			| Prisma.RecordWhereInput['environmentKey']
			| Prisma.RecordWhereInput['device']
			| Prisma.RecordWhereInput['ts']
			| Prisma.RecordOrderByWithRelationInput['ts'];

		type _Record = {ts: string; data: string};

		const records = await prisma.$queryRaw<_Record[]>`
			select "ts"::text, "data"::text
			from "Record"
			where "environmentKey" = ${environmentKey}
				and "device" = ${device}
				${startTs === undefined ? Prisma.empty : Prisma.sql`and "ts" >= ${startTs}`}
				${endTs === undefined ? Prisma.empty : Prisma.sql`and "ts" <= ${endTs}`}
				${
					sessionTimeRange?.start === undefined
						? Prisma.empty
						: Prisma.sql`and "ts" >= ${sessionTimeRange.start}`
				}
				${
					sessionTimeRange?.end === undefined
						? Prisma.empty
						: Prisma.sql`and "ts" <= ${sessionTimeRange.end}`
				}
			order by "ts" asc
			;`;

		const headers = new Set<string>();

		// For performance
		type RecordWithParsed = _Record & {parsed?: Record<string, unknown>};
		const recordsWithParsed: RecordWithParsed[] = records;

		for (const record of recordsWithParsed) {
			const parsed = JSON.parse(record.data);

			if (parsed === null || parsed === undefined) {
				continue;
			}

			const parsedObject = typeof parsed === 'object' ? parsed : {data: parsed};
			record.parsed = parsedObject;

			for (const key of Object.keys(parsedObject)) {
				headers.add(key);
			}
		}

		const headersArray = Array.from(headers);

		let csv: string;

		if (headersArray.length > 0) {
			csv = toCsvLine(['ts', ...headersArray]);

			for (const record of recordsWithParsed) {
				if (record.parsed === null || record.parsed === undefined) {
					continue;
				}

				const values = headersArray.map(
					(header) => JSON.stringify(record.parsed?.[header]) ?? '',
				);
				csv += toCsvLine([record.ts, ...values]);
			}
		} else {
			csv = toCsvLine(['ts', 'data']);

			for (const record of records) {
				csv += toCsvLine([record.ts, record.data]);
			}
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
				description: `Use \`${LATEST}\` to get the latest session, or \`${ALL}\` to get all sessions.`,
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
