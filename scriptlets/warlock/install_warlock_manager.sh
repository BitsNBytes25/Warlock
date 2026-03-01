##
# Install the management script from the project's repo
#
# Expects the following variables:
#   GAME_USER    - User account to install the game under
#   GAME_DIR     - Directory to install the game into
#
# @param $1 Repo Name (e.g., user/repo)
# @param $2 Branch Name (default: main)
#
# CHANGELOG:
#   20260301 - Update to install warlock-manager from github (along with its dependencies) as a pip package
#
function install_warlock_manager() {
	print_header "Performing install_management"

	# Install management console and its dependencies
	local SRC=""
	local REPO="$1"
	local BRANCH="${2:-main}"

	SRC="https://raw.githubusercontent.com/${REPO}/refs/heads/${BRANCH}/dist/manage.py"

	if ! download "$SRC" "$GAME_DIR/manage.py"; then
		echo "Could not download management script!" >&2
		exit 1
	fi

	chown $GAME_USER:$GAME_USER "$GAME_DIR/manage.py"
	chmod +x "$GAME_DIR/manage.py"

	# Install configuration definitions
	cat > "$GAME_DIR/configs.yaml" <<EOF
# script:configs.yaml
EOF
	chown $GAME_USER:$GAME_USER "$GAME_DIR/configs.yaml"

	# Most games use .settings.ini for manager settings
	touch "$GAME_DIR/.settings.ini"
	chown $GAME_USER:$GAME_USER "$GAME_DIR/.settings.ini"

	# A python virtual environment is now required by Warlock-based managers.
	sudo -u $GAME_USER python3 -m venv "$GAME_DIR/.venv"
	sudo -u $GAME_USER "$GAME_DIR/.venv/bin/pip" install --upgrade pip
	sudo -u $GAME_USER "$GAME_DIR/.venv/bin/pip" install warlock-manager@git+https://github.com/BitsNBytes25/Warlock-Manager.git@main
}

