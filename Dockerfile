# syntax=docker/dockerfile:1
FROM node:20-alpine

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

# Create data directory for database and set default database path
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/warlock.sqlite

# Volume for persistent data (directory containing sqlite db)
VOLUME ["/app/data"]
VOLUME ["/root/.ssh"]

# Install OpenSSH client for SSH and ssh-keygen support
RUN apk add --no-cache openssh-client

# Start the application
CMD ["npm", "start"]
