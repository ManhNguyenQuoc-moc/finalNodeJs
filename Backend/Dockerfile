
FROM node:20-alpine AS base
WORKDIR /app
ENV CI=true
COPY package*.json ./
FROM base AS dev
RUN npm install
COPY . .
ENV NODE_ENV=development
CMD ["npm", "run", "dev"]
FROM base AS prod
# Prod chỉ cài deps thường
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 5000
CMD ["npm", "start"]
