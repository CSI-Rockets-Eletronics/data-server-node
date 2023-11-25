import {describe, expect, test} from 'bun:test';
import {testNode} from '../test-node';
import {catchError} from '../helpers';
import {environmentKey} from '../setup';
import {curTimeMicros} from '../../src/helpers';

describe('/records', () => {
	test('upload and get', async () => {
		const initial = await catchError(
			testNode.records.get({$query: {environmentKey, device: 'foo'}}),
		);
		expect(initial.records).toHaveLength(0);

		await catchError(
			testNode.records.post({
				environmentKey,
				device: 'foo',
				ts: 100,
				data: {bar100: 'baz100'},
			}),
		);

		expect(
			await catchError(
				testNode.records.get({$query: {environmentKey, device: 'foo'}}),
			),
		).toEqual({
			records: [{data: {bar100: 'baz100'}, ts: 100}],
		});

		await catchError(
			testNode.records.post({
				environmentKey,
				device: 'foo',
				ts: 200,
				data: {bar200: 'baz200'},
			}),
		);

		expect(
			await catchError(
				testNode.records.get({$query: {environmentKey, device: 'foo'}}),
			),
		).toEqual({
			records: [
				{data: {bar200: 'baz200'}, ts: 200},
				{data: {bar100: 'baz100'}, ts: 100},
			],
		});

		await catchError(
			testNode.records.post({
				environmentKey,
				device: 'foo',
				ts: 150,
				data: {bar150: 'baz150'},
			}),
		);

		expect(
			await catchError(
				testNode.records.get({$query: {environmentKey, device: 'foo'}}),
			),
		).toEqual({
			records: [
				{data: {bar200: 'baz200'}, ts: 200},
				{data: {bar150: 'baz150'}, ts: 150},
				{data: {bar100: 'baz100'}, ts: 100},
			],
		});

		// Shouldn't overwrite existing record with same ts
		await catchError(
			testNode.records.post({
				environmentKey,
				device: 'foo',
				ts: 100,
				data: {bar100: 'this should not appear'},
			}),
		);

		expect(
			await catchError(
				testNode.records.get({$query: {environmentKey, device: 'foo'}}),
			),
		).toEqual({
			records: [
				{data: {bar200: 'baz200'}, ts: 200},
				{data: {bar150: 'baz150'}, ts: 150},
				{data: {bar100: 'baz100'}, ts: 100},
			],
		});
	});

	test('upload using automatic ts', async () => {
		await catchError(
			testNode.records.post({
				environmentKey,
				device: 'foo',
				data: {bar100: 'baz100'},
			}),
		);
		await catchError(
			testNode.records.post({
				environmentKey,
				device: 'foo',
				data: {bar200: 'baz200'},
			}),
		);

		const records = await catchError(
			testNode.records.get({$query: {environmentKey, device: 'foo'}}),
		);
		expect(records.records).toHaveLength(2);

		const [later, earlier] = records.records;
		expect(later.data).toEqual({bar200: 'baz200'});
		expect(earlier.data).toEqual({bar100: 'baz100'});
		expect(later.ts).toBeGreaterThan(earlier.ts);
	});

	test('upload batch', async () => {
		await catchError(
			testNode.records.batch.post({
				environmentKey,
				device: 'foo',
				records: [
					{ts: 100, data: {bar100: 'baz100'}},
					{ts: 200, data: {bar200: 'baz200'}},
					{ts: 150, data: {bar150: 'baz150'}},
				],
			}),
		);

		expect(
			await catchError(
				testNode.records.get({$query: {environmentKey, device: 'foo'}}),
			),
		).toEqual({
			records: [
				{data: {bar200: 'baz200'}, ts: 200},
				{data: {bar150: 'baz150'}, ts: 150},
				{data: {bar100: 'baz100'}, ts: 100},
			],
		});

		// Add some overlapping records, which should be ignored
		await catchError(
			testNode.records.batch.post({
				environmentKey,
				device: 'foo',
				records: [
					{ts: 200, data: {bar200: 'this should not appear'}},
					{ts: 150, data: {bar150: 'this should not appear'}},
					{ts: 300, data: {bar200: 'baz200'}},
					{ts: 300, data: {bar200: 'this should not appear'}},
				],
			}),
		);

		expect(
			await catchError(
				testNode.records.get({$query: {environmentKey, device: 'foo'}}),
			),
		).toEqual({
			records: [
				{data: {bar200: 'baz200'}, ts: 300},
				{data: {bar200: 'baz200'}, ts: 200},
				{data: {bar150: 'baz150'}, ts: 150},
				{data: {bar100: 'baz100'}, ts: 100},
			],
		});
	});

	test.each([false, true])(
		'upload and get from multiple sessions',
		async (batchUpload) => {
			const initialSessions = await catchError(
				testNode.sessions.get({$query: {environmentKey}}),
			);
			expect(initialSessions.sessions).toHaveLength(0);

			// Create a new session
			await catchError(
				testNode.sessions.create.post({
					environmentKey,
				}),
			);

			// Upload to the first session
			await catchError(
				batchUpload
					? testNode.records.batch.post({
							environmentKey,
							device: 'foo',
							records: [{ts: curTimeMicros(), data: {bar100: 'baz100'}}],
					  })
					: testNode.records.post({
							environmentKey,
							device: 'foo',
							data: {bar100: 'baz100'},
					  }),
			);

			// Create a new session
			await catchError(
				testNode.sessions.create.post({
					environmentKey,
				}),
			);

			const sessions = await catchError(
				testNode.sessions.get({$query: {environmentKey}}),
			);
			expect(sessions.sessions).toHaveLength(2);

			// Current session should have no records
			const curSessionRecords = await catchError(
				testNode.records.get({$query: {environmentKey, device: 'foo'}}),
			);
			expect(curSessionRecords.records).toHaveLength(0);

			const session1 = sessions.sessions[0];
			const session2 = sessions.sessions[1];

			// Also current session
			const session2Records = await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', sessionName: session2.name},
				}),
			);
			expect(session2Records.records).toHaveLength(0);

			// First session should have the record
			const session1Records = await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', sessionName: session1.name},
				}),
			);
			expect(session1Records.records).toHaveLength(1);

			// Add a record to the current session
			await catchError(
				batchUpload
					? testNode.records.batch.post({
							environmentKey,
							device: 'foo',
							records: [{ts: curTimeMicros(), data: {bar200: 'baz200'}}],
					  })
					: testNode.records.post({
							environmentKey,
							device: 'foo',
							data: {bar200: 'baz200'},
					  }),
			);

			// Current session should have the record
			const curSessionRecordsAfter = await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo'},
				}),
			);
			expect(curSessionRecordsAfter.records).toEqual([
				{data: {bar200: 'baz200'}, ts: expect.any(Number)},
			]);

			// Also current session
			const session2RecordsAfter = await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', sessionName: session2.name},
				}),
			);
			expect(session2RecordsAfter.records).toHaveLength(1);
			expect(session2RecordsAfter).toEqual(curSessionRecordsAfter);

			// First session should have only the first record
			const session1RecordsAfter = await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', sessionName: session1.name},
				}),
			);
			expect(session1RecordsAfter.records).toHaveLength(1);
			expect(session1RecordsAfter.records).toEqual([
				{data: {bar100: 'baz100'}, ts: expect.any(Number)},
			]);
		},
	);

	test('more complicated get', async () => {
		await testNode.records.batch.post({
			environmentKey,
			device: 'foo',
			records: [
				{ts: 100, data: {bar100: 'baz100'}},
				{ts: 200, data: {bar200: 'baz200'}},
			],
		});
		await testNode.records.batch.post({
			environmentKey,
			device: 'oof',
			records: [
				{ts: 100, data: {rab100: 'zab100'}},
				{ts: 200, data: {rab200: 'zab200'}},
			],
		});

		expect([
			await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', startTs: '100'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', startTs: '100', take: '1'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', startTs: '200'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', startTs: '300'},
				}),
			),
		]).toEqual([
			{
				records: [
					{data: {bar100: 'baz100'}, ts: 100},
					{data: {bar200: 'baz200'}, ts: 200},
				],
			},
			{records: [{data: {bar100: 'baz100'}, ts: 100}]},
			{records: [{data: {bar200: 'baz200'}, ts: 200}]},
			{records: []},
		]);

		expect([
			await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', endTs: '200'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', endTs: '200', take: '1'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', endTs: '100'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', endTs: '000'},
				}),
			),
		]).toEqual([
			{
				records: [
					{data: {bar200: 'baz200'}, ts: 200},
					{data: {bar100: 'baz100'}, ts: 100},
				],
			},
			{records: [{data: {bar200: 'baz200'}, ts: 200}]},
			{records: [{data: {bar100: 'baz100'}, ts: 100}]},
			{records: []},
		]);

		expect([
			await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', startTs: '100', endTs: '200'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {
						environmentKey,
						device: 'foo',
						startTs: '100',
						endTs: '200',
						take: '1',
					},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', startTs: '200', endTs: '200'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', startTs: '100', endTs: '100'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, device: 'foo', startTs: '200', endTs: '100'},
				}),
			),
		]).toEqual([
			{
				records: [
					{data: {bar100: 'baz100'}, ts: 100},
					{data: {bar200: 'baz200'}, ts: 200},
				],
			},
			{records: [{data: {bar100: 'baz100'}, ts: 100}]},
			{records: [{data: {bar200: 'baz200'}, ts: 200}]},
			{records: [{data: {bar100: 'baz100'}, ts: 100}]},
			{records: []},
		]);
	});
});
