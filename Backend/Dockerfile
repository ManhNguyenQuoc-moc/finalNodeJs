FROM node:20-alpine AS base
WORKDIR /app
ENV CI=true

# THÊM: cài curl để healthcheck trong docker-compose dùng được
RUN apk add --no-cache curl

COPY package*.json ./

# ===== DEV STAGE =====
FROM base AS dev
RUN npm install
COPY . .
ENV NODE_ENV=development
EXPOSE 5000
CMD ["npm", "run", "dev"]

# ===== PROD STAGE =====
FROM base AS prod
# Prod chỉ cài deps thường
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 5000
CMD ["npm", "start"]
