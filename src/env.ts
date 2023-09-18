import process from 'node:process';
import {z} from 'zod';

const envSchema = z.object({
	PORT: z.string().transform(Number),
	NODE_NAME: z.string(),
	IS_SESSION_MAKER: z.string().transform((value) => value === 'true'),
	DATABASE_URL: z.string(),
	PARENT_NODE_URL: z.string().transform((value) => value || undefined),
});

export const env = envSchema.parse(process.env);
