# Arisma storefront (Next.js, standalone server). Run-time settings: ARISMA_ADMIN_API_URL (backend), ARISMA_SEARCH_URL
# (search service), NORPRESS_PUBLIC_URL and STORE_HOME. NEXT_PUBLIC_* values are fixed at build time.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ENV NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
# The standalone trace keeps sharp but not its native libvips, so the image optimizer could not load and served every
# photo as the original file. The whole sharp family goes along, links included.
# pnpm also leaves the libvips package empty here (its glibc check fails), so the exact version in the lockfile is
# fetched from npm and put in its place; the build stops if sharp still cannot load.
RUN set -e; cp -a node_modules/.pnpm/@img+sharp* .next/standalone/node_modules/.pnpm/; \
    dir=$(ls -d node_modules/.pnpm/@img+sharp-libvips-linux-x64@*); version=${dir##*@}; \
    dest=/app/.next/standalone/$dir/node_modules/@img/sharp-libvips-linux-x64; \
    mkdir -p /tmp/vips "$dest" && cd /tmp/vips && npm pack -q "@img/sharp-libvips-linux-x64@$version" >/dev/null && tar xzf ./*.tgz && cp -a package/. "$dest/"; \
    cd /app/.next/standalone && node -e "require(require.resolve('sharp',{paths:[require('path').dirname(require.resolve('next/package.json'))]}))({create:{width:1,height:1,channels:3,background:'red'}}).webp().toBuffer().then(()=>console.log('sharp ok'))"

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=8000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 8000
CMD ["node", "server.js"]
