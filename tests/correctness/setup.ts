import {beforeEach} from 'bun:test';
import {createTestEnvironmentKey} from '../helpers';

/** Updated to a new value before each test. */
// eslint-disable-next-line import/no-mutable-exports
export let environmentKey = createTestEnvironmentKey();

export function setupCorrectnessTests() {
	beforeEach(() => {
		environmentKey = createTestEnvironmentKey();
	});
}
