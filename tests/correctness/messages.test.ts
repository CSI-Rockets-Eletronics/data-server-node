import {describe, expect, test} from 'bun:test';
import {testNode} from '../test-node';
import {catchError} from '../helpers';
import {environmentKey} from '../setup';

type Message = Exclude<
	Awaited<ReturnType<typeof testNode.messages.next.get>>['data'],
	// eslint-disable-next-line @typescript-eslint/ban-types
	null | 'NONE'
>;

describe('/messages', () => {
	test('upload and get next', async () => {
		const initial = await catchError(
			testNode.messages.next.get({$query: {environmentKey, path: 'foo'}}),
		);
		expect(initial).toBe('NONE');

		await catchError(
			testNode.messages.post({
				environmentKey,
				path: 'foo',
				data: {bar: 'message1'},
			}),
		);

		const message1 = (await catchError(
			testNode.messages.next.get({$query: {environmentKey, path: 'foo'}}),
		)) as Message;
		expect(message1.data).toEqual({bar: 'message1'});

		await catchError(
			testNode.messages.post({
				environmentKey,
				path: 'foo',
				data: {bar: 'message2'},
			}),
		);

		// Should still be message1 (earliest)
		const stillMessage1 = await catchError(
			testNode.messages.next.get({$query: {environmentKey, path: 'foo'}}),
		);
		expect(stillMessage1).toEqual(message1);

		// Now get message2
		const message2 = (await catchError(
			testNode.messages.next.get({
				$query: {
					environmentKey,
					path: 'foo',
					afterTs: message1.ts.toString(),
				},
			}),
		)) as Message;
		expect(message2.data).toEqual({bar: 'message2'});
		expect(message2.ts).toBeGreaterThan(message1.ts);

		// Should have no more messages
		expect(
			await catchError(
				testNode.messages.next.get({
					$query: {
						environmentKey,
						path: 'foo',
						afterTs: message2.ts.toString(),
					},
				}),
			),
		).toBe('NONE');
	});
});
