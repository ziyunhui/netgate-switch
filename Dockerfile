FROM oven/bun:latest
WORKDIR /usr/src/app
COPY . .
COPY config.json /etc/netgateswitch/config.json
RUN bun install --frozen-lockfile --production
ENV NODE_ENV=production
EXPOSE 7000/tcp
ENTRYPOINT [ "bun", "run", "index.ts" ]
