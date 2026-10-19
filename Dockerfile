FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.ts tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY server.ts ./
COPY --from=build /app/dist/ ./dist/
EXPOSE 8080
CMD ["node", "server.ts"]
