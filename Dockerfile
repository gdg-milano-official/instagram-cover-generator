FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY server.mjs ./
COPY --from=build /app/dist/ ./dist/
EXPOSE 8080
CMD ["node", "server.mjs"]
