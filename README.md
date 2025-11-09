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

## Adding More Pages

To add more HTML pages:

1. Create new HTML files in the `public/` directory
2. Add corresponding routes in `app.js` if needed (optional for static files)
3. Update navigation links in existing HTML pages

Enjoy building with Express! 🚀