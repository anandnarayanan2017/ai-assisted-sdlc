FROM node:22-bookworm-slim
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
