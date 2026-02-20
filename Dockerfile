# Stage 1: Build (default platform)
FROM node:22-alpine
WORKDIR /app

# Accept VERSION as a build argument (will be provided by CI/CD)
ARG VERSION=unknown
# Make VERSION available as environment variable for the build process
ENV VERSION=${VERSION}

# Install pnpm
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs && \
    chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 8080
CMD ["pnpm", "start"]
