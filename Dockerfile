FROM oven/bun:1
WORKDIR /usr/src/app
COPY . .
RUN bun install --frozen-lockfile --production
ENV NODE_ENV=production
EXPOSE 7000/tcp
ENTRYPOINT [ "bun", "run", "index.ts" ]
