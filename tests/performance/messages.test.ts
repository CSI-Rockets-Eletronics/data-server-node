/* eslint-disable no-await-in-loop */
import {describe, expect, test} from 'bun:test';
import {testNode} from '../test-node';
import {catchError} from '../helpers';
import {environmentKey, environmentKey2} from '../setup';

type Message = Exclude<
	Awaited<ReturnType<typeof testNode.messages.next.get>>['data'],
	// eslint-disable-next-line @typescript-eslint/ban-types
	null | 'NONE'
>;

describe('/messages', () => {
	test('upload and get many messages', async () => {
		for (const key of [environmentKey, environmentKey2]) {
			for (let session = 0; session < 5; session++) {
				await catchError(testNode.sessions.create.post({environmentKey: key}));

				for (let device = 0; device < 5; device++) {
					for (let message = 0; message < 100; message++) {
						await catchError(
							testNode.messages.post({
								environmentKey: key,
								device: `foo${device}`,
								data: {bar: 'baz'},
							}),
						);
					}
				}
			}
		}

		const message = (await catchError(
			testNode.messages.next.get({
				$query: {
					environmentKey,
					device: 'foo0',
				},
			}),
		)) as Message;
		expect(message.data).toEqual({bar: 'baz'}); // Sanity check

		for (let i = 0; i < 100; i++) {
			const messageAfterFirst = (await catchError(
				testNode.messages.next.get({
					$query: {
						environmentKey,
						device: 'foo0',
						afterTs: message.ts.toString(),
					},
				}),
			)) as Message;
			expect(messageAfterFirst.data).toEqual({bar: 'baz'}); // Sanity check
		}
	}, 0); // No timeout
});
