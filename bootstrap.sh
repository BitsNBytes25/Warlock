#!/bin/bash
#
# Bootstrap script to set up the Warlock environment.
# This script will install git (if necessary), clone the Warlock repository in /var/www/Warlock,
# and run install-warlock.sh in that directory to complete the setup.
#
# This is meant as a one-liner that users can run with curl or wget to quickly set up Warlock.

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -ne 0 ]]; then
	echo -e "${RED}Error: This script must be run as root${NC}" >&2
	exit 1
fi

echo -e "${GREEN}Starting Warlock bootstrap setup...${NC}"

# Detect OS and install git if necessary
if ! command -v git &> /dev/null; then
	echo -e "${YELLOW}Git not found. Installing git...${NC}"
	if command -v apt-get &> /dev/null; then
		apt-get update
		apt-get install -y git
	elif command -v dnf &> /dev/null; then
		dnf install -y git
	elif command -v yum &> /dev/null; then
		yum install -y git
	elif command -v pacman &> /dev/null; then
		pacman -S --noconfirm git
	elif command -v apk &> /dev/null; then
		apk add git
	else
		echo -e "${RED}Error: Could not detect package manager to install git${NC}" >&2
		exit 1
	fi
	echo -e "${GREEN}Git installed successfully${NC}"
else
	echo -e "${GREEN}Git is already installed${NC}"
fi

# Create installation directory
INSTALL_DIR="/var/www/Warlock"
if [ ! -d "$INSTALL_DIR" ]; then
	echo -e "${YELLOW}Creating installation directory: $INSTALL_DIR${NC}"
    mkdir -p /var/www
fi

chmod a+rx /var/www

# Check if directory already exists
if [[ -d "$INSTALL_DIR/.git" ]]; then
	echo -e "${YELLOW}Warlock repository already exists at $INSTALL_DIR.${NC}"
else
	echo -e "${YELLOW}Cloning Warlock repository to $INSTALL_DIR...${NC}"
	git clone https://github.com/BitsNBytes25/Warlock.git "$INSTALL_DIR"
fi

echo -e "${GREEN}Repository ready at $INSTALL_DIR${NC}"

cd "$INSTALL_DIR"
chmod +x update-warlock.sh
./update-warlock.sh

echo -e "${GREEN}Warlock bootstrap setup completed successfully!${NC}"
