import process from 'node:process';
import {prisma} from './prisma';

export function ensureSystemClockIsSynchronizedOnLinux(): void {
	if (process.platform === 'linux') {
		try {
			const proc = Bun.spawnSync(['timedatectl', 'status']);
			const output = proc.stdout.toString();
			if (output.includes('System clock synchronized: yes')) {
				console.log('⏰ System clock is synchronized');
			} else {
				console.error(
					'⛔️ System clock is not synchronized! Run `timedatectl status` to see why.',
				);
			}
		} catch {
			console.warn(
				'⛔️ Unable to check if system clock is synchronized: timedatectl command not found',
			);
		}
	}
}

/**
 * If `sessionName` is undefined, defaults to the current session.
 */
export async function getSessionTimeRange(
	environmentKey: string,
	sessionName: string | undefined,
): Promise<{
	/** Inclusive */
	start: number | undefined;
	/** Inclusive */
	end: number | undefined;
}> {
	if (sessionName === undefined) {
		const curSession = await prisma.session.findFirst({
			where: {environmentKey},
			orderBy: {createdAt: 'desc'},
			select: {createdAt: true},
		});

		return {
			start: curSession ? Number(curSession.createdAt) : undefined,
			end: undefined,
		};
	}

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
	// On Linux, use the date command (to handle the case where the raspberry pi's
	// clock is not synchronized until after the server starts)
	if (process.platform === 'linux') {
		const proc = Bun.spawnSync(['date', '+%s%6N']);
		const output = proc.stdout.toString();
		return Number(output);
	}

	const milliseconds = performance.now() + performance.timeOrigin;
	return Math.round(milliseconds * 1000);
}
