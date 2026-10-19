# Pinned by digest for reproducible builds; Dependabot (.github/dependabot.yml) proposes updates.
FROM node:26.12.0-bookworm-slim@sha256:298992629d69bbd5b2b03ad57094d8e4fcb3a8eeb7c4e25d29de656519568913
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
