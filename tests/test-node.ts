import process from 'node:process';
import {edenTreaty} from '@elysiajs/eden/treaty';
import {type App} from '../src';

const TEST_NODE_URL = process.env.TEST_NODE_URL;

if (!TEST_NODE_URL) {
	throw new Error('TEST_NODE_URL not set');
}

export const testNode = edenTreaty<App>(TEST_NODE_URL);
