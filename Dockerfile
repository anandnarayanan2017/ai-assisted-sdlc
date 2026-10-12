# Pinned by digest for reproducible builds; Dependabot (.github/dependabot.yml) proposes updates.
FROM node:22.23.3-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392
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
