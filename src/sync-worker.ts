import {type ParentNode} from './parent-node';
import {prisma} from './prisma';

const SYNC_RECORDS_DELAY_MS = 200;
const SYNC_MESSAGES_DELAY_MS = 200;

/**
 * If no messages were received in the last 30s, switch to high-throughput +
 * high-latency offline sync mode. Otherwise, perform live sync (low-throughput
 * + low-latency).
 */
const LIVE_THRESHOLD_SECS = 30;

const LIVE_SYNC_RECORD_BATCH_SIZE = 100;
const OFFLINE_SYNC_RECORD_BATCH_SIZE = 1000;

export class SyncWorker {
	// Return value of Date.now()
	private latestMessageReceivedAt: number | undefined;

	constructor(private readonly parentNode: ParentNode) {}

	async run() {
		await Promise.all([this.syncRecordsLoop(), this.syncMessagesLoop()]);
	}

	async onReceiveMessage() {
		this.latestMessageReceivedAt = Date.now();
	}

	private async syncRecordsLoop() {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await this.syncRecords();
				// eslint-disable-next-line no-await-in-loop
				await Bun.sleep(SYNC_RECORDS_DELAY_MS);
			} catch (error) {
				console.error('Error in SyncWorker.syncRecords():', error);
			}
		}
	}

	private async syncMessagesLoop() {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await this.syncMessages();
				// eslint-disable-next-line no-await-in-loop
				await Bun.sleep(SYNC_MESSAGES_DELAY_MS);
			} catch (error) {
				console.error('Error in SyncWorker.syncMessages():', error);
			}
		}
	}

	/**
	 * May throw if the parent node is unreachable or if the parent gives error
	 * responses.
	 */
	private async syncRecords() {
		const liveSync = await this.shouldLiveSyncRecords();

		const latestRecords = await prisma.record.findMany({
			where: {sentToParent: false},
			take: liveSync
				? LIVE_SYNC_RECORD_BATCH_SIZE
				: OFFLINE_SYNC_RECORD_BATCH_SIZE,
			orderBy: {receivedAtIndex: 'desc'},
			select: {
				receivedAtIndex: true,
				environmentKey: true,
				path: true,
				ts: true,
				data: true,
			},
		});

		// TODO use batch update route
		await Promise.all(
			latestRecords.map(async (record) =>
				this.parentNode.records.post({
					environmentKey: record.environmentKey,
					// All paths are prefixed with the current node instance
					path: record.path,
					ts: Number(record.ts),
					data: record.data,
				}),
			),
		);

		// Set sentToParent to true for all records that were just synced
		const minIndex = latestRecords.at(-1)?.receivedAtIndex;
		const maxIndex = latestRecords.at(0)?.receivedAtIndex;

		// If no records were synced, then the min/max index will be undefined
		if (minIndex !== undefined && maxIndex !== undefined) {
			await prisma.record.updateMany({
				where: {
					receivedAtIndex: {gte: minIndex, lte: maxIndex},
					sentToParent: false, // Skip already synced records also in the range
				},
				data: {sentToParent: true},
			});
		}
	}

	/**
	 * May throw if the parent node is unreachable or if the parent gives error
	 * responses.
	 */
	private async syncMessages() {
		// TODO
	}

	private async shouldLiveSyncRecords(): Promise<boolean> {
		if (this.latestMessageReceivedAt === undefined) {
			return false;
		}

		const diff = Date.now() - this.latestMessageReceivedAt;
		return diff < LIVE_THRESHOLD_SECS * 1000;
	}
}
