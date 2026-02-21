# Warlock Docker Deployment

## Quick Start

1. Build the image:
   ```bash
   docker build -t warlock .
   ```
2. Run the container:
   ```bash
   docker run -d \
     -p 3077:3077 \
     -e SKIP_AUTHENTICATION=false \
     -e SKIP_2FA=false \
     -v $(pwd)/warlock.sqlite:/app/warlock.sqlite \
     --name warlock warlock
   ```

Or use docker-compose:

```bash
docker-compose up -d
```

## Environment Variables
- `SKIP_AUTHENTICATION` (default: false) — Set to true to disable authentication
- `SKIP_2FA` (default: false) — Set to true to disable 2FA

## Persistent Data
- `warlock.sqlite` is mounted as volumes for data persistence.

## Nginx/SSL
- For production, use an external nginx reverse proxy for SSL and asset caching.

## Example
Access the app at http://localhost:3077 after starting the container.

