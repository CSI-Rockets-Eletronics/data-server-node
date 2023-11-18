import {Elysia} from 'elysia';
import {cors} from '@elysiajs/cors';
import {swagger} from '@elysiajs/swagger';
import {env} from './env';
import {sessionsRoute} from './routes/sessions';
import {recordsRoute} from './routes/records';
import {messagesRoute} from './routes/messages';
import {schemas} from './routes/schemas';
import {curTimeMicros} from './helpers';

const swaggerPath = `${env.MOUNT_PATH}/swagger`;

const app = new Elysia()
	// Elysia doesn't understand content-encoding: gzip, so we have to do it ourselves.
	.onParse(async ({request}, contentType) => {
		if (contentType === 'application/json-gzip') {
			const compressed = await request.arrayBuffer();
			const decompressed = Bun.gunzipSync(new Uint8Array(compressed));
			const decoded = new TextDecoder().decode(decompressed);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return JSON.parse(decoded);
		}
	})
	.onError(({error, set}) => {
		console.error('Error in route handler:', error);

		set.status = 500;
		return {
			error: `${error.name}: ${error.message}`,
		};
	})
	.get(
		'/',
		({set}) => {
			set.redirect = swaggerPath;
		},
		{detail: {summary: 'Redirects to the Swagger UI.'}},
	)
	.get(
		'/ts',
		() => {
			return curTimeMicros();
		},
		{
			detail: {summary: 'Get the current timestamp of the node.'},
			response: schemas.unixMicros,
		},
	)
	.use(sessionsRoute)
	.use(recordsRoute)
	.use(messagesRoute);

const mountedApp = new Elysia()
	.use(cors())
	.use(
		swagger({
			path: swaggerPath,
			documentation: {
				info: {
					title: `CSI Rockets Data Server: Node "${env.NODE_NAME}"`,
					version: '0.0.1',
					description:
						'API for manipulating records and messages on this data server node, which may be a part of a cluster.',
				},
			},
		}),
	)
	.use(new Elysia({prefix: env.MOUNT_PATH}).use(app))
	.listen(env.PORT);

console.log(
	`🦊 Elysia is running at http://${mountedApp.server?.hostname}:${mountedApp.server?.port}\n`,
);

export type App = typeof app;
