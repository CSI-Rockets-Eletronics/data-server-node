import {maybeParentNode, type ParentNode} from './parent-node';
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
	private latestRecordReceivedAt: number | undefined;

	constructor(private readonly parentNode: ParentNode) {}

	async run() {
		await Promise.all([this.syncRecordsLoop(), this.syncMessagesLoop()]);
	}

	onReceiveRecord() {
		this.latestRecordReceivedAt = Date.now();
	}

	private async syncRecordsLoop() {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await this.syncRecords();
			} catch (error) {
				console.error('Error in SyncWorker.syncRecords():', error);
			}

			// eslint-disable-next-line no-await-in-loop
			await Bun.sleep(SYNC_RECORDS_DELAY_MS);
		}
	}

	private async syncMessagesLoop() {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await this.syncMessages();
			} catch (error) {
				console.error('Error in SyncWorker.syncMessages():', error);
			}

			// eslint-disable-next-line no-await-in-loop
			await Bun.sleep(SYNC_MESSAGES_DELAY_MS);
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
			// Always sync latest first, whether live or offline
			orderBy: {receivedAtIndex: 'desc'},
			select: {
				receivedAtIndex: true,
				environmentKey: true,
				path: true,
				ts: true,
				data: true,
			},
		});

		const minIndex = latestRecords.at(-1)?.receivedAtIndex;
		const maxIndex = latestRecords.at(0)?.receivedAtIndex;

		const hasRecords = minIndex !== undefined && maxIndex !== undefined;

		if (hasRecords) {
			const {error} = await this.parentNode.records.batchGlobal.post({
				records: latestRecords.map((record) => ({
					environmentKey: record.environmentKey,
					path: record.path,
					ts: Number(record.ts),
					data: record.data,
				})),
			});

			if (error) throw error;

			// Set sentToParent to true for all records that were just synced
			await prisma.record.updateMany({
				where: {
					receivedAtIndex: {gte: minIndex, lte: maxIndex},
					// Could be very many records in range, but the # of un-synced records
					// is capped by how many records we fetch above
					sentToParent: false,
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
		if (this.latestRecordReceivedAt === undefined) {
			return false;
		}

		const diff = Date.now() - this.latestRecordReceivedAt;
		return diff < LIVE_THRESHOLD_SECS * 1000;
	}
}

export const maybeSyncWorker = maybeParentNode
	? new SyncWorker(maybeParentNode)
	: undefined;
