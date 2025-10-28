# ========= base =========
FROM node:20-alpine AS base
WORKDIR /app
ENV CI=true
COPY package*.json ./

# ========= dev =========
FROM base AS dev
# Cài cả dev deps để dùng nodemon trong dev
RUN npm install
COPY . .
ENV NODE_ENV=development
# giữ port đồng bộ với compose
EXPOSE 5000
CMD ["npm", "run", "dev"]

# ========= prod =========
FROM base AS prod
# Prod chỉ cài deps thường
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 5000
CMD ["npm", "start"]
