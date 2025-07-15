FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN yarn install
COPY . .
RUN yarn build
EXPOSE 3000
CMD ["/usr/local/bin/node", "/usr/local/bin/yarn", "start"]