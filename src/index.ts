import {Elysia} from 'elysia';
import {env} from './env';
import {recordsRoute} from './routes/records';

const app = new Elysia()
	.onError(({set}) => {
		// Don't return actual error because it may be long
		set.status = 500;
		return 'ERROR';
	})
	.use(recordsRoute)
	.listen(env.PORT);

export type App = typeof app;

console.log(
	`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
