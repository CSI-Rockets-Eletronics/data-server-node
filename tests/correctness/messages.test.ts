import {describe, expect, test} from 'bun:test';
import {testNode} from '../test-node';
import {catchError} from '../helpers';
import {environmentKey} from '../setup';

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
		)) as any;
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
		)) as any;
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

	test('upload ad get from multiple sessions', async () => {
		const initialSessions = await catchError(
			testNode.sessions.get({$query: {environmentKey}}),
		);
		expect(initialSessions.sessions).toHaveLength(0);

		// Uploading a message should create a session
		await catchError(
			testNode.messages.post({
				environmentKey,
				path: 'foo',
				data: {bar: 'message1'},
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

		// Current session should have no messages
		const curSessionMessage = await catchError(
			testNode.messages.next.get({$query: {environmentKey, path: 'foo'}}),
		);
		expect(curSessionMessage).toBe('NONE');

		const session1 = sessionsAfterTwo.sessions[0];
		const session2 = sessionsAfterTwo.sessions[1];

		// Also current session
		const session2Message = await catchError(
			testNode.messages.next.get({
				$query: {environmentKey, path: 'foo', session: session2.session},
			}),
		);
		expect(session2Message).toBe('NONE');

		// First session should have the message
		const session1Message = (await catchError(
			testNode.messages.next.get({
				$query: {environmentKey, path: 'foo', session: session1.session},
			}),
		)) as any;
		expect(session1Message.data).toEqual({bar: 'message1'});

		// Add a message to the current session
		await catchError(
			testNode.messages.post({
				environmentKey,
				path: 'foo',
				data: {bar: 'message2'},
			}),
		);

		// Current session should have the message
		const curSessionMessageAfter = (await catchError(
			testNode.messages.next.get({
				$query: {environmentKey, path: 'foo'},
			}),
		)) as any;
		expect(curSessionMessageAfter.data).toEqual({bar: 'message2'});

		// Also current session
		const session2MessageAfter = (await catchError(
			testNode.messages.next.get({
				$query: {environmentKey, path: 'foo', session: session2.session},
			}),
		)) as any;
		expect(session2MessageAfter).toEqual(curSessionMessageAfter);

		// First session should have only the first message
		const session1MessageAfter = await catchError(
			testNode.messages.next.get({
				$query: {environmentKey, path: 'foo', session: session1.session},
			}),
		);
		expect(session1MessageAfter).toEqual(session1Message);
	});
});
