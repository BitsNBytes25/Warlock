#!/usr/bin/env bash
# install-warlock.sh
# Install Warlock as a systemd service in-place (service runs from the directory where this script lives)
# Usage: install-warlock.sh [--user <name>] [--help]

SCRIPT_NAME=$(basename "$0")
INSTALL_DIR="$(dirname "$(readlink -f "$0")")"
NODE_BIN=""
SERVICE_UNIT_PATH="/etc/systemd/system/warlock.service"
ENV_FILE="$INSTALL_DIR/.env"
SERVICE_USER=root
CONFIGURE_NGINX=1
FQDN=""

print_help() {
  cat <<EOF
Usage: $SCRIPT_NAME [options]

Options:
  --user <name>        Run the service as <name> (default: root)
  --skip-nginx	       Do not configure nginx even if it is installed
  --help               Show this help message

This installer will:
 - Resolve the install directory to the location of this script and run the service from there
 - Detect the node binary and generate a systemd unit at $SERVICE_UNIT_PATH
 - Enable and start the warlock.service via systemd

Note: This script must be run as root to install the systemd unit and write to /etc.
EOF
}

# Parse args
while [[ $# -gt 0 ]]; do
	case "$1" in
		--user)
			shift
			if [[ $# -eq 0 ]]; then
				echo "--user requires an argument" >&2
				exit 1
			fi
			SERVICE_USER="$1"
			shift
			;;
		--skip-nginx)
			CONFIGURE_NGINX=0
			shift
			;;
		--help)
			print_help
			exit 0
			;;
		*)
			echo "Unknown option: $1" >&2
			print_help
			exit 1
			;;
	esac
done

# Require root
if [[ $(id -u) -ne 0 ]]; then
	echo "This installer must be run as root." >&2
	exit 1
fi

# Locate node
if ! NODE_BIN=$(command -v node); then
	echo "Node.js binary not found in PATH. Install Node.js or make it available in PATH." >&2
	exit 1
fi

if ! which -s nginx; then
	echo "Warning: Nginx not found in PATH. You may need to set up a reverse proxy manually." >&2
	CONFIGURE_NGINX=0
fi

VERSION="$(node --version | sed 's:v::' | cut -d '.' -f 1)"
if [[ "$VERSION" -lt 20 ]]; then
	echo "Node.js version 20 or higher is required. Detected version: $VERSION" >&2
	echo "" >&2
	echo "If you are on Ubuntu/Debian, you can use the following to install v20:" >&2
	echo '  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -' >&2
	echo '  sudo apt-get install -y nodejs' >&2
	exit 1
fi

echo "This script will configure Warlock as a system service and configure it for nginx."
echo ""
echo "We will:"
echo "  create /etc/systemd/system/warlock.service"
echo "  create $ENV_FILE with defaults"
if [ $CONFIGURE_NGINX -eq 0 ]; then
	echo "  skip nginx configuration even if nginx is installed"
else
	echo "  create /etc/nginx/sites-available/warlock and enable it (if nginx is installed)"
fi
echo ""
echo "Press ENTER to continue or CTRL+C to abort."
read -r

if [ $CONFIGURE_NGINX -eq 1 ]; then
	FQDN=""
	if [ -e "/etc/nginx/sites-available/warlock" ]; then
		FQDN=$(grep -m1 'server_name' /etc/nginx/sites-available/warlock | awk '{print $2}' | tr -d ';')
	fi

	if [ -n "$FQDN" ]; then
		echo "Using existing FQDN from nginx config: $FQDN"
	else
		echo "What is the fully qualified domain name (FQDN) for this server? (used in nginx config and SSL registration)"
		read -r FQDN
	fi

	if [ -z "$FQDN" ]; then
		# _ is a wildcard for nginx server_name
    	FQDN="_"
    fi
fi


