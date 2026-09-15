# Base
FROM node:24-bullseye-slim AS base

ENV PORT 8080
ENV CHROMIUM_EXECUTABLE_PATH /usr/bin/chromium

WORKDIR /usr/src/app

COPY package*.json ./


# Production Deps
FROM base AS deps

ENV NODE_ENV production

RUN apt-get update && \
    apt-get install -y node-gyp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
RUN npm ci --fetch-timeout=300000


# Build
FROM base AS builder

RUN apt-get update && \
    apt-get install -y node-gyp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
RUN npm ci --fetch-timeout=300000

COPY . ./
RUN npm run build


# Main
FROM base

ENV NODE_ENV production
# Preloads OpenTelemetry auto-instrumentation (HTTP/Express/Nest/pg) before
# the app's own module graph loads - required for tracing.enabled: true in
# config.yaml to actually instrument anything, no-op otherwise.
ENV NODE_OPTIONS "--import @fsarch/server/register"

EXPOSE 3000

# Chromium for Puppeteer (html-layer rendering). @napi-rs/canvas needs no
# native build toolchain or system libs of its own - it ships prebuilt Skia
# binaries for linux-gnu - so the deciding factor for this base image is
# Chromium's apt package (bullseye-slim/glibc, same as pdf-render-backend),
# not canvas.
RUN apt-get update && \
    apt-get --no-install-recommends install -y chromium fonts-recommended && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder --chown=node:node /usr/src/app/dist ./dist
COPY --from=deps --chown=node:node /usr/src/app/node_modules ./node_modules

USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "./dist/main.js"]
