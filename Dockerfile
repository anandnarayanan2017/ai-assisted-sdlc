# Pinned by digest for reproducible builds; Dependabot (.github/dependabot.yml) proposes updates.
FROM node:26.11.1-bookworm-slim@sha256:86f07bc9c5dce4578cf37e5a418b7bfc7f817cda25cde66e2b66e95ed86c4567
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Harness dependencies, then the target project's dependencies (cached layers).
COPY package.json package-lock.json ./
RUN npm ci
COPY examples/room-booking/package.json examples/room-booking/package-lock.json examples/room-booking/
RUN npm ci --prefix examples/room-booking

COPY . .
CMD ["npm", "run", "demo"]
