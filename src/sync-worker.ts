import {curTimeMicros} from './helpers';
import {maybeParentNode, type ParentNode} from './parent-node';
import {prisma} from './prisma';
import {createMessage} from './routes/messages';

const SYNC_RECORDS_DELAY_MS = 0;
const SYNC_MESSAGES_DELAY_MS = 0;

/**
 * If no messages were received in the last 30s, switch to high-throughput +
 * high-latency offline sync mode. Otherwise, perform live sync (low-throughput
 * + low-latency).
 */
const LIVE_THRESHOLD_SECS = 30;

const LIVE_SYNC_RECORD_BATCH_SIZE = 100;
const OFFLINE_SYNC_RECORD_BATCH_SIZE = 3000;

export class SyncWorker {
	// Milliseconds. Return value of Date.now().
	private latestRecordReceivedAt: number | undefined;

	// Unix microseconds.
	private lastSyncedMessageTs = curTimeMicros();

	// For logging on state changes
	private lastLiveSyncRecords = false;
	private lastRecordsUpToDate = true;
	private lastMessagesUpToDate = true;

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
		const liveSyncRecords = await this.shouldLiveSyncRecords();
		this.logLiveSyncRecords(liveSyncRecords);

		const latestRecords = await prisma.record.findMany({
			where: {sentToParent: false},
			// Always sync latest first, whether live or offline
			orderBy: {receivedAtIndex: 'desc'},
			take: liveSyncRecords
				? LIVE_SYNC_RECORD_BATCH_SIZE
				: OFFLINE_SYNC_RECORD_BATCH_SIZE,
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

		const recordsUpToDate = !hasRecords;
		this.logRecordsUpToDate(recordsUpToDate);

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
					// Could be very many records in range, but the # of un-synced records
					// is capped by how many records we fetch above
					sentToParent: false,
					receivedAtIndex: {gte: minIndex, lte: maxIndex},
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
		const {data: nextMessage, error} =
			await this.parentNode.messages.nextGlobal.get({
				$query: {
					afterTs: String(this.lastSyncedMessageTs),
				},
			});

		if (error) throw error;

		const messagesUpToDate = nextMessage === 'NONE';
		this.logMessagesUpToDate(messagesUpToDate);

		if (!messagesUpToDate) {
			await createMessage({
				environmentKey: nextMessage.environmentKey,
				path: nextMessage.path,
				data: nextMessage.data,
			});
			this.lastSyncedMessageTs = nextMessage.ts;
		}
	}

	private async shouldLiveSyncRecords(): Promise<boolean> {
		if (this.latestRecordReceivedAt === undefined) {
			return false;
		}

		const diff = Date.now() - this.latestRecordReceivedAt;
		return diff < LIVE_THRESHOLD_SECS * 1000;
	}

	private logLiveSyncRecords(liveSyncRecords: boolean) {
		if (liveSyncRecords && !this.lastLiveSyncRecords) {
			console.log('🔥 Switched to live sync for records');
		} else if (!liveSyncRecords && this.lastLiveSyncRecords) {
			console.log('🧊 Switched to offline sync for records');
		}

		this.lastLiveSyncRecords = liveSyncRecords;
	}

	private logRecordsUpToDate(recordsUpToDate: boolean) {
		if (recordsUpToDate && !this.lastRecordsUpToDate) {
			console.log(`✅ Records are up to date`);
		} else if (!recordsUpToDate && this.lastRecordsUpToDate) {
			console.log(`⏳ Records are out of date`);
		}

		this.lastRecordsUpToDate = recordsUpToDate;
	}

	private logMessagesUpToDate(messagesUpToDate: boolean) {
		if (messagesUpToDate && !this.lastMessagesUpToDate) {
			console.log(`✅ Messages are up to date`);
		} else if (!messagesUpToDate && this.lastMessagesUpToDate) {
			console.log(`⏳ Messages are out of date`);
		}

		this.lastMessagesUpToDate = messagesUpToDate;
	}
}

export const maybeSyncWorker = maybeParentNode
	? new SyncWorker(maybeParentNode)
	: undefined;

if (maybeSyncWorker) {
	void maybeSyncWorker.run();
	console.log('🔄 Started sync worker');
}
