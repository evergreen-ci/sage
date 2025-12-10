# Stage 1: Build (default platform)
FROM node:22-alpine
WORKDIR /app

# Accept VERSION as a build argument (will be provided by CI/CD)
ARG VERSION=unknown
# Make VERSION available as environment variable for the build process
ENV VERSION=${VERSION}

COPY package.json yarn.lock ./
RUN yarn install

COPY . .
RUN yarn build


EXPOSE 8080
CMD ["yarn", "start"]
