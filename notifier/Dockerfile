FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY notifier.js filing.js ./
CMD ["node", "notifier.js"]
