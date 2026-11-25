# "Pregúntale a…" search service. The embedding model is copied from ./models (run `pnpm fetch-model` first; its files
# are checked against model.lock.json on start). The index lives in SEARCH_DATA: mount a volume on /app/data to keep it.
# Run-time settings: CATALOG_URL, STORE_PROFILE, SEARCH_TOKEN.
FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# on Linux onnxruntime-node also tries to fetch its CUDA build; the model runs on the CPU, so that download is skipped
ENV ONNXRUNTIME_NODE_INSTALL_CUDA=skip
RUN pnpm install --frozen-lockfile --fetch-timeout 600000 --fetch-retries 5
COPY . .
RUN mkdir -p data && chown -R node:node data
ENV NODE_ENV=production SEARCH_HOST=0.0.0.0 SEARCH_PORT=9002
USER node
EXPOSE 9002
CMD ["node_modules/.bin/tsx", "src/main.ts"]
