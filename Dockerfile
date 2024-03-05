FROM node:20-alpine as nodejs

WORKDIR /app

COPY package.json package.json
RUN npm install

COPY . .

ENTRYPOINT ["npm"]
CMD ["run", "dev-docker"]

