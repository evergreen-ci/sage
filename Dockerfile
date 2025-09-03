FROM --platform=linux/amd64 node:22-alpine
WORKDIR /app
COPY package.json ./
COPY yarn.lock ./
RUN yarn install
COPY . .
RUN yarn build
EXPOSE 8080
CMD ["yarn", "start"]
