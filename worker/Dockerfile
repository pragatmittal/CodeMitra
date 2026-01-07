# Multi-stage build for TypeScript compilation
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY worker/package*.json ./
COPY worker/tsconfig.json ./

# Install ALL dependencies (including devDependencies for TypeScript)
RUN npm install

# Install tsc-alias for path resolution
RUN npm install --save-dev tsc-alias

# Copy source code
COPY worker/src ./src

# Build the application and resolve path aliases
RUN npm run build
RUN npx tsc-alias -p tsconfig.json -f

# Verify build output
RUN ls -la dist/ || echo "Build failed - dist directory not created"

# Production stage
FROM node:18-alpine AS runner

# Install Docker CLI for code execution
RUN apk add --no-cache docker-cli

# Install curl for health checks
RUN apk add --no-cache curl

# Set working directory
WORKDIR /app

# Copy package files from builder stage
COPY --from=builder /app/package*.json ./

# Copy node_modules from builder stage (includes all dependencies)
COPY --from=builder /app/node_modules ./node_modules

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# For Docker-in-Docker, run as root to avoid permission issues
# This is safe in a containerized environment with proper network isolation

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["npm", "start"]
