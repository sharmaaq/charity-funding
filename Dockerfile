FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Production dependencies (playwright, busboy) and, at build time, the Chromium headless shell with its system
# libraries for the S3-001 demo runner. Browsers are never downloaded at request time.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
 && npx playwright install --with-deps --only-shell chromium \
 && chmod -R a+rX /ms-playwright \
 && npm cache clean --force \
 && rm -rf /var/lib/apt/lists/*
COPY server.js ./
COPY server ./server
COPY public ./public
USER node
EXPOSE 8080
CMD ["node", "server.js"]
