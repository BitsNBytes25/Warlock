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
CONFIGURE_SYSTEMD=1
ONLY_UPDATE=0
FQDN=""
SSL=0

print_help() {
	cat <<EOF
Usage: $SCRIPT_NAME [options]

Options:
  --user <name>        Run the service as <name> (default: root)
  --skip-nginx	       Do not configure nginx even if it is installed
  --skip-systemd       Do not configure systemd service (just install dependencies and generate .env)
  --update             Update an existing installation ONLY
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
		--skip-systemd)
			CONFIGURE_SYSTEMD=0
			shift
			;;
		--skip-nginx)
			CONFIGURE_NGINX=0
			shift
			;;
		--update)
			ONLY_UPDATE=1
			CONFIGURE_NGINX=0
			CONFIGURE_SYSTEMD=0
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

# Confirm this script is located within /var/www
if [[ "$INSTALL_DIR" != /var/www* ]]; then
	echo "Warlock not located in /var/www/..., disabling nginx and systemd integration"
	CONFIGURE_NGINX=0
	CONFIGURE_SYSTEMD=0
fi

if [ "$EUID" -ne 0 ]; then
	echo "Not running as root, disabling nginx and systemd integration"
	CONFIGURE_NGINX=0
	CONFIGURE_SYSTEMD=0
fi

echo "This script will install Warlock Game Server Manager."
echo ""
echo "We will:"
if [ $CONFIGURE_SYSTEMD -eq 1 ]; then
	echo "  create /etc/systemd/system/warlock.service"
fi
echo "  create $ENV_FILE with defaults (if does not exist)"
if [ $CONFIGURE_NGINX -eq 1 ]; then
	echo "  create /etc/nginx/sites-available/warlock and enable it (if nginx is installed)"
fi
echo ""

if [ $ONLY_UPDATE -eq 0 ]; then
	echo "Press ENTER to continue or CTRL+C to abort."
	read -r

	cat <<EOF
By installing Warlock you are agreeing to the following terms:

Warlock is provided 'as-is', without any express or implied warranty
  and is published under the AGPLv3 license,
  (which in short means that if you modify and distribute the code, you must also
  distribute your modifications under the same license and provide attribution).

Warlock is offered as free software, but a monthly licensing option is encouraged
  to support the project and fund continued development.
  (@todo implement licensing, but meanwhile https://ko-fi.com/bitsandbytes is our donation site.)

Metrics of the server are collected to help improve the project, including:
 * Server OS type and version
 * Warlock version
 * Random Warlock installation identifier
 * Country and approximate region of server
 * Server events such as start or game installation

Metrics such as community information, email addresses, user activity,
  or personally identifiable information are NOT collected.

For more information, please refer to
 * Warlock Documentation: (@todo link to warlock.nexus)
 * Discord: https://discord.gg/jyFsweECPb
 * Mastodon: https://social.bitsnbytes.dev/@sitenews
 * Bits N Bytes: https://bitsnbytes.dev

Do you agree to these terms? (y/N)
EOF
	read -r AGREE
	case "$AGREE" in
    	[yY][eE][sS]|[yY]) ;;
    	*) echo "Aborted by user."; exit 1 ;;
    esac
fi

DISTRO="$(lsb_release -i 2>/dev/null | sed "s#.*:\t##" | tr '[:upper:]' '[:lower:]')"

install_node() {
	if [ "$EUID" -ne 0 ]; then
		echo "Warlock requires Node.js v24 or higher to run. Please install Node.js and re-run this installer." >&2
		exit 1
	fi

	case "$DISTRO" in
		"ubuntu"|"debian")
			curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
			apt install -y nodejs
			;;
		"centos"|"rhel"|"rocky"|"almalinux")
			curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
			yum install -y nodejs
			;;
		"fedora")
			curl -fsSL https://rpm.nodesource.com/setup_24.x | bash -
			dnf install -y nodejs
			;;
		*)
			echo "Automatic Node.js installation not supported on this distribution ($DISTRO). Please install Node.js v24 or higher manually." >&2
			exit 1
			;;
	esac
}

install_nginx() {
	if [ "$EUID" -ne 0 ]; then
		echo "Unable to install nginx without root permissions!  Please run with --skip-nginx or manually install nginx." >&2
		exit 1
	fi

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
}

