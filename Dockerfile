FROM node:20-alpine as nodejs

RUN apk add --no-cache curl openssl

FROM nodejs as builder

WORKDIR /app
COPY . .

RUN npm i --ignore-scripts --production
RUN npm run build

FROM nodejs as main

WORKDIR /usr/app

COPY --from=builder /app/node_modules/ node_modules/
COPY --from=builder /app/dist ./
COPY --from=builder /app/.env.example .env.example
COPY --from=builder /app/package.json package.json

ENTRYPOINT ["node"]
CMD ["main.js"]

