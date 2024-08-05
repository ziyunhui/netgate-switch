FROM oven/bun:1
WORKDIR /usr/src/app
COPY . .
COPY ./config.json /config
RUN bun install --frozen-lockfile --production
ENV NODE_ENV=production
EXPOSE 7000/tcp
VOLUME [ "/config"]
ENTRYPOINT [ "bun", "run", "index.ts" ]