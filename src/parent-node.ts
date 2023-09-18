import {edenTreaty} from '@elysiajs/eden/treaty';
import {env} from './env';
import {type App} from '.';

export const maybeParentNode = env.PARENT_NODE_URL
	? edenTreaty<App>(env.PARENT_NODE_URL)
	: undefined;
