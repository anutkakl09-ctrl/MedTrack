FROM node:20-alpine AS build

WORKDIR /usr/src/medtrack

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /usr/src/medtrack
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data
ENV API_BASE_URL=https://bot-1791821989-5814-pharmagot.bothost.tech
ENV MINI_APP_URL=https://bot-1791821989-5814-pharmagot.bothost.tech

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /usr/src/medtrack/server ./server
COPY --from=build /usr/src/medtrack/dist ./dist
COPY --from=build /usr/src/medtrack/tsconfig.json ./tsconfig.json
COPY --from=build /usr/src/medtrack/index.js ./index.js

EXPOSE 3000

CMD ["node", "index.js"]
