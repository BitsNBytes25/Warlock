#!/bin/bash
#
# Firewall - Allow IP/Port [Linux]
#
# Allow a service in the firewall.
#
# Supports:
#   Linux-All
#
# Category:
#   Firewall
#
# Syntax:
#   --ip=<string> - IP address or CIDR network to allow DEFAULT=any
#   --port=<int> - Port(s) to allow (REQUIRED)
#   --proto=<tcp|udp> - Protocol to allow DEFAULT=tcp
#   --comment=<comment> - Optional comment for the rule
#
# License:
#   AGPLv3
#
# Author:
#   Charlie Powell <cdp1337@bitsnbytes.dev>
#
# Link:
#   https://github.com/eVAL-Agency/ScriptsCollection
#
# Changelog:
#   2025.04.10 - Initial version

##
# Simple wrapper to emulate `which -s`
#
# The -s flag is not available on all systems, so this function
# provides a consistent way to check for command existence
# without having to include '&>/dev/null' everywhere.
#
# Returns 0 on success, 1 on failure
#
# Arguments:
#   $1 - Command to check
#
# CHANGELOG:
#   2025.12.15 - Initial version (for a regression fix)
#
function cmd_exists() {
	local CMD="$1"
	which "$CMD" &>/dev/null
	return $?
}

##
# Get which firewall is enabled,
# or "none" if none located
function get_enabled_firewall() {
	if [ "$(systemctl is-active firewalld)" == "active" ]; then
		echo "firewalld"
	elif [ "$(systemctl is-active ufw)" == "active" ]; then
		echo "ufw"
	elif [ "$(systemctl is-active iptables)" == "active" ]; then
		echo "iptables"
	else
		echo "none"
	fi
}

##
# Get which firewall is available on the local system,
# or "none" if none located
#
# CHANGELOG:
#   2025.12.15 - Use cmd_exists to fix regression bug
#   2025.04.10 - Switch from "systemctl list-unit-files" to "which" to support older systems
function get_available_firewall() {
	if cmd_exists firewall-cmd; then
		echo "firewalld"
	elif cmd_exists ufw; then
		echo "ufw"
	elif systemctl list-unit-files iptables.service &>/dev/null; then
		echo "iptables"
	else
		echo "none"
	fi
}
##
# Add an "allow" rule to the firewall in the INPUT chain
#
# Arguments:
#   --port <port>       Port(s) to allow
#   --source <source>   Source IP to allow (default: any)
#   --zone <zone>       Zone to allow (default: public)
#   --tcp|--udp         Protocol to allow (default: tcp)
#   --proto <tcp|udp>   Protocol to allow (alternative method)
#   --comment <comment> (only UFW) Comment for the rule
#
# Specify multiple ports with `--port '#,#,#'` or a range `--port '#:#'`
#
# CHANGELOG:
#   2025.11.23 - Use return codes instead of exit to allow the caller to handle errors
#   2025.04.10 - Add "--proto" argument as alternative to "--tcp|--udp"
#
function firewall_allow() {
	# Defaults and argument processing
	local PORT=""
	local PROTO="tcp"
	local SOURCE="any"
	local FIREWALL=$(get_available_firewall)
	local ZONE="public"
	local COMMENT=""
	while [ $# -ge 1 ]; do
		case $1 in
			--port)
				shift
				PORT=$1
				;;
			--tcp|--udp)
				PROTO=${1:2}
				;;
			--proto)
				shift
				PROTO=$1
				;;
			--source|--from)
				shift
				SOURCE=$1
				;;
			--zone)
				shift
				ZONE=$1
				;;
			--comment)
				shift
				COMMENT=$1
				;;
			*)
				PORT=$1
				;;
		esac
		shift
	done

	if [ "$PORT" == "" -a "$ZONE" != "trusted" ]; then
		echo "firewall_allow: No port specified!" >&2
		return 2
	fi

	if [ "$PORT" != "" -a "$ZONE" == "trusted" ]; then
		echo "firewall_allow: Trusted zones do not use ports!" >&2
		return 2
	fi

	if [ "$ZONE" == "trusted" -a "$SOURCE" == "any" ]; then
		echo "firewall_allow: Trusted zones require a source!" >&2
		return 2
	fi

	if [ "$FIREWALL" == "ufw" ]; then
		if [ "$SOURCE" == "any" ]; then
			echo "firewall_allow/UFW: Allowing $PORT/$PROTO from any..."
			ufw allow proto $PROTO to any port $PORT comment "$COMMENT"
		elif [ "$ZONE" == "trusted" ]; then
			echo "firewall_allow/UFW: Allowing all connections from $SOURCE..."
			ufw allow from $SOURCE comment "$COMMENT"
		else
			echo "firewall_allow/UFW: Allowing $PORT/$PROTO from $SOURCE..."
			ufw allow from $SOURCE proto $PROTO to any port $PORT comment "$COMMENT"
		fi
		return 0
	elif [ "$FIREWALL" == "firewalld" ]; then
		if [ "$SOURCE" != "any" ]; then
			# Firewalld uses Zones to specify sources
			echo "firewall_allow/firewalld: Adding $SOURCE to $ZONE zone..."
			firewall-cmd --zone=$ZONE --add-source=$SOURCE --permanent
		fi

		if [ "$PORT" != "" ]; then
			echo "firewall_allow/firewalld: Allowing $PORT/$PROTO in $ZONE zone..."
			if [[ "$PORT" =~ ":" ]]; then
				# firewalld expects port ranges to be in the format of "#-#" vs "#:#"
				local DPORTS="${PORT/:/-}"
				firewall-cmd --zone=$ZONE --add-port=$DPORTS/$PROTO --permanent
			elif [[ "$PORT" =~ "," ]]; then
				# Firewalld cannot handle multiple ports all that well, so split them by the comma
				# and run the add command separately for each port
				local DPORTS="$(echo $PORT | sed 's:,: :g')"
				for P in $DPORTS; do
					firewall-cmd --zone=$ZONE --add-port=$P/$PROTO --permanent
				done
			else
				firewall-cmd --zone=$ZONE --add-port=$PORT/$PROTO --permanent
			fi
		fi

		firewall-cmd --reload
		return 0
	elif [ "$FIREWALL" == "iptables" ]; then
		echo "firewall_allow/iptables: WARNING - iptables is untested"
		# iptables doesn't natively support multiple ports, so we have to get creative
		if [[ "$PORT" =~ ":" ]]; then
			local DPORTS="-m multiport --dports $PORT"
		elif [[ "$PORT" =~ "," ]]; then
			local DPORTS="-m multiport --dports $PORT"
		else
			local DPORTS="--dport $PORT"
		fi

		if [ "$SOURCE" == "any" ]; then
			echo "firewall_allow/iptables: Allowing $PORT/$PROTO from any..."
			iptables -A INPUT -p $PROTO $DPORTS -j ACCEPT
		else
			echo "firewall_allow/iptables: Allowing $PORT/$PROTO from $SOURCE..."
			iptables -A INPUT -p $PROTO $DPORTS -s $SOURCE -j ACCEPT
		fi
		iptables-save > /etc/iptables/rules.v4
		return 0
	elif [ "$FIREWALL" == "none" ]; then
		echo "firewall_allow: No firewall detected" >&2
		return 1
	else
		echo "firewall_allow: Unsupported or unknown firewall" >&2
		echo 'Please report this at https://github.com/cdp1337/ScriptsCollection/issues' >&2
		return 1
	fi
}
function usage() {
  cat >&2 <<EOD
Usage: $0 [options]

Options:
    --ip=<string> - IP address or CIDR network to allow DEFAULT=any
    --port=<int> - Port(s) to allow (REQUIRED)
    --proto=<tcp|udp> - Protocol to allow DEFAULT=tcp
    --comment=<comment> - Optional comment for the rule

Allow a service in the firewall.
EOD
  exit 1
}

