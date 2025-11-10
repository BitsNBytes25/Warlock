# Warlock - Remote Server Management System

## Architecture Overview
Warlock is an Express.js web application that provides remote management for game servers via SSH. The system consists of a Node.js backend (`app.js`) serving static HTML files with embedded JavaScript frontends that communicate with a remote Linux server at `root@45.26.230.248`.

## Key Components

### Backend Structure (`app.js`)
- **Express Server**: Runs on port 3077 (configurable via `PORT` env var)
- **SSH Command Execution**: All server operations use SSH to execute commands on remote server
- **Game Server Management**: Uses `/home/steam/VEIN/manage.py` script on remote server for game operations
- **Real-time Monitoring**: System stats fetched via custom SSH commands to remote server

### Frontend Architecture (`public/`)
- **Self-contained HTML files**: Each page has embedded CSS and JavaScript
- **Real-time Updates**: Uses `setInterval` for periodic API calls (3-second intervals)
- **Terminal-style UI**: Cyberpunk aesthetic with blue/teal color scheme
- **API Communication**: Fetch-based requests to backend endpoints

## Critical API Endpoints

### System Monitoring
- `POST /enhanced-monitor`: Real-time system stats (CPU, memory, storage, processes)
- `POST /start-bpytop` / `GET /bpytop-output` / `POST /stop-bpytop`: Terminal monitoring via bpytop

### Game Server Management
- `POST /create-server`: Create new game server instances
- `POST /server-control`: Start/stop/restart servers (requires `server_id` and `action`)
- `POST /server-config`: Modify server configurations
- `POST /player-management`: Handle player operations
- `POST /backup-restore`: Server backup and restore operations

### File Management
- `POST /browse-files`: Directory listing with path navigation
- `POST /view-file`: File content viewing
- `POST /create-folder`: Directory creation
- File upload via multer middleware

## Development Workflow

### Running the Application
```bash
npm run dev    # Development with nodemon
npm start      # Production
```

### Key Dependencies
- **express**: Web framework
- **multer**: File upload handling
- **nodemon**: Development auto-restart

### Remote Server Dependencies
The remote server must have:
- SSH access configured for root user
- `/home/steam/VEIN/manage.py` script for game server management
- Standard Unix utilities (ps, df, free, top, etc.) for system monitoring

## Project-Specific Patterns

### SSH Command Structure
All remote operations follow this pattern:
```javascript
const command = `ssh root@45.26.230.248 'command_here'`;
exec(command, callback);
```

### Error Handling Convention
API responses use consistent structure:
```javascript
{ success: boolean, error?: string, data?: any }
```

### Frontend Update Pattern
Real-time components follow this pattern:
```javascript
async function fetchData() { /* API call */ }
setInterval(fetchData, 3000);  // 3-second updates
```

### CSS Architecture
- Embedded styles in each HTML file
- Consistent color scheme: `#0096ff` (primary blue), `#1a1a2e` (dark background)
- Orbitron font for headers, Rajdhani for body text
- Grid layouts with responsive cards

## Integration Points

### Remote Server Communication
- **SSH Key Authentication**: Assumes passwordless SSH to root@45.26.230.248
- **Game Management Script**: `/home/steam/VEIN/manage.py` handles all server lifecycle
- **System Monitoring**: Custom shell commands for real-time stats collection

### File System Operations
- Upload directory: Server handles file storage location
- File browsing: Recursive directory navigation via SSH commands
- File viewing: Direct file content retrieval via SSH

## Common Operations

### Adding New API Endpoints
1. Define command in `commandConfigs` object if SSH-based
2. Use `createCommandEndpoint(commandName)` for standard SSH operations
3. Add manual endpoint for custom logic requiring special handling

### Adding New Frontend Pages
1. Create HTML file in `public/` directory
2. Add route in `app.js`: `app.get('/page', (req, res) => res.sendFile(...))`
3. Follow established CSS/JS patterns for consistency
4. Add navigation link in existing pages' header menu

### Debugging Remote Operations
- SSH commands logged to console during execution
- Monitor terminal output in browser for real-time feedback
- Check remote server logs: `/home/steam/VEIN/logs/` (if applicable)