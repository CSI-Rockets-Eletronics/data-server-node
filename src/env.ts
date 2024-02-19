import process from 'node:process';
import {z} from 'zod';

const envSchema = z.object({
	MOUNT_PATH: z
		.string()
		.optional()
		.transform((value) => value ?? ''),
	PORT: z.string().transform(Number),
	NODE_NAME: z.string(),
	PARENT_NODE_URL: z
		.string()
		.optional()
		.transform((value) => (value === '' ? undefined : value)),
	FORCE_OFFLINE_SYNC: z
		.string()
		.optional()
		.transform((value) => value?.toLowerCase() === 'true'),
});

export const env = envSchema.parse(process.env);
