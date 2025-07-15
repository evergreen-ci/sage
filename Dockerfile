FROM --platform=linux/amd64 node:22-alpine
WORKDIR /app
COPY package.json ./
RUN yarn install
COPY . .
RUN yarn build
EXPOSE 3000
ENTRYPOINT ["node"]
CMD ["/usr/local/bin/yarn", "start"]