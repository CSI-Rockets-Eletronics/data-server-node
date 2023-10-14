import {describe, expect, test} from 'bun:test';
import {testNode} from '../test-node';
import {catchError} from '../helpers';
import {environmentKey} from '../setup';

describe('/records', () => {
	test('upload and get', async () => {
		const initial = await catchError(
			testNode.records.get({$query: {environmentKey, path: 'foo'}}),
		);
		expect(initial.records).toHaveLength(0);

		await catchError(
			testNode.records.post({
				environmentKey,
				path: 'foo',
				ts: 100,
				data: {bar100: 'baz100'},
			}),
		);

		expect(
			await catchError(
				testNode.records.get({$query: {environmentKey, path: 'foo'}}),
			),
		).toMatchSnapshot();

		await catchError(
			testNode.records.post({
				environmentKey,
				path: 'foo',
				ts: 200,
				data: {bar200: 'baz200'},
			}),
		);

		expect(
			await catchError(
				testNode.records.get({$query: {environmentKey, path: 'foo'}}),
			),
		).toMatchSnapshot();

		await catchError(
			testNode.records.post({
				environmentKey,
				path: 'foo',
				ts: 150,
				data: {bar150: 'baz150'},
			}),
		);

		expect(
			await catchError(
				testNode.records.get({$query: {environmentKey, path: 'foo'}}),
			),
		).toMatchSnapshot();

		// Shouldn't overwrite existing record with same ts
		await catchError(
			testNode.records.post({
				environmentKey,
				path: 'foo',
				ts: 100,
				data: {bar100: 'this should not appear'},
			}),
		);

		expect(
			await catchError(
				testNode.records.get({$query: {environmentKey, path: 'foo'}}),
			),
		).toMatchSnapshot();
	});

	test('upload batch', async () => {
		await catchError(
			testNode.records.batch.post({
				environmentKey,
				path: 'foo',
				records: [
					{ts: 100, data: {bar100: 'baz100'}},
					{ts: 200, data: {bar200: 'baz200'}},
					{ts: 150, data: {bar150: 'baz150'}},
				],
			}),
		);

		expect(
			await catchError(
				testNode.records.get({$query: {environmentKey, path: 'foo'}}),
			),
		).toMatchSnapshot();

		// Add some overlapping records, which should be ignored
		await catchError(
			testNode.records.batch.post({
				environmentKey,
				path: 'foo',
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
				testNode.records.get({$query: {environmentKey, path: 'foo'}}),
			),
		).toMatchSnapshot();
	});

	test.each([false, true])(
		'upload and get from multiple sessions',
		async (batchUpload) => {
			const initialSessions = await catchError(
				testNode.sessions.get({$query: {environmentKey}}),
			);
			expect(initialSessions.sessions).toHaveLength(0);

			// Uploading a record should create a session
			await catchError(
				batchUpload
					? testNode.records.batch.post({
							environmentKey,
							path: 'foo',
							records: [{ts: 100, data: {bar100: 'baz100'}}],
					  })
					: testNode.records.post({
							environmentKey,
							path: 'foo',
							ts: 100,
							data: {bar100: 'baz100'},
					  }),
			);

			const sessionsAfterOne = await catchError(
				testNode.sessions.get({$query: {environmentKey}}),
			);
			expect(sessionsAfterOne.sessions).toHaveLength(1);

			// Manually create a new session
			await catchError(
				testNode.sessions.create.post({
					environmentKey,
				}),
			);

			const sessionsAfterTwo = await catchError(
				testNode.sessions.get({$query: {environmentKey}}),
			);
			expect(sessionsAfterTwo.sessions).toHaveLength(2);

			// Current session should have no records
			const curSessionRecords = await catchError(
				testNode.records.get({$query: {environmentKey, path: 'foo'}}),
			);
			expect(curSessionRecords.records).toHaveLength(0);

			const session1 = sessionsAfterTwo.sessions[0];
			const session2 = sessionsAfterTwo.sessions[1];

			// Also current session
			const session2Records = await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', session: session2.session},
				}),
			);
			expect(session2Records.records).toHaveLength(0);

			// First session should have the record
			const session1Records = await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', session: session1.session},
				}),
			);
			expect(session1Records.records).toHaveLength(1);

			// Add a record to the current session
			await catchError(
				batchUpload
					? testNode.records.batch.post({
							environmentKey,
							path: 'foo',
							records: [{ts: 200, data: {bar200: 'baz200'}}],
					  })
					: testNode.records.post({
							environmentKey,
							path: 'foo',
							ts: 200,
							data: {bar200: 'baz200'},
					  }),
			);

			// Current session should have the record
			const curSessionRecordsAfter = await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo'},
				}),
			);
			expect(curSessionRecordsAfter.records).toHaveLength(1);
			expect(curSessionRecordsAfter.records[0].ts).toBe(200);

			// Also current session
			const session2RecordsAfter = await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', session: session2.session},
				}),
			);
			expect(session2RecordsAfter.records).toHaveLength(1);
			expect(session2RecordsAfter.records[0].ts).toBe(200);

			// First session should have only the first record
			const session1RecordsAfter = await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', session: session1.session},
				}),
			);
			expect(session1RecordsAfter.records).toHaveLength(1);
			expect(session1RecordsAfter.records[0].ts).toBe(100);
		},
	);

	test('more complicated get', async () => {
		await testNode.records.batch.post({
			environmentKey,
			path: 'foo',
			records: [
				{ts: 100, data: {bar100: 'baz100'}},
				{ts: 200, data: {bar200: 'baz200'}},
			],
		});
		await testNode.records.batch.post({
			environmentKey,
			path: 'oof',
			records: [
				{ts: 100, data: {rab100: 'zab100'}},
				{ts: 200, data: {rab200: 'zab200'}},
			],
		});

		expect([
			await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', startTs: '100'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', startTs: '100', take: '1'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', startTs: '200'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', startTs: '300'},
				}),
			),
		]).toMatchSnapshot();

		expect([
			await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', endTs: '200'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', endTs: '200', take: '1'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', endTs: '100'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', endTs: '000'},
				}),
			),
		]).toMatchSnapshot();

		expect([
			await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', startTs: '100', endTs: '200'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {
						environmentKey,
						path: 'foo',
						startTs: '100',
						endTs: '200',
						take: '1',
					},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', startTs: '200', endTs: '200'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', startTs: '100', endTs: '100'},
				}),
			),
			await catchError(
				testNode.records.get({
					$query: {environmentKey, path: 'foo', startTs: '200', endTs: '100'},
				}),
			),
		]).toMatchSnapshot();
	});
});
