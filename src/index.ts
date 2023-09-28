import {Elysia} from 'elysia';
import {swagger} from '@elysiajs/swagger';
import {env} from './env';
import {sessionsRoute} from './routes/sessions';
import {recordsRoute} from './routes/records';

const app = new Elysia()
	.use(swagger())
	.onError(({error, set}) => {
		console.error('Error in route handler:', error);

		set.status = 500;
		return {
			error: `${error.name}: ${error.message}`,
		};
	})
	.use(sessionsRoute)
	.use(recordsRoute)
	.listen(env.PORT);

export type App = typeof app;

console.log(
	`🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
