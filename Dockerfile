FROM oven/bun:latest
WORKDIR /usr/src/app
COPY . .
VOLUME [ "/config"]
COPY config.json /config/config.json
RUN bun install --frozen-lockfile --production
ENV NODE_ENV=production
EXPOSE 7000/tcp
ENTRYPOINT [ "bun", "run", "index.ts" ]
