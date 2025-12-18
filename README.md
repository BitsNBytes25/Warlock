# Warlock Game Manager

Server game manager that supports your fleet of servers and games.

## Features

- Simple game installer
- Game configuration management
- Firewall and port management
- Backup and restore functionality
- User-friendly web interface

![Warlock Dashboard](docs/media/warlock-dashboard.webp)

## Getting Started

To install Warlock on a server, do the following as root:

```bash
# Debian/Ubuntu
apt install git
# Fedora/RHEL
dnf install git
# Arch Linux
pacman -S git

mkdir -p /var/www
chmod a+rx /var/www
cd /var/www
git clone https://github.com/BitsNBytes25/Warlock.git
cd Warlock
./install-warlock.sh
```

This will install Node and all required dependencies and set up Warlock to run as a service.

By default it will install nginx as a frontend, taking over the default web server.

You can skip the nginx integration by passing `--skip-nginx` to the install script.

## Supported Platforms

Warlock supports any Linux distribution, but at the moment most games expect
Ubuntu or Debian.

Since Warlock does not _need_ to be on the same server as your game hosts,
you are free to run Warlock on an Arch server (for example)
and have Debian / Ubuntu game hosts in the cluster.

## First Run

When you first install Warlock, you need to set up an admin user via the web interface.
Access your site by its IP or hostname you setup, (recommended to use a domain with SSL/TLS),
and you will be presented with an interface to create your first admin user.

Once created, you can create additional users and add server hosts to your cluster.

By default `localhost` is added as a server host, so you can start installing games right away
on the server on which you install Warlock.
You are free to remove that host from the management interface if you wish to only install games on remote servers.

## Server Hosts

Warlock is designed to manage multiple server hosts from a single interface,
allowing you to install games on whichever system you choose.

![Warlock Server Hosts](docs/media/warlock-hosts.webp)

To add a new server host, you will need to enter its IP address
and ensure it can be reached via SSH from the Warlock server.

Connection from the web management server and game hosts is performed via SSH,
and you will be presented with a command to run on your game host to authorize
the Warlock server to connect.


## Server Files

Warlock provides a basic file management interface for uploading, downloading, and editing configuration files.
This can be useful for various administration tasks.

![Warlock File Manager](docs/media/warlock-files.webp)
![Warlock File Manager](docs/media/warlock-host-files.webp)

## Installing Games

Supported games can be installed by selecting the desired game server
and selecting a compatible server host.

![Warlock Install Game](docs/media/warlock-installer.webp)

## Managing Games

Once installed, games and their instances will show on the dashboard,
along with links to start, stop, and configure them.

![Warlock Manage Games](docs/media/warlock-dashboard.webp)

Some games, (like ARK Survival Ascended) install multiple map instances,
with each instance being configurable and manageable separately.


## Games Supported

* [ARK Survival Ascended](https://github.com/cdp1337/ARKSurvivalAscended-Linux)
* [Minecraft](https://github.com/BitsNBytes25/Minecraft-Installer)
* [Palworld](https://github.com/BitsNBytes25/Palworld-Installer)
* [Project Zomboid](https://github.com/BitsNBytes25/Zomboid-Installer)
* [Valheim](https://github.com/BitsNBytes25/Valheim-Installer)
* [VEIN](https://github.com/BitsNBytes25/VEIN-Dedicated-Server)

To add a new game, [check out the Template Repo](https://github.com/BitsNBytes25/Warlock-Game-Template)
for example code and instructions on getting started!

## Links and Contact

* [Volleyball coach-turned-developer Micah](https://micahtml.com/)
* [Bits n Bytes Community](https://bitsnbytes.dev)
* [Donate to this project](https://ko-fi.com/bitsandbytes)
* [Join our Discord](https://discord.gg/jyFsweECPb)
* [Follow us on Mastodon](https://social.bitsnbytes.dev/@sitenews)


## Analytics Collection

To help improve Warlock, we collect some anonymous analytics data.

This includes:

* Version of Warlock installed
* Server OS name and version
* Games installed

## AI / LLM Disclaimer

Warlock was originally generated with various models including GPT-5 and Claude Sonnet 4.5
via Copilot's integration feature.

Then it was effectively rewritten because generated code is absolutely rubbish and horribly unmaintainable.

After wasting a week just un-fraking the generated code, now we just use those AI models to generate tiny snippets of code throughout this project.
