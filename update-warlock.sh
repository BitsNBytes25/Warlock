#!/bin/bash
#
# Update Warlock application to the newest version available in git.
#
# Checks which branch the user is currently on and checks permissions to require running as the owner of Warlock.

# Get the owner of the .git directory
if [ ! -d ".git" ]; then
	echo "Error: .git directory not found. Are you in the Warlock root directory?"
	exit 1
fi

GIT_OWNER=$(stat -c '%U' .git)
CURRENT_USER=$(whoami)

# Check if running as root/sudo
if [ "$EUID" -eq 0 ]; then
	# Running as root, check if current user is the git owner
	if [ "$CURRENT_USER" != "$GIT_OWNER" ]; then
		# Re-run as the git owner
		exec sudo -u "$GIT_OWNER" "$0" "$@"
		exit 0
	fi
else
	# Not running as root, check if current user is the git owner
	if [ "$CURRENT_USER" != "$GIT_OWNER" ]; then
		echo "Error: This script must be run as the git owner '$GIT_OWNER' or as root."
		exit 1
	fi
fi

# Get current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Fetch latest remote info
echo "Fetching remote branch information..."
git fetch origin

# Get all remote branches with their last commit dates, sorted by most recent
declare -a branches
declare -a dates
declare -a commits

while IFS=$'\t' read -r branch date commit; do
	# Remove 'origin/' prefix from branch name
	branch_name="${branch#origin/}"
	if [ "$branch_name" == "HEAD" ]; then
		continue
	fi
	branches+=("$branch_name")
	dates+=("$date")
	commits+=("$commit")
done < <(git for-each-ref --sort=-committerdate --format='%(refname)	%(committerdate:short)	%(objectname:short)' refs/remotes/origin | sed 's|refs/remotes/||')

# Display branches
echo ""
echo "Available remote branches:"
echo ""

for i in "${!branches[@]}"; do
	if [ "${branches[$i]}" == "$CURRENT_BRANCH" ]; then
		echo "  [$((i+1))] * ${branches[$i]} (${dates[$i]}) ${commits[$i]} [CURRENT]"
	else
		echo "  [$((i+1))] ${branches[$i]} (${dates[$i]}) ${commits[$i]}"
	fi
done

echo ""
echo "  [0] Cancel"
echo ""

# Get user selection (empty selection uses current branch)
read -p "Select branch number to switch/upgrade (default: $CURRENT_BRANCH): " selection

# Use current branch if no selection provided
if [ -z "$selection" ]; then
	echo "Using current branch: $CURRENT_BRANCH"
	selected_branch="$CURRENT_BRANCH"
else
	# Validate selection
    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [ "$selection" -lt 0 ] || [ "$selection" -gt "${#branches[@]}" ]; then
    	echo "Error: Invalid selection."
    	exit 1
    fi

    # Check if user cancelled
    if [ "$selection" -eq 0 ]; then
    	echo "Cancelled."
    	exit 0
    fi

    # Adjust for 0-based array indexing
    selection=$((selection - 1))
    selected_branch="${branches[$selection]}"
fi

if [ "$selected_branch" == "$CURRENT_BRANCH" ]; then
	# Check to see if there's an update available on the current branch.
	# If there's no change, there's nothing to do and we can just exit.
	echo "Checking for updates on current branch..."
	git fetch origin "$CURRENT_BRANCH"
	local_changes=$(git diff --name-only HEAD origin/"$CURRENT_BRANCH")
	if [ -z "$local_changes" ]; then
		echo "Already up to date on branch: $CURRENT_BRANCH"
		exit 0
	fi
fi

START_WARLOCK=0
if [ "$EUID" -eq 0 ] && [ -e /etc/systemd/system/warlock.service ]; then
	# Running as root and there's a Warlock service; stop it first if it's running
	if systemctl is-active --quiet warlock; then
		echo "Stopping Warlock service..."
		systemctl stop warlock
		START_WARLOCK=1
	fi
fi

if [ "$selected_branch" != "$CURRENT_BRANCH" ]; then
	# Switch to selected branch and pull latest
	echo ""
	echo "Switching to branch: $selected_branch"
	git checkout "$selected_branch"

	if [ $? -ne 0 ]; then
		echo "Error: Failed to checkout branch."
		exit 1
	fi
fi

echo "Pulling latest changes..."
git pull origin "$selected_branch"

if [ $? -eq 0 ]; then
	echo "Successfully updated to branch: $selected_branch"
else
	echo "Error: Failed to pull from remote."
	exit 1
fi

# Run the installer with --update to perform any migrations necessary.
if [ -f "install-warlock.sh" ]; then
	if [ -f ".env" ]; then
		# This is expected to be ran in update mode
		echo "Running installer to apply any necessary updates..."
		./install-warlock.sh --update
	else
		# but can also run as a new installation if .env is missing,
		# ie: if called from the bootstrap script after cloning a new branch
		echo "Running installer to complete new installation..."
		./install-warlock.sh
	fi
else
	echo "Warning: install-warlock.sh not found. Please run the installer manually to apply any necessary updates."
fi
