# 1. Base Image: Lean Node.js 20 Alpine Linux (~50MB)
FROM node:20-alpine

# 2. Install OpenSSL for Prisma ORM binary engine on Alpine
RUN apk add --no-cache openssl

# 3. Set working directory inside the container
WORKDIR /app

# 4. Copy package definitions first (Docker layer cache optimization)
COPY package*.json ./

# 5. Install production dependencies
RUN npm install

# 6. Copy Prisma schema and generate the Prisma Client
COPY prisma ./prisma/
RUN npx prisma generate

# 7. Copy all remaining application code
COPY . .

# 8. Expose the port Express listens on
EXPOSE 5000

# 9. Start the Express server
CMD ["node", "index.js"]
