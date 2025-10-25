# Backend/Dockerfile
FROM node:20-alpine

WORKDIR /app

# Cài deps (cache tốt)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy toàn bộ mã nguồn
COPY . .

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# Chạy theo script để sau này đổi entry không cần sửa Dockerfile
CMD ["npm", "start"]
