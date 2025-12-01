# Warlock Express App

A simple Express.js application that serves HTML pages.

## Features

- Express.js server setup
- Static file serving from public directory
- Multiple HTML pages with routing
- Basic CSS styling included
- Development server with nodemon support

## Project Structure

```
Warlock/
├── app.js              # Main Express server file
├── package.json        # Dependencies and scripts
├── public/            # Static files directory
│   ├── index.html     # Home page
│   └── about.html     # About page
└── README.md          # This file
```

## Getting Started

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs nginx git -y

sudo ./install-warlock.sh
# or run under a service user:
sudo ./install-warlock.sh --user warlock

sudo ./uninstall-warlock.sh



1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the production server:**
   ```bash
   npm start
   ```

3. **Start the development server (with auto-reload):**
   ```bash
   npm run dev
   ```

## Usage

- Visit `http://localhost:3000` to see the home page
- Visit `http://localhost:3000/about` to see the about page

## Available Scripts

- `npm start` - Starts the production server
- `npm run dev` - Starts the development server with nodemon (auto-restart on file changes)

## Server Configuration

The server runs on port 3000 by default, but you can set a custom port using the PORT environment variable:

```bash
PORT=8000 npm start
```

## Games Supported

* [ARK Survival Ascended](https://github.com/cdp1337/ARKSurvivalAscended-Linux)
* [Minecraft](https://github.com/BitsNBytes25/Minecraft-Installer)
* [Palworld](https://github.com/BitsNBytes25/Palworld-Installer)
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

## AI / LLM Disclaimer

Warlock was originally generated with various models including GPT-5 and Claude Sonnet 4.5
via Copilot's integration feature.

Then it was effectively rewritten because generated code is absolutely rubbish and horribly unmaintainable.

After wasting a week just un-fraking the generated code, now we just use those AI models to generate tiny snippets of code throughout this project.
