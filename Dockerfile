# Stage 1: Build (default platform)
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install

COPY . .
RUN yarn build


# Stage 2: Runtime (amd64 only)
FROM --platform=linux/amd64 node:22-alpine AS runner
WORKDIR /app

# Copy only built artifacts and node_modules from builder
COPY --from=builder /app /app

EXPOSE 8080
CMD ["yarn", "start"]
