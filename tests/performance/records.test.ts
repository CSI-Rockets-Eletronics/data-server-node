/* eslint-disable no-await-in-loop */
import {describe, expect, test} from 'bun:test';
import {testNode} from '../test-node';
import {catchError} from '../helpers';
import {environmentKey, environmentKey2} from '../setup';
import {curTimeMicros} from '../../src/helpers';

function createManyRecords() {
	const firstTs = curTimeMicros();
	const manyRecords: Array<{ts: number; data: unknown}> = [];

	for (let i = 0; i < 5000; i++) {
		manyRecords.push({
			ts: firstTs + i,
			data: {bar: 'baz'},
		});
	}

	return manyRecords;
}

describe('/records', () => {
	test('upload and get many records', async () => {
		for (const key of [environmentKey, environmentKey2]) {
			for (let session = 0; session < 5; session++) {
				await catchError(testNode.sessions.create.post({environmentKey: key}));

				for (let device = 0; device < 5; device++) {
					await catchError(
						testNode.records.batch.post({
							environmentKey: key,
							device: `foo${device}`,
							records: createManyRecords(),
						}),
					);
				}
			}
		}

		const records = await catchError(
			testNode.records.get({
				$query: {
					environmentKey,
					device: 'foo0',
					startTs: '0', // Get earliest records first
				},
			}),
		);
		expect(records.records.length).toBeGreaterThan(0); // Sanity check

		const minTs = records.records.at(0)!.ts;
		const maxTs = records.records.at(-1)!.ts;
		const tsDiff = maxTs - minTs;

		for (let i = 0; i < 10; i++) {
			const recordsInRange = await catchError(
				testNode.records.get({
					$query: {
						environmentKey,
						device: 'foo0',
						startTs: Math.round(minTs + tsDiff / 4).toString(),
						endTs: Math.round(maxTs - tsDiff / 4).toString(),
					},
				}),
			);
			expect(recordsInRange.records.length).toBeGreaterThan(0); // Sanity check
		}
	}, 0); // No timeout
});
