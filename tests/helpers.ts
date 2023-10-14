export async function catchError<T>(
	// eslint-disable-next-line @typescript-eslint/ban-types
	promise: Promise<{data: T; error: null} | {data: null; error: Error}>,
): Promise<T> {
	const {data, error} = await promise;
	if (error) throw error;
	return data;
}

export function createTestEnvironmentKey() {
	return `TEST:${crypto.randomUUID()}`;
}
