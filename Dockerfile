FROM node:20-alpine

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy package files
COPY package.json ./
COPY yarn.lock ./

# Install dependencies
RUN yarn

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create directories for profiling output
RUN mkdir -p heap-snapshots cpu-profiles

# Set memory limits via environment
ENV NODE_OPTIONS="--max-old-space-size=200 --expose-gc"

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/profiling/health || exit 1

# Start the application
CMD ["node", "dist/main.js"]