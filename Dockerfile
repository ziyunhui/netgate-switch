FROM oven/bun:latest
WORKDIR /usr/src/app
RUN mkdir -p /config
COPY ./config.json /config
COPY . .
RUN bun install --frozen-lockfile --production
ENV NODE_ENV=production

EXPOSE 7000/tcp
VOLUME [ "/config"]
ENTRYPOINT [ "bun", "run", "index.ts" ]