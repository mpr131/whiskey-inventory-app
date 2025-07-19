# Multi-stage Dockerfile for Next.js 14 application
# Optimized for both development and production builds

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

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3005

# Set the port environment variable
ENV PORT 3005

# Health check to ensure container is running properly
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3005/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the Next.js application
CMD ["node", "server.js"]

# Development stage (optional, use with docker-compose)
FROM node:18-alpine AS dev
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application files
COPY . .

# Expose port for development
EXPOSE 3005

# Start development server with hot reload
CMD ["npm", "run", "dev"]