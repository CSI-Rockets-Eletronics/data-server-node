import {edenTreaty} from '@elysiajs/eden/treaty';
import {type App} from '.';

/**
 * Ensures that undefined keys are stripped, not stringified. E.g. `new
 * URLSearchParams({foo: undefined})` should be `''`, not `'foo=undefined'`.
 * This is necessary because edenTreaty uses URLSearchParams internally.
 */
class FixedURLSearchParameters extends URLSearchParams {
	constructor(
		init?: string[][] | Record<string, string> | string | URLSearchParams,
	) {
		if (
			typeof init === 'object' &&
			!Array.isArray(init) &&
			!(init instanceof URLSearchParams)
		) {
			init = Object.fromEntries(
				Object.entries(init).filter(([, value]) => value !== undefined),
			);
		}

		super(init);
	}
}

// eslint-disable-next-line no-global-assign
URLSearchParams = FixedURLSearchParameters as any;

/**
 * Other packages that use this package as a dependency can use this function to
 * make API calls.
 */
export const createEdenTreaty = (domain: string) => edenTreaty<App>(domain);
