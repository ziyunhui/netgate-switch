FROM oven/bun:latest
WORKDIR /usr/src/app
COPY ./config.json /config
COPY . .
RUN bun install --frozen-lockfile --production
ENV NODE_ENV=production
RUN bun run build

EXPOSE 7000/tcp
VOLUME [ "/config"]
ENTRYPOINT [ "bun", "run", "index.ts" ]