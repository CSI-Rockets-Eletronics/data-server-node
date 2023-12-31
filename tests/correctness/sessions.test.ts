import {describe, expect, test} from 'bun:test';
import {testNode} from '../test-node';
import {catchError} from '../helpers';
import {environmentKey} from '../setup';

describe('/sessions', () => {
	test('create and get', async () => {
		const initial = await catchError(
			testNode.sessions.get({$query: {environmentKey}}),
		);
		expect(initial.sessions).toHaveLength(0);
		expect(
			await catchError(
				testNode.sessions.current.get({$query: {environmentKey}}),
			),
		).toBe('NONE');

		await catchError(
			testNode.sessions.create.post({environmentKey, name: 'foo'}),
		);

		const afterOne = await catchError(
			testNode.sessions.get({$query: {environmentKey}}),
		);
		expect(afterOne.sessions).toHaveLength(1);
		expect(afterOne.sessions[0].name).toBe('foo');

		const currentAfterOne = await catchError(
			testNode.sessions.current.get({$query: {environmentKey}}),
		);
		expect(currentAfterOne).toEqual(afterOne.sessions[0]);

		await catchError(
			testNode.sessions.create.post({environmentKey, name: 'bar'}),
		);

		const afterTwo = await catchError(
			testNode.sessions.get({$query: {environmentKey}}),
		);
		expect(afterTwo.sessions).toHaveLength(2);
		expect(afterTwo.sessions[1].name).toBe('bar');

		const currentAfterTwo = await catchError(
			testNode.sessions.current.get({$query: {environmentKey}}),
		);
		expect(currentAfterTwo).toEqual(afterTwo.sessions[1]);

		const one = afterTwo.sessions[0];
		const two = afterTwo.sessions[1];

		expect(two.createdAt).toBeGreaterThan(one.createdAt);

		const query1 = await catchError(
			testNode.sessions.get({
				$query: {environmentKey, createdAfter: one.createdAt.toString()},
			}),
		);
		expect(query1.sessions).toHaveLength(2);

		const query2 = await catchError(
			testNode.sessions.get({
				$query: {environmentKey, createdAfter: two.createdAt.toString()},
			}),
		);
		expect(query2.sessions).toHaveLength(1);

		const query3 = await catchError(
			testNode.sessions.get({
				$query: {environmentKey, createdAfter: (two.createdAt + 1).toString()},
			}),
		);
		expect(query3.sessions).toHaveLength(0);

		const query4 = await catchError(
			testNode.sessions.get({
				$query: {environmentKey, createdBefore: two.createdAt.toString()},
			}),
		);
		expect(query4.sessions).toHaveLength(2);

		const query5 = await catchError(
			testNode.sessions.get({
				$query: {environmentKey, createdBefore: one.createdAt.toString()},
			}),
		);
		expect(query5.sessions).toHaveLength(1);

		const query6 = await catchError(
			testNode.sessions.get({
				$query: {environmentKey, createdBefore: (one.createdAt - 1).toString()},
			}),
		);
		expect(query6.sessions).toHaveLength(0);
	});
});
