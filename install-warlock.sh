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
SSL=0

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

# Confirm this script is located within /var/www
if [[ "$INSTALL_DIR" != /var/www* ]]; then
	echo "Warning: It is recommended to install Warlock within /var/www (current location: $INSTALL_DIR)" >&2
	echo ""
	echo "Installing in another directory may lead to the web application not working."
	echo "Press ENTER to continue or CTRL+C to abort."
	read -r
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

echo "By installing Warlock you are agreeing to the following terms:"
echo ""
echo "Warlock is provided 'as-is', without any express or implied warranty"
echo " and is published under the AGPLv3 license,"
echo " (which in short means that if you modify and distribute the code, you must also"
echo " distribute your modifications under the same license)."
echo ""
echo "Commercial paid support IS available from eVAL Agency."
echo ""
echo "Metrics of the server are collected to help improve the project, including:"
echo " * Server OS type and version"
echo " * Warlock version"
echo " * Random Warlock installation identifier"
echo " * Country and approximate region of server"
echo " * Server events such as start or game installation"
echo ""
echo "Metrics such as community information, email addresses, user activity,"
echo " or personally identifiable information are NOT collected."
echo ""
echo "For more information, please refer to"
echo " * Warlock Documentation: (@todo link to Warlock documentation here)"
echo " * Discord: https://discord.gg/jyFsweECPb"
echo " * Mastodon: https://social.bitsnbytes.dev/@sitenews"
echo " * Bits N Bytes: https://bitsnbytes.dev"
echo ""
echo "Press ENTER to accept these terms and continue installation, or CTRL+C to abort."
read -r

DISTRO="$(lsb_release -i 2>/dev/null | sed "s#.*:\t##" | tr '[:upper:]' '[:lower:]')"

# Locate node
if ! which node; then
	echo "Node.js binary not found in PATH. Attempting installation" >&2
	case "$DISTRO" in
		"ubuntu"|"debian")
			curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
			apt install -y nodejs
			;;
		"centos"|"rhel"|"rocky"|"almalinux")
			curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
			yum install -y nodejs
			;;
		"fedora")
			curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
			dnf install -y nodejs
			;;
		*)
			echo "Automatic Node.js installation not supported on this distribution ($DISTRO). Please install Node.js v20 or higher manually." >&2
			exit 1
			;;
	esac
fi

if ! NODE_BIN=$(command -v node); then
	echo "Node.js binary not found in PATH.  Cannot continue!" >&2
	exit 1
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

if [ $CONFIGURE_NGINX -eq 1 ]; then
	if ! which nginx; then
    	echo "Warning: Nginx not found in PATH.  Attempting auto install" >&2
    	case "$DISTRO" in
			"ubuntu"|"debian")
				apt install -y nginx
				;;
			"centos"|"rhel"|"rocky"|"almalinux")
				yum install -y nginx
				;;
			"fedora")
				dnf install -y nginx
				;;
			*)
				echo "Automatic Nginx installation not supported on this distribution ($DISTRO). Please install Nginx manually or re-run this script with --skip-nginx." >&2
				exit 1
				;;
		esac
    fi

    if ! which certbot; then
		echo "Warning: certbot not found in PATH.  Attempting auto install" >&2
		case "$DISTRO" in
			"ubuntu"|"debian")
				apt install -y certbot python3-certbot-nginx
				;;
			"centos"|"rhel"|"rocky"|"almalinux")
				yum install -y certbot python3-certbot-nginx
				;;
			"fedora")
				dnf install -y certbot python3-certbot-nginx
				;;
			*)
				echo "Automatic certbot installation not supported on this distribution ($DISTRO). Please install certbot manually if you wish to use SSL certificates." >&2
				;;
		esac
	fi

	FQDN=""
	if [ -e "/etc/nginx/sites-available/warlock" ]; then
		FQDN=$(grep -m1 'server_name' /etc/nginx/sites-available/warlock | awk '{print $2}' | tr -d ';')
	fi

	if [ -n "$FQDN" ]; then
		echo "Using existing FQDN from nginx config: $FQDN"
	else
		echo "Warlock is access via a web browser by either an IP address or a domain name."
		echo "If you have a domain name pointed to this server, please enter it here."
		echo ""
		echo "This will enable SSL certificate generation via certbot."
		echo "If you do not have a domain name, just press ENTER to continue."
		echo ""
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

	if [ -h /etc/nginx/sites-enabled/default ]; then
		echo "Removing default nginx site symlink"
		unlink /etc/nginx/sites-enabled/default
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
    proxy_read_timeout 10m;

    # Serve the service worker at root so it can control site-wide scope
    location = /service-worker.js {
        alias $INSTALL_DIR/public/service-worker.js;
        access_log off;
    }

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

		if which certbot && [ "$FQDN" != "_" ]; then
			echo "Attempting to obtain/renew SSL certificate via certbot for $FQDN"
			if certbot --nginx -d "$FQDN" --non-interactive --agree-tos --redirect; then
				SSL=1
			else
				echo "Warning: certbot failed to obtain/renew certificate" >&2
			fi
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

echo "You can access the Warlock web interface at:"
if [ "$FQDN" != "_" ]; then
	for IP in $(hostname -I); do
		echo "http://$IP/"
	done
else
	if [ $SSL -eq 1 ]; then
		echo "https://$FQDN/"
	else
		echo "http://$FQDN/"
	fi
fi

echo "Installation complete. To uninstall, run: sudo ./uninstall-warlock.sh"
