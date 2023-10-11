FROM oven/bun:latest
WORKDIR /app
COPY package.json .
COPY bun.lockb .
RUN bun install
COPY prisma ./prisma
COPY . .
ENV PORT=3000
EXPOSE 3000
ENTRYPOINT ["bun", "start"]
