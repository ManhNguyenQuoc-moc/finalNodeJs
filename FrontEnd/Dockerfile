# FrontEnd/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Copy toàn bộ mã nguồn frontend
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# Nếu FE của bạn dùng file khác (app.js/server.js) thì đổi lại dòng dưới
CMD ["node", "index.js"]
