# Base stage
FROM node:18-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    git \
    bash \
    python3 \
    make \
    g++

WORKDIR /app

# Dependencies stage
FROM base AS dependencies

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Development stage
FROM base AS development

WORKDIR /app

# Copy dependencies from dependencies stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Default command for development
CMD ["npm", "run", "start:dev"]

# Build stage
FROM base AS build

WORKDIR /app

# Copy dependencies and source
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM base AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 3000

# Run as non-root user
USER node

# Start the application
CMD ["npm", "run", "start:prod"]
