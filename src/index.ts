import {Elysia} from 'elysia';
import {swagger} from '@elysiajs/swagger';
import {env} from './env';
import {sessionsRoute} from './routes/sessions';
import {recordsRoute} from './routes/records';
import {messagesRoute} from './routes/messages';

const app = new Elysia()
	.use(
		swagger({
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
	.get('/', ({set}) => {
		set.redirect = '/swagger';
	})
	.onError(({error, set}) => {
		console.error('Error in route handler:', error);

		set.status = 500;
		return {
			error: `${error.name}: ${error.message}`,
		};
	})
	.use(sessionsRoute)
	.use(recordsRoute)
	.use(messagesRoute)
	.listen(env.PORT);

export type App = typeof app;

console.log(
	`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