install_certbot() {
	if [ "$EUID" -ne 0 ]; then
		echo "Unable to install certbot without root permissions!  Skipping SSL." >&2
		return
	fi

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
}

# Locate node
if ! which node; then
	echo "Node.js binary not found in PATH. Attempting installation" >&2
	install_node
fi

if ! NODE_BIN=$(command -v node); then
	echo "Node.js binary not found in PATH.  Cannot continue!" >&2
	exit 1
fi

VERSION="$(node --version | sed 's:v::' | cut -d '.' -f 1)"
if [[ "$VERSION" -lt 24 ]]; then
	echo "Node.js version 24 or higher is required. Detected version: $VERSION" >&2
	echo "Press ENTER to attempt auto-installation, or CTRL+C to abort."
	read -r
	install_node
fi

echo "Using Node $(node --version) at $NODE_BIN"

FQDN=""
if [ -e "/etc/nginx/sites-available/warlock" ]; then
	FQDN=$(grep -m1 'server_name' /etc/nginx/sites-available/warlock | awk '{print $2}' | tr -d ';')
fi

if [ $CONFIGURE_NGINX -eq 1 ]; then
	if ! which nginx; then
		echo "Warning: Nginx not found in PATH.  Attempting auto install" >&2
		install_nginx
	fi

	if ! which certbot; then
		echo "Warning: certbot not found in PATH.  Attempting auto install" >&2
		install_certbot
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
if [ $CONFIGURE_SYSTEMD -eq 1 ]; then
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
fi

# Create environment file
if [ ! -e "$ENV_FILE" ]; then
	SECRET="$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)"
	cat > "$ENV_FILE" <<ENV
IP=127.0.0.1
PORT=3077
NODE_ENV=production
SESSION_SECRET=$SECRET
SKIP_AUTHENTICATION=false
SKIP_2FA=false
WARLOCK_PROFILE=false
ENV
	if [ "$SERVICE_USER" != "root" ]; then
		chown "$SERVICE_USER":"$SERVICE_USER" "$ENV_FILE"
	fi
fi

# Reload systemd and enable/start service
if [ $CONFIGURE_SYSTEMD -eq 1 ]; then
	echo "Reloading systemd daemon..."
	systemctl daemon-reload

	echo "Enabling and starting warlock.service..."
	if ! systemctl enable --now warlock.service; then
		echo "Failed to enable/start warlock.service. Check 'journalctl -u warlock.service' for details." >&2
		exit 1
	fi
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

    client_max_body_size 50M;
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
if [ $CONFIGURE_SYSTEMD -eq 1 ]; then
	echo "Service status:"
	systemctl --no-pager status warlock.service --lines=10 || true
elif [ $ONLY_UPDATE -eq 1 ] && [ "$EUID" -eq 0 ] && [ -e /etc/systemd/system/warlock.service ]; then
	# An update was requested, we have permissions, and the service file exists.
	# Start the service if it's not already running,
	# it was probably stopped prior to the git update from the updater.
	if ! systemctl is-active --quiet warlock; then
		echo "Starting warlock.service..."
		systemctl start warlock

		echo "Service status:"
		systemctl --no-pager status warlock.service --lines=10 || true
	fi
fi

echo "You can access the Warlock web interface at:"
if [ "$FQDN" == "_" ]; then
	# '_' is for wildcard in nginx; it means it's accessible from any IP.
	for IP in $(hostname -I); do
		echo "http://$IP/"
	done
elif [ "$FQDN" == "" ]; then
	# An empty FQDN means nginx is not configured, so we should provide the IP and port directly from the .env file
	IP="$(egrep '^IP' .env | sed 's:.*=::')";
	PORT="$(egrep '^PORT' .env | sed 's:.*=::')";
	echo "http://${IP:-127.0.0.1}:${PORT:-3077}/"
else
	# Any other means nginx is configured with a specific FQDN.
	if [ $SSL -eq 1 ]; then
		echo "https://$FQDN/"
	else
		echo "http://$FQDN/"
	fi
fi

echo "Installation complete. To uninstall, run: sudo ./uninstall-warlock.sh"
