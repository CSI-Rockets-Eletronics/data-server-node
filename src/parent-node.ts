import {type EdenTreaty, edenTreaty} from '@elysiajs/eden/treaty';
import {env} from './env';
import {type App} from '.';

export type ParentNode = EdenTreaty.Create<App>;

export const maybeParentNode: ParentNode | undefined = env.PARENT_NODE_URL
	? edenTreaty<App>(env.PARENT_NODE_URL)
	: undefined;