# Install dependencies for this application.
PWD="$(pwd)"
if [ "$PWD" != "$INSTALL_DIR" ]; then
	cd "$INSTALL_DIR"
fi
npm install
if [ "$PWD" != "$INSTALL_DIR" ]; then
	cd "$PWD"
fi

# Generate unit file
echo "Generating and saving unit file"
TMP_UNIT=$(mktemp)
cat > "$TMP_UNIT" <<UNIT
[Unit]
Description=Warlock Management App
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=$NODE_BIN $INSTALL_DIR/app.js
Restart=on-failure
# Run as the requested user (omit or set to root by default)
User=$SERVICE_USER
# Environment file (optional)
EnvironmentFile=$ENV_FILE
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
UNIT

chmod 0644 "$TMP_UNIT"
mv "$TMP_UNIT" "$SERVICE_UNIT_PATH"

# Create environment file
if [ ! -e "$ENV_FILE" ]; then
	SECRET="$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)"
	cat > "$ENV_FILE" <<ENV
PORT=3077
NODE_ENV=production
SESSION_SECRET=$SECRET
SKIP_AUTHENTICATION=false
ENV
	if [ "$SERVICE_USER" != "root" ]; then
		chown "$SERVICE_USER":"$SERVICE_USER" "$ENV_FILE"
	fi
fi

# Reload systemd and enable/start service
echo "Reloading systemd daemon..."
systemctl daemon-reload

echo "Enabling and starting warlock.service..."
if ! systemctl enable --now warlock.service; then
  echo "Failed to enable/start warlock.service. Check 'journalctl -u warlock.service' for details." >&2
  exit 1
fi

# If nginx is installed, generate a simple site config that reverse-proxies to the local app
if [ $CONFIGURE_NGINX -eq 1 ]; then
	echo "Generating nginx site config..."
	NGINX_AVAILABLE="/etc/nginx/sites-available/warlock"
	NGINX_ENABLED="/etc/nginx/sites-enabled/warlock"
	# Backup existing config if present
	if [[ -f "$NGINX_AVAILABLE" ]]; then
		TS=$(date +%s)
		cp -a "$NGINX_AVAILABLE" "${NGINX_AVAILABLE}.bak.$TS"
	fi

	TMP_NGINX=$(mktemp)
	cat > "$TMP_NGINX" <<NGINX
server {
    listen 80;
    server_name $FQDN;

    client_max_body_size 1G;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_pass_request_body on;

    # Serve static assets directly from the install directory
    location /assets/ {
        alias $INSTALL_DIR/public/assets/;
        access_log off;
        expires 1d;
    }

    # Proxy all other requests to the local Node.js app
    location / {
        proxy_pass http://127.0.0.1:3077;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX
	chmod 0644 "$TMP_NGINX"
	mv "$TMP_NGINX" "$NGINX_AVAILABLE"
	ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"

	# Test nginx config and reload if valid
	if nginx -t >/dev/null 2>&1; then
		echo "Nginx configuration OK — reloading nginx"
		systemctl reload nginx || echo "Warning: failed to reload nginx" >&2

		if which -s certbot; then
			echo "Attempting to obtain/renew SSL certificate via certbot for $FQDN"
			certbot --nginx -d "$FQDN" --non-interactive --agree-tos --redirect || echo "Warning: certbot failed to obtain/renew certificate" >&2
		else
			echo "Note: certbot not found; skipping SSL certificate setup."
		fi
	else
		echo "Warning: generated nginx configuration failed nginx -t. Leaving the file in $NGINX_AVAILABLE for inspection." >&2
	fi
else
	echo "Note: nginx not found; skipping nginx site generation."
fi

# Output quick verification
echo "Service status:"
systemctl --no-pager status warlock.service --lines=10 || true

echo "Recent journal entries (last 50 lines):"
journalctl -u warlock.service -n 50 --no-pager || true

echo "Installation complete. To uninstall, run: sudo ./uninstall-warlock.sh"
