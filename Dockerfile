# Multi-stage build for NestJS app

FROM node:20-alpine AS builder
WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci

# Copy sources and build
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
COPY public ./public
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Only production deps
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy build artifacts and static assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public

ENV NODE_ENV=production
# Fly.io will route to the internal port below
ENV APP_PORT=8080
EXPOSE 8080

CMD ["node","dist/main.js"]


