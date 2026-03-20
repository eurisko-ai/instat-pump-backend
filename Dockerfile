FROM node:18-alpine

WORKDIR /app

# Install all dependencies (needed for TypeScript compilation)
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm install -g typescript && tsc

# Create data directory
RUN mkdir -p /app/data

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 3000

# Start server (migrations run automatically on app startup)
CMD ["npm", "start"]
