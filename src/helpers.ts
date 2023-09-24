import {env} from './env';
import {prisma} from './prisma';

const SESSION_LENGTH = 6;

/**
 * Generated session will not contain '/' or ':'.
 */
function generateSession(): string {
	const chars =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	return Array.from({length: SESSION_LENGTH})
		.map(() => chars[Math.floor(Math.random() * chars.length)])
		.join('');
}

/**
 * Returns a node instance from a given session, using the current node name.
 * A node instance is 'nodeName:nodeSession' for a session maker, or 'nodeName' otherwise.
 */
export function toNodeInstance(session: string): string {
	return `${env.NODE_NAME}:${session}`;
}

export function joinPath(...parts: string[]): string {
	return parts.join('/');
}

export async function getOrInitCurNodeInstance(
	environmentKey: string,
): Promise<string> {
	if (!env.IS_SESSION_MAKER) {
		return env.NODE_NAME;
	}

	const curSession = await prisma.session.findFirst({
		where: {environmentKey},
		orderBy: {createdAt: 'desc'},
	});

	if (curSession) {
		return toNodeInstance(curSession.session);
	}

	const newSession = await prisma.session.create({
		data: {
			environmentKey,
			session: generateSession(),
			createdAt: new Date(),
		},
	});

	return toNodeInstance(newSession.session);
}
