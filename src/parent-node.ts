import {type EdenTreaty, edenTreaty} from '@elysiajs/eden/treaty';
import {env} from './env';
import {type App} from '.';

export type ParentNode = EdenTreaty.Create<App>;

export const maybeParentNode: ParentNode | undefined = env.PARENT_NODE_URL
	? edenTreaty<App>(env.PARENT_NODE_URL)
	: undefined;

if (env.PARENT_NODE_URL) {
	console.log(`📡 Using parent node at ${env.PARENT_NODE_URL}`);
}
