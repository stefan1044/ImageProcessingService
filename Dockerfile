FROM node:20-alpine as nodejs

WORKDIR /app

COPY package.json package.json
COPY .env .env
RUN npm install --include=optional

COPY . .
RUN npm run build-linux


ENTRYPOINT ["npm"]
CMD ["run", "start"]

