import process from 'node:process';
import {z} from 'zod';

const envSchema = z.object({
	MOUNT_PATH: z
		.string()
		.optional()
		.transform((value) => value ?? ''),
	PORT: z.string().transform(Number),
	NODE_NAME: z.string(),
	IS_SESSION_MAKER: z
		.string()
		.optional()
		.transform((value) => value === 'true'),
	PARENT_NODE_URL: z
		.string()
		.optional()
		.transform((value) => (value === '' ? undefined : value)),
});

export const env = envSchema.parse(process.env);
