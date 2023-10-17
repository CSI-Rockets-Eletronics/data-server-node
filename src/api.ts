import {edenTreaty} from '@elysiajs/eden/treaty';
import {type App} from '.';

/**
 * Other packages that use this package as a dependency can use this function to
 * make API calls.
 */
export const createEdenTreaty = (origin: string) => {
	// EdenTreaty has a bug where it will include undefined query parameters in
	// the URL, so we patch fetch to remove them.

	// NOTE: THIS MAY MESS WITH STRING QUERY PARAMS THAT ARE LITERALLY 'undefined'

	const originalFetch = fetch;

	// @ts-expect-error overwrite fetch
	// eslint-disable-next-line no-global-assign
	fetch = async function (...args: Parameters<typeof originalFetch>) {
		let [request, init] = args;

		if (typeof request === 'string' && request.startsWith(origin)) {
			const url = new URL(request);

			for (const [key, value] of url.searchParams.entries()) {
				if (value === 'undefined') {
					url.searchParams.delete(key);
				}
			}

			request = url.toString();
		}

		return originalFetch(request, init);
	};

	return edenTreaty<App>(origin);
};
