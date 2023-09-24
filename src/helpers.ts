import {env} from './env';
import {prisma} from './prisma';

/**
 * A node instance is 'nodeName:nodeSession' for a session maker, or 'nodeName' otherwise.
 */
export function toNodeInstance(nodeName: string, nodeSession: string) {
	return `${nodeName}:${nodeSession}`;
}

export function joinPath(...parts: string[]) {
	return parts.join('/');
}

export async function getOrInitCurNodeInstance(environmentKey: string) {
	if (!env.IS_SESSION_MAKER) {
		return env.NODE_NAME;
	}

	// TODO
	return '';
}
