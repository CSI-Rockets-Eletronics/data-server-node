import {env} from './env';

class SessionMaker {
	private static generateSession(): string {
		const length = 6;
		const chars =
			'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

		return Array.from({length})
			.map(() => chars[Math.floor(Math.random() * chars.length)])
			.join('');
	}

	private _session = SessionMaker.generateSession();

	get session(): string {
		return this._session;
	}

	newSession(): void {
		this._session = SessionMaker.generateSession();
	}
}

/** `undefined` if this node is not a session maker. */
export const maybeSessionMaker = env.IS_SESSION_MAKER
	? new SessionMaker()
	: undefined;
