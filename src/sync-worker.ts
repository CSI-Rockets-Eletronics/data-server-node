import {env} from './env';
import {curTimeMicros} from './helpers';
import {maybeParentNode, type ParentNode} from './parent-node';
import {prisma} from './prisma';

const SYNC_RECORDS_DELAY_MS = 100;
const SYNC_MESSAGES_DELAY_MS = 100;

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
				device: true,
				ts: true,
				data: true,
			},
		});

		const recordsUpToDate = latestRecords.length === 0;
		this.logRecordsUpToDate(recordsUpToDate);

		if (!recordsUpToDate) {
			const {error} = await this.parentNode.records.batchGlobal.post({
				records: latestRecords.map((record) => ({
					environmentKey: record.environmentKey,
					device: record.device,
					ts: Number(record.ts),
					data: record.data,
				})),
			});

			if (error) throw error;

			const receivedAtIndexList = latestRecords.map((r) => r.receivedAtIndex);

			// Set sentToParent to true for all records that were just synced
			await prisma.record.updateMany({
				where: {
					// Could be very many records in range, but the # of un-synced records
					// is capped by how many records we fetch above
					sentToParent: false,
					receivedAtIndex: {in: receivedAtIndexList},
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
			await prisma.message.create({
				data: {
					environmentKey: nextMessage.environmentKey,
					device: nextMessage.device,
					ts: curTimeMicros(),
					data: nextMessage.data,
				},
				select: {environmentKey: true}, // Can't select nothing
			});

			this.lastSyncedMessageTs = nextMessage.ts;
		}
	}

	private async shouldLiveSyncRecords(): Promise<boolean> {
		if (env.FORCE_OFFLINE_SYNC) {
			return false;
		}

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

export function maybeRunSyncWorker(throwIfNoWorker = false) {
	if (maybeSyncWorker) {
		void maybeSyncWorker.run();
		console.log('🔄 Started sync worker');
	} else if (throwIfNoWorker) {
		throw new Error('No parent node configured');
	}
}
