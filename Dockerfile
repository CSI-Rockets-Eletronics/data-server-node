FROM oven/bun:latest
WORKDIR /app

# hack: prisma has a hard dependency on node, so without this, prisma:generate
# and start:migrate don't work (see https://github.com/oven-sh/bun/issues/5320)
COPY --from=node:18 /usr/local/bin/node /usr/local/bin/node

COPY package.json ./
COPY bun.lockb ./
RUN bun install --frozen-lockfile

COPY prisma/schema.prisma prisma/
RUN bun prisma:generate

COPY tsconfig.json ./
COPY prisma/migrations prisma/migrations
COPY src src

ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["bun", "start:migrate"]
