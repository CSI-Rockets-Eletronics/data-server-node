import {beforeEach} from 'bun:test';

function createTestEnvironmentKey() {
	return `TEST:${crypto.randomUUID()}`;
}

/** Updated to a new value before each test. */
// eslint-disable-next-line import/no-mutable-exports
export let environmentKey = createTestEnvironmentKey();

beforeEach(() => {
	environmentKey = createTestEnvironmentKey();
});
