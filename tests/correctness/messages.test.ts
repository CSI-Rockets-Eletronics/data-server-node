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
			testNode.messages.next.get({$query: {environmentKey, device: 'foo'}}),
		);
		expect(initial).toBe('NONE');

		await catchError(
			testNode.messages.post({
				environmentKey,
				device: 'foo',
				data: {bar: 'message1'},
			}),
		);

		const message1 = (await catchError(
			testNode.messages.next.get({$query: {environmentKey, device: 'foo'}}),
		)) as Message;
		expect(message1.data).toEqual({bar: 'message1'});

		await catchError(
			testNode.messages.post({
				environmentKey,
				device: 'foo',
				data: {bar: 'message2'},
			}),
		);

		// Should still be message1 (earliest)
		const stillMessage1 = await catchError(
			testNode.messages.next.get({$query: {environmentKey, device: 'foo'}}),
		);
		expect(stillMessage1).toEqual(message1);

		// Now get message2
		const message2 = (await catchError(
			testNode.messages.next.get({
				$query: {
					environmentKey,
					device: 'foo',
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
						device: 'foo',
						afterTs: message2.ts.toString(),
					},
				}),
			),
		).toBe('NONE');
	});

	test('upload and get from multiple sessions', async () => {
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
			testNode.messages.post({
				environmentKey,
				device: 'foo',
				data: {bar: 'message1'},
			}),
		);

		const sessionsAfterOne = await catchError(
			testNode.sessions.get({$query: {environmentKey}}),
		);
		expect(sessionsAfterOne.sessions).toHaveLength(1);

		// Create a new session
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
			testNode.messages.next.get({$query: {environmentKey, device: 'foo'}}),
		);
		expect(curSessionMessage).toBe('NONE');

		const session1 = sessionsAfterTwo.sessions[0];
		const session2 = sessionsAfterTwo.sessions[1];

		// Also current session
		const session2Message = await catchError(
			testNode.messages.next.get({
				$query: {environmentKey, device: 'foo', sessionName: session2.name},
			}),
		);
		expect(session2Message).toBe('NONE');

		// First session should have the message
		const session1Message = (await catchError(
			testNode.messages.next.get({
				$query: {environmentKey, device: 'foo', sessionName: session1.name},
			}),
		)) as Message;
		expect(session1Message.data).toEqual({bar: 'message1'});

		// Add a message to the current session
		await catchError(
			testNode.messages.post({
				environmentKey,
				device: 'foo',
				data: {bar: 'message2'},
			}),
		);

		// Current session should have the message
		const curSessionMessageAfter = (await catchError(
			testNode.messages.next.get({
				$query: {environmentKey, device: 'foo'},
			}),
		)) as Message;
		expect(curSessionMessageAfter.data).toEqual({bar: 'message2'});

		// Also current session
		const session2MessageAfter = (await catchError(
			testNode.messages.next.get({
				$query: {environmentKey, device: 'foo', sessionName: session2.name},
			}),
		)) as Message;
		expect(session2MessageAfter).toEqual(curSessionMessageAfter);

		// First session should have only the first message
		const session1MessageAfter = await catchError(
			testNode.messages.next.get({
				$query: {environmentKey, device: 'foo', sessionName: session1.name},
			}),
		);
		expect(session1MessageAfter).toEqual(session1Message);
	});
});
