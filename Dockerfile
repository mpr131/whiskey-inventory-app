# Multi-stage Dockerfile for Next.js 14 application
# Optimized for both development and production builds

# Default port argument
ARG PORT=3005

# Stage 1: Dependencies
FROM node:18-alpine AS deps
# Add libc6-compat for Alpine compatibility with node packages
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files for dependency installation
COPY package.json package-lock.json* ./
# Install dependencies with npm ci for faster, more reliable builds
RUN npm ci

# Stage 2: Builder
FROM node:18-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy all application files
COPY . .

# Build environment variables
# Note: Build-time variables need to be passed during docker build
ARG NEXT_PUBLIC_APP_URL
ARG MONGODB_URI
ARG NEXTAUTH_URL
ARG NEXTAUTH_SECRET

# Build the Next.js application
RUN npm run build

# Stage 3: Production runner
FROM node:18-alpine AS runner
WORKDIR /app

# Accept port as build argument
ARG PORT=3005

# Set NODE_ENV to production
ENV NODE_ENV production

# Create a non-root user to run the application
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy only necessary files for production
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy Next.js build output and production dependencies
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create uploads directory for future Cloudinary integration
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

# Create a healthcheck script that uses the PORT environment variable
RUN echo '#!/bin/sh' > /app/healthcheck.sh && \
    echo 'node -e "require(\"http\").get(\"http://localhost:${PORT}/api/health\", (res) => process.exit(res.statusCode === 200 ? 0 : 1))"' >> /app/healthcheck.sh && \
    chmod +x /app/healthcheck.sh && \
    chown nextjs:nodejs /app/healthcheck.sh

# Switch to non-root user
USER nextjs

# Set the port environment variable
ENV PORT=${PORT}

# Expose the application port
EXPOSE ${PORT}

# Health check to ensure container is running properly
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD /app/healthcheck.sh

# Start the Next.js application using the standalone server
CMD ["node", "server.js"]

# Development stage (optional, use with docker-compose)
FROM node:18-alpine AS dev
WORKDIR /app

# Accept port as build argument
ARG PORT=3005

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application files
COPY . .

# Set the port environment variable
ENV PORT=${PORT}

# Expose port for development
EXPOSE ${PORT}

# Start development server with hot reload
CMD ["npm", "run", "dev"]