FROM oven/bun:latest
WORKDIR /app

COPY package.json ./
COPY bun.lockb ./
RUN bun install

COPY prisma/schema.prisma prisma/
RUN bun prisma:generate

COPY tsconfig.json ./
COPY prisma/migrations prisma/migrations
COPY src src

ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["bun", "start:migrate"]
