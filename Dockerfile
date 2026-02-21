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

# Volumes for persistent data (sqlite db and assets)
VOLUME ["/app/warlock.sqlite"]

# Start the application
CMD ["npm", "start"]

