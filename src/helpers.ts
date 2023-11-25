import {prisma} from './prisma';

export async function getSessionTimeRange(
	environmentKey: string,
	sessionName: string,
): Promise<{
	/** Inclusive */
	start: number;
	/** Inclusive */
	end: number | undefined;
}> {
	const session = await prisma.session.findUnique({
		where: {
			environmentKey_name: {
				environmentKey,
				name: sessionName,
			},
		},
		select: {createdAt: true},
	});

	if (!session) {
		throw new Error('Cannot find session');
	}

	const nextSession = await prisma.session.findFirst({
		where: {
			environmentKey,
			createdAt: {gt: session.createdAt},
		},
		orderBy: {createdAt: 'asc'},
		select: {createdAt: true},
	});

	return {
		start: Number(session.createdAt),
		end: nextSession ? Number(nextSession.createdAt) - 1 : undefined,
	};
}

export function curTimeMicros(): number {
	const milliseconds = performance.now() + performance.timeOrigin;
	return Math.round(milliseconds * 1000);
}