# Parse arguments
SOURCE="any"
PORT=""
PROTO="tcp"
COMMENT=""
while [ "$#" -gt 0 ]; do
	case "$1" in
		--ip=*|--ip)
			[ "$1" == "--ip" ] && shift 1 && SOURCE="$1" || SOURCE="${1#*=}"
			[ "${SOURCE:0:1}" == "'" ] && [ "${SOURCE:0-1}" == "'" ] && SOURCE="${SOURCE:1:-1}"
			[ "${SOURCE:0:1}" == '"' ] && [ "${SOURCE:0-1}" == '"' ] && SOURCE="${SOURCE:1:-1}"
			;;
		--port=*|--port)
			[ "$1" == "--port" ] && shift 1 && PORT="$1" || PORT="${1#*=}"
			[ "${PORT:0:1}" == "'" ] && [ "${PORT:0-1}" == "'" ] && PORT="${PORT:1:-1}"
			[ "${PORT:0:1}" == '"' ] && [ "${PORT:0-1}" == '"' ] && PORT="${PORT:1:-1}"
			;;
		--proto=*|--proto)
			[ "$1" == "--proto" ] && shift 1 && PROTO="$1" || PROTO="${1#*=}"
			[ "${PROTO:0:1}" == "'" ] && [ "${PROTO:0-1}" == "'" ] && PROTO="${PROTO:1:-1}"
			[ "${PROTO:0:1}" == '"' ] && [ "${PROTO:0-1}" == '"' ] && PROTO="${PROTO:1:-1}"
			;;
		--comment=*|--comment)
			[ "$1" == "--comment" ] && shift 1 && COMMENT="$1" || COMMENT="${1#*=}"
			[ "${COMMENT:0:1}" == "'" ] && [ "${COMMENT:0-1}" == "'" ] && COMMENT="${COMMENT:1:-1}"
			[ "${COMMENT:0:1}" == '"' ] && [ "${COMMENT:0-1}" == '"' ] && COMMENT="${COMMENT:1:-1}"
			;;
		-h|--help) usage;;
		*) echo "Unknown argument: $1" >&2; usage;;
	esac
	shift 1
done
if [ -z "$PORT" ]; then
	usage
fi


FIREWALL_ENABLED="$(get_enabled_firewall)"

if [ "$FIREWALL_ENABLED" == "none" ]; then
	echo "No firewall enabled!" >&2
	exit 1
fi

firewall_allow --port "$PORT" --proto "$PROTO" --source "$SOURCE" --comment "$COMMENT"
