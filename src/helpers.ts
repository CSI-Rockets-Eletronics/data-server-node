import assert from 'node:assert';
import process from 'node:process';
import {prisma} from './prisma';
import {maybeParentNode} from './parent-node';

export async function ensureSystemClockIsSynchronizedWithParentNode() {
	const MAX_DRIFT_MS = 1000; // 1 second

	if (maybeParentNode) {
		const {data: parentTs, error} = await maybeParentNode.ts.get();
		if (error) {
			console.error(
				'⛔️ Unable to check if system clock is synchronized: Parent node error',
			);
			return process.exit(1); // eslint-disable-line unicorn/no-process-exit
		}

		const driftMs = (curTimeMicros() - parentTs) / 1000;

		if (Math.abs(driftMs) > MAX_DRIFT_MS) {
			console.error(
				`⛔️ System clock is not synchronized with parent node! Drift is ${driftMs} ms`,
			);
			return process.exit(1); // eslint-disable-line unicorn/no-process-exit
		}

		console.log(`⏰ System clock is synchronized (drift is ${driftMs} ms)`);
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
	const milliseconds = performance.now() + performance.timeOrigin;
	return Math.round(milliseconds * 1000);
}

export function parseQueryNumber(
	value: string | undefined,
): number | undefined {
	if (value === undefined) {
		return undefined;
	}

	const numberValue = Number(value);
	assert(!Number.isNaN(numberValue), 'query param must be a number');
	return numberValue;
}

export function parseQueryFilterTs(ts: string | undefined): number | undefined {
	const numberTs = parseQueryNumber(ts);
	if (numberTs === undefined) {
		return undefined;
	}

	if (numberTs < 0) {
		// Yes, adding the negative numberTs is correct
		return curTimeMicros() + numberTs;
	}

	return numberTs;
}
