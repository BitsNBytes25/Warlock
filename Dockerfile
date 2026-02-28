# syntax=docker/dockerfile:1
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application
COPY . .

# Expose the port the app runs on
EXPOSE 3077

# Environment variables for authentication/2FA skipping (can be overridden at runtime)
ENV SKIP_AUTHENTICATION=false
ENV SKIP_2FA=false
ENV IP=0.0.0.0
ENV NODE_ENV=production
ENV WARLOCK_PROFILE=false

# Create data directory for database and set default database path
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/warlock.sqlite

# Install OpenSSH client for SSH and ssh-keygen support
RUN apk add --no-cache openssh-client

# Create non-root user 'warlock' and set up home directory with SSH keys
RUN addgroup -g 1001 warlock
RUN adduser -D -u 1001 -G warlock -h /home/warlock warlock
RUN mkdir -p /home/warlock/.ssh
RUN chown -R warlock:warlock /home/warlock /app/data

# Volume for persistent data (directory containing sqlite db and SSH keys)
VOLUME ["/app/data"]
VOLUME ["/home/warlock/.ssh"]

# Switch to non-root user
USER warlock

# Start the application
CMD ["npm", "start"]
