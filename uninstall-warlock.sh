#!/usr/bin/env bash
#
# Stop, disable and remove the warlock systemd service
#
# @author Charlie Powell <cdp1337@bitsnbytes.dev>
# @license AGPLv3.0
# @see https://warlock.nexus
# @source https://github.com/BitsNBytes25/Warlock
#

SERVICE_UNIT_PATH="/etc/systemd/system/warlock.service"

print_help() {
  cat <<EOF
Usage: $(basename "$0") [--help]

Options:
  --help     Show this help message

This will stop and disable the warlock.service and remove the systemd unit file.
EOF
}

# Parse args
while [[ $# -gt 0 ]]; do
	case "$1" in
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

if [[ $(id -u) -ne 0 ]]; then
  echo "This script must be run as root." >&2
  exit 1
fi

if systemctl list-units --full -all | grep -q "warlock.service"; then
	echo "Stopping warlock.service..."
	systemctl stop warlock.service
	echo "Disabling warlock.service..."
	systemctl disable warlock.service
else
	echo "warlock.service not found in systemd unit list."
fi

[ -f "$SERVICE_UNIT_PATH" ] && rm -f "$SERVICE_UNIT_PATH"

# Reload systemd
systemctl daemon-reload

echo "Uninstall complete. If you want to remove the app files, delete the install directory manually."
