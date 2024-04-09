import {prisma} from '../prisma';

await prisma.record.deleteMany({
	where: {sentToParent: true},
});
