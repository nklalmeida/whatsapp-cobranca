FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY src/ ./src/
COPY public/ ./public/
COPY certs/ ./certs/

EXPOSE 3000

CMD ["node", "src/index.js"]
