# ========= base =========
FROM node:20-alpine AS base
WORKDIR /app
ENV CI=true
COPY package*.json ./

# ========= dev =========
FROM base AS dev
RUN npm install
COPY . .
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ========= prod =========
FROM base AS prod
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
