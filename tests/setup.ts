import {beforeEach} from 'bun:test';

function createTestEnvironmentKey() {
	return `TEST:${crypto.randomUUID()}`;
}

// Multiple environment keys are used in some tests

/** Updated to a new value before each test. */
// eslint-disable-next-line import/no-mutable-exports
export let environmentKey = createTestEnvironmentKey();

/** Updated to a new value before each test. */
// eslint-disable-next-line import/no-mutable-exports
export let environmentKey2 = createTestEnvironmentKey();

beforeEach(() => {
	environmentKey = createTestEnvironmentKey();
	environmentKey2 = createTestEnvironmentKey();
});
