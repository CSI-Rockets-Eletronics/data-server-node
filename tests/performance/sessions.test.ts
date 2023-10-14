/* eslint-disable no-await-in-loop */
import {describe, expect, test} from 'bun:test';
import {testNode} from '../test-node';
import {catchError} from '../helpers';
import {environmentKey, environmentKey2} from '../setup';

describe('/sessions', () => {
	test('create and get many sessions', async () => {
		for (const key of [environmentKey, environmentKey2]) {
			for (let session = 0; session < 100; session++) {
				await catchError(testNode.sessions.create.post({environmentKey: key}));
			}
		}

		const sessions = await catchError(
			testNode.sessions.get({$query: {environmentKey}}),
		);
		expect(sessions.sessions.length).toBeGreaterThan(0); // Sanity check

		const minTs = sessions.sessions.at(0)!.createdAt;
		const maxTs = sessions.sessions.at(-1)!.createdAt;
		const tsDiff = maxTs - minTs;

		for (let i = 0; i < 100; i++) {
			const sessionsInRange = await catchError(
				testNode.sessions.get({
					$query: {
						environmentKey,
						createdAfter: Math.round(minTs + tsDiff / 4).toString(),
						createdBefore: Math.round(maxTs - tsDiff / 4).toString(),
					},
				}),
			);
			expect(sessionsInRange.sessions.length).toBeGreaterThan(0); // Sanity check
		}
	}, 0); // No timeout
});
