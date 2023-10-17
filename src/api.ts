import {edenTreaty} from '@elysiajs/eden/treaty';
import {type App} from '.';

/**
 * Other packages that use this package as a dependency can use this function to
 * make API calls.
 */
export const createEdenTreaty = (domain: string) => edenTreaty<App>(domain);
