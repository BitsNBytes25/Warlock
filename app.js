const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3077;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Monitor page route
app.get('/monitor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'monitor.html'));
});

// File browser page route
app.get('/files', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'files.html'));
});

// Game Server Command configurations
const commandConfigs = {
    'create-server': {
        command: (params) => {
            return `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py create_server --game=${params.game_type} --name="${params.server_name}" --max-players=${params.max_players} --size=${params.server_size}'`;
        },
        description: 'Create Game Server'
    },
    'server-control': {
        command: (params) => {
            const actions = {
                'start': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py start_server --server-id=${params.server_id}'`,
                'stop': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py stop_server --server-id=${params.server_id}'`,
                'restart': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py restart_server --server-id=${params.server_id}'`,
                'force-stop': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py force_stop_server --server-id=${params.server_id}'`
            };
            return actions[params.action] || actions['start'];
        },
        description: 'Server Control'
    },
    'server-config': {
        command: (params) => {
            if (params.config_content) {
                // Save config content to a temp file and upload it
                return `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py configure_server --server-id=${params.server_id} --config-type=${params.config_type} --config-data="${params.config_content}"'`;
            } else {
                return `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py get_server_config --server-id=${params.server_id} --config-type=${params.config_type}'`;
            }
        },
        description: 'Server Configuration'
    },
    'player-management': {
        command: (params) => {
            const actions = {
                'list_players': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py list_players --server-id=${params.server_id}'`,
                'kick_player': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py kick_player --server-id=${params.server_id} --player="${params.player_name}"'`,
                'ban_player': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py ban_player --server-id=${params.server_id} --player="${params.player_name}"'`,
                'unban_player': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py unban_player --server-id=${params.server_id} --player="${params.player_name}"'`,
                'list_bans': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py list_bans --server-id=${params.server_id}'`
            };
            return actions[params.action] || actions['list_players'];
        },
        description: 'Player Management'
    },
    'server-monitor': {
        command: (params) => {
            const monitors = {
                'performance': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py server_stats ${params.server_id !== 'all' ? '--server-id=' + params.server_id : '--all'}'`,
                'player_count': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py player_count ${params.server_id !== 'all' ? '--server-id=' + params.server_id : '--all'}'`,
                'resource_usage': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py resource_usage ${params.server_id !== 'all' ? '--server-id=' + params.server_id : '--all'}'`,
                'server_logs': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py server_logs ${params.server_id !== 'all' ? '--server-id=' + params.server_id : '--all'} --tail=50'`
            };
            return monitors[params.monitor_type] || monitors['performance'];
        },
        description: 'Server Monitoring'
    },
    'backup-restore': {
        command: (params) => {
            const actions = {
                'create_backup': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py create_backup --server-id=${params.server_id} ${params.backup_name ? '--name=' + params.backup_name : ''}'`,
                'restore_backup': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py restore_backup --server-id=${params.server_id} --backup-name=${params.backup_name}'`,
                'list_backups': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py list_backups --server-id=${params.server_id}'`,
                'delete_backup': `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py delete_backup --server-id=${params.server_id} --backup-name=${params.backup_name}'`
            };
            return actions[params.action] || actions['list_backups'];
        },
        description: 'Backup & Restore'
    }
};

// Generic command execution endpoint
function createCommandEndpoint(commandType) {
    return (req, res) => {
        const config = commandConfigs[commandType];
        if (!config) {
            return res.json({
                success: false,
                output: `Unknown command type: ${commandType}`,
                stderr: ''
            });
        }

        let command;
        if (typeof config.command === 'function') {
            command = config.command(req.body);
        } else {
            command = config.command;
        }
        
        console.log(`Executing ${config.description}:`, command);
        
        exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`${config.description} error:`, error);
                return res.json({
                    success: false,
                    command: command,
                    output: `Error: ${error.message}`,
                    stderr: stderr || ''
                });
            }
            
            res.json({
                success: true,
                command: command,
                output: stdout || 'Command executed successfully (no output)',
                stderr: stderr || ''
            });
        });
    };
}

// Create endpoints for each game server command type
app.post('/create-server', createCommandEndpoint('create-server'));
app.post('/server-control', createCommandEndpoint('server-control'));
app.post('/server-config', createCommandEndpoint('server-config'));
app.post('/player-management', createCommandEndpoint('player-management'));
app.post('/server-monitor', createCommandEndpoint('server-monitor'));
app.post('/backup-restore', createCommandEndpoint('backup-restore'));

// Get services endpoint
app.post('/get-services', (req, res) => {
    const sshCommand = "ssh root@45.26.230.248 '/home/steam/VEIN/manage.py --get-services'";
    
    console.log('Executing get-services command:', sshCommand);
    
    exec(sshCommand, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
            console.error('Get services error:', error);
            return res.json({
                success: false,
                error: error.message,
                output: stderr || stdout
            });
        }
        
        console.log('Services output:', stdout);
        
        res.json({
            success: true,
            output: stdout,
            stderr: stderr
        });
    });
});

// Get stats endpoint
app.post('/get-stats', (req, res) => {
    const serviceName = req.body.service || '';
    const sshCommand = serviceName 
        ? `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py --get-stats --service ${serviceName}'`
        : "ssh root@45.26.230.248 '/home/steam/VEIN/manage.py --get-stats'";
    
    console.log('Executing get-stats command:', sshCommand);
    
    exec(sshCommand, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
            console.error('Get stats error:', error);
            return res.json({
                success: false,
                error: error.message,
                output: stderr || stdout
            });
        }
        
        console.log('Stats output:', stdout);
        
        res.json({
            success: true,
            output: stdout,
            stderr: stderr
        });
    });
});

// Service control endpoint (start/stop/restart)
app.post('/service-action', (req, res) => {
    const { service, action } = req.body;
    
    if (!service || !action) {
        return res.json({
            success: false,
            error: 'Service name and action are required'
        });
    }
    
    const validActions = ['start', 'stop', 'restart'];
    if (!validActions.includes(action)) {
        return res.json({
            success: false,
            error: `Invalid action. Must be one of: ${validActions.join(', ')}`
        });
    }
    
    const sshCommand = `ssh root@45.26.230.248 '/home/steam/VEIN/manage.py --${action} --service ${service}'`;
    
    console.log(`Executing ${action} command for ${service}:`, sshCommand);
    
    exec(sshCommand, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
            console.error(`${action} error for ${service}:`, error);
            return res.json({
                success: false,
                error: error.message,
                output: stderr || stdout
            });
        }
        
        console.log(`${action} output for ${service}:`, stdout);
        
        res.json({
            success: true,
            output: stdout,
            stderr: stderr
        });
    });
});

// Legacy endpoint for backward compatibility
app.post('/run-ssh-command', (req, res) => {
    const sshCommand = "ssh root@45.26.230.248 '/home/steam/VEIN/manage.py --help'";
    
    console.log('Executing legacy SSH command:', sshCommand);
    
    exec(sshCommand, { timeout: 30000 }, (error, stdout, stderr) => {
        if (error) {
            console.error('SSH command error:', error);
            return res.json({
                success: false,
                command: sshCommand,
                output: `Error: ${error.message}`,
                stderr: stderr || ''
            });
        }
        
        res.json({
            success: true,
            command: sshCommand,
            output: stdout || 'Command executed successfully (no output)',
            stderr: stderr || ''
        });
    });
});

// Global variable to store htop process
let bpytopProcess = null;
let bpytopOutput = '';

// Start htop monitoring
app.post('/start-bpytop', (req, res) => {
    if (bpytopProcess) {
        return res.json({
            success: true,
            output: 'htop is already running'
        });
    }

    console.log('Starting system monitoring...');
    
    // Start continuous monitoring with system commands that work better for web display
    function updateSystemStats() {
        if (!bpytopProcess) return; // Stop if monitoring was stopped
        
        const monitorCommand = `ssh root@45.26.230.248 '
echo "=== WARLOCK SYSTEM MONITOR ==="
echo "Timestamp: $(date)"
echo ""
echo "=== CPU INFORMATION ==="
lscpu | grep -E "Model name|CPU MHz|CPU\\(s\\):"
echo ""
echo "=== MEMORY USAGE ==="
free -h
echo ""
echo "=== DISK USAGE ==="
df -h | head -10
echo ""
echo "=== LOAD AVERAGE ==="
uptime
echo ""
echo "=== TOP PROCESSES (CPU) ==="
ps aux --sort=-%cpu | head -10
echo ""
echo "=== TOP PROCESSES (MEMORY) ==="
ps aux --sort=-%mem | head -10
echo ""
echo "=== NETWORK INTERFACES ==="
ip addr show | grep -E "inet |UP|DOWN" | head -10
echo ""
echo "=== ACTIVE CONNECTIONS ==="
ss -tuln | head -10
        '`;
        
        exec(monitorCommand, (error, stdout, stderr) => {
            if (error) {
                console.error('Monitor command error:', error);
                bpytopOutput = `Error retrieving system stats: ${error.message}\n`;
                return;
            }
            
            bpytopOutput = stdout;
        });
    }
    
    // Mark as running and start periodic updates
    bpytopProcess = { active: true }; // Simple object to track if monitoring is active
    bpytopOutput = 'Initializing system monitoring...\n';
    
    // Update immediately, then every 3 seconds
    updateSystemStats();
    const monitorInterval = setInterval(updateSystemStats, 3000);
    
    // Store interval ID so we can clear it later
    bpytopProcess.intervalId = monitorInterval;
    
    res.json({
        success: true,
        output: 'System monitoring started successfully'
    });
});

// Get current htop output
app.get('/bpytop-output', (req, res) => {
    res.json({
        success: true,
        output: bpytopOutput,
        isRunning: bpytopProcess !== null
    });
});

// Stop system monitoring
app.post('/stop-bpytop', (req, res) => {
    if (bpytopProcess) {
        if (bpytopProcess.intervalId) {
            clearInterval(bpytopProcess.intervalId);
        }
        bpytopProcess = null;
        bpytopOutput = 'System monitoring stopped.\n';
    }
    
    res.json({
        success: true,
        output: 'System monitoring stopped'
    });
});

// File browser endpoints
app.post('/browse-files', (req, res) => {
    const { path: requestedPath } = req.body;
    
    if (!requestedPath) {
        return res.json({
            success: false,
            error: 'Path is required'
        });
    }
    
    console.log('Browsing directory:', requestedPath);
    
    // Use ls with detailed output to get file information
    // -la shows all details including symlinks
    const browseCommand = `ssh root@45.26.230.248 'ls -la "${requestedPath}" 2>/dev/null | tail -n +2'`;
    
    exec(browseCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Browse command error:', error);
            return res.json({
                success: false,
                error: error.message
            });
        }
        
        try {
            const files = [];
            const lines = stdout.trim().split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 9) {
                    const permissions = parts[0];
                    const size = parseInt(parts[4]) || 0;
                    
                    // Handle symlinks - they have " -> " in the name
                    const fullNamePart = parts.slice(8).join(' ');
                    let name = fullNamePart;
                    let symlinkTarget = null;
                    let isSymlink = permissions.startsWith('l');
                    
                    if (isSymlink && fullNamePart.includes(' -> ')) {
                        const symlinkParts = fullNamePart.split(' -> ');
                        name = symlinkParts[0];
                        symlinkTarget = symlinkParts[1];
                    }
                    
                    // Skip . and .. entries
                    if (name === '.' || name === '..') continue;
                    
                    // Skip hidden files (starting with .)
                    if (name.startsWith('.')) continue;
                    
                    const isDirectory = permissions.startsWith('d');
                    const fullPath = requestedPath.endsWith('/') ? 
                        `${requestedPath}${name}` : 
                        `${requestedPath}/${name}`;
                    
                    // Determine actual type for symlinks
                    let fileType = 'file';
                    if (isSymlink) {
                        fileType = 'symlink';
                    } else if (isDirectory) {
                        fileType = 'directory';
                    }
                    
                    files.push({
                        name: name,
                        type: fileType,
                        size: isDirectory ? null : size,
                        permissions: permissions,
                        path: fullPath,
                        symlinkTarget: symlinkTarget
                    });
                }
            }
            
            res.json({
                success: true,
                files: files,
                path: requestedPath
            });
            
        } catch (parseError) {
            console.error('Parse error:', parseError);
            res.json({
                success: false,
                error: 'Failed to parse directory listing'
            });
        }
    });
});

// File viewing endpoint
app.post('/view-file', (req, res) => {
    const { path: filePath } = req.body;
    
    if (!filePath) {
        return res.json({
            success: false,
            error: 'File path is required'
        });
    }
    
    console.log('Viewing file:', filePath);
    
    // First check if it's a text file and get its size
    const fileInfoCommand = `ssh root@45.26.230.248 'file "${filePath}" && stat -c%s "${filePath}" 2>/dev/null'`;
    
    exec(fileInfoCommand, (error, stdout, stderr) => {
        if (error) {
            return res.json({
                success: false,
                error: 'Cannot access file'
            });
        }
        
        const lines = stdout.trim().split('\n');
        const fileType = lines[0] || '';
        const fileSize = parseInt(lines[1]) || 0;
        
        // Check if file is too large (limit to 1MB for preview)
        if (fileSize > 1024 * 1024) {
            return res.json({
                success: false,
                error: 'File is too large to preview (>1MB). Use head or tail commands instead.'
            });
        }
        
        // Check if file appears to be binary (but allow Python script files)
        const isPythonScript = fileType.includes('Python script') || fileType.includes('python');
        if (!isPythonScript && (fileType.includes('binary') || fileType.includes('executable'))) {
            return res.json({
                success: false,
                error: 'Binary files cannot be previewed'
            });
        }
        
        // Read the file content
        const readCommand = `ssh root@45.26.230.248 'cat "${filePath}" 2>/dev/null'`;
        
        exec(readCommand, { maxBuffer: 1024 * 1024 * 2 }, (readError, readStdout, readStderr) => {
            if (readError) {
                return res.json({
                    success: false,
                    error: 'Cannot read file content'
                });
            }
            
            res.json({
                success: true,
                content: readStdout,
                fileType: fileType,
                fileSize: fileSize
            });
        });
    });
});

// Image viewing endpoint - returns base64 encoded image
app.post('/view-image', (req, res) => {
    const { path: filePath } = req.body;
    
    if (!filePath) {
        return res.json({
            success: false,
            error: 'File path is required'
        });
    }
    
    console.log('Viewing image:', filePath);
    
    // Check file size first
    const sizeCommand = `ssh root@45.26.230.248 'stat -c%s "${filePath}" 2>/dev/null'`;
    
    exec(sizeCommand, (error, stdout) => {
        if (error) {
            return res.json({
                success: false,
                error: 'Cannot access image file'
            });
        }
        
        const fileSize = parseInt(stdout.trim()) || 0;
        
        // Limit image size to 10MB
        if (fileSize > 10 * 1024 * 1024) {
            return res.json({
                success: false,
                error: 'Image is too large to preview (>10MB)'
            });
        }
        
        // Read the image as base64
        const readCommand = `ssh root@45.26.230.248 'base64 "${filePath}" 2>/dev/null'`;
        
        exec(readCommand, { maxBuffer: 15 * 1024 * 1024 }, (readError, readStdout) => {
            if (readError) {
                return res.json({
                    success: false,
                    error: 'Cannot read image file'
                });
            }
            
            // Determine mime type from file extension
            const ext = filePath.split('.').pop().toLowerCase();
            const mimeTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'webp': 'image/webp',
                'bmp': 'image/bmp',
                'svg': 'image/svg+xml',
                'ico': 'image/x-icon'
            };
            
            const mimeType = mimeTypes[ext] || 'image/jpeg';
            
            res.json({
                success: true,
                image: readStdout.trim(),
                mimeType: mimeType,
                fileSize: fileSize
            });
        });
    });
});

// Enhanced system monitoring endpoint
app.post('/enhanced-monitor', (req, res) => {
    console.log('Getting enhanced system stats...');
    
    const monitorCommand = `ssh root@45.26.230.248 '
echo "SYSTEM_STATS_START"

echo "CPU_USAGE:"
top -bn1 | grep "Cpu(s)" | sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | awk "{print 100 - \\$1}" | head -1

echo "MEMORY_STATS:"
free | grep "^Mem:" | tr -s " " | cut -d" " -f3,2

echo "STORAGE_STATS:"
df -h / | tail -1 | awk "{print \\$3, \\$4, \\$5}"

echo "LOAD_AVERAGE:"
uptime | awk -F"load average:" "{print \\$2}" | sed "s/^[[:space:]]*//" | sed "s/[[:space:]]*$//"

echo "CPU_INFO:"
nproc

echo "NETWORK_STATS:"
cat /proc/net/dev | grep -v "lo:" | awk "NR>2 {rx+=\\$2; tx+=\\$10} END {print rx, tx}"

echo "CONNECTIONS:"
ss -tuln | wc -l

echo "TOP_CPU_PROCESSES:"
ps aux --sort=-%cpu | head -6 | tail -5 | awk "{print \\$11, \\$3}"

echo "TOP_MEMORY_PROCESSES:"
ps aux --sort=-%mem | head -6 | tail -5 | awk "{print \\$11, \\$4}"

echo "SYSTEM_STATS_END"
    '`;
    
    exec(monitorCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Enhanced monitor error:', error);
            return res.json({
                success: false,
                error: error.message
            });
        }
        
        try {
            const lines = stdout.trim().split('\n');
            const stats = {};
            let currentSection = '';
            
            lines.forEach(line => {
                line = line.trim();
                if (line.endsWith(':')) {
                    currentSection = line.slice(0, -1);
                    stats[currentSection] = [];
                } else if (line && currentSection) {
                    stats[currentSection].push(line);
                }
            });
            
            res.json({
                success: true,
                stats: stats
            });
        } catch (parseError) {
            console.error('Parse error:', parseError);
            res.json({
                success: false,
                error: 'Failed to parse system stats'
            });
        }
    });
});

// Create folder endpoint
app.post('/create-folder', (req, res) => {
    const { path: folderPath } = req.body;
    
    if (!folderPath) {
        return res.json({
            success: false,
            error: 'Folder path is required'
        });
    }
    
    console.log('Creating folder:', folderPath);
    
    const createCommand = `ssh root@45.26.230.248 'mkdir -p "${folderPath}" && echo "Folder created successfully"'`;
    
    exec(createCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Create folder error:', error);
            return res.json({
                success: false,
                error: `Cannot create folder: ${error.message}`
            });
        }
        
        if (stderr && stderr.trim()) {
            console.error('Create folder stderr:', stderr);
            return res.json({
                success: false,
                error: `Create error: ${stderr.trim()}`
            });
        }
        
        console.log('Folder created successfully:', folderPath);
        res.json({
            success: true,
            message: 'Folder created successfully'
        });
    });
});

// Recursive file search endpoint
app.post('/search-files', (req, res) => {
    const { path, query } = req.body;
    
    if (!path || !query) {
        return res.json({
            success: false,
            error: 'Path and search query are required'
        });
    }
    
    console.log('Searching for:', query, 'in path:', path);
    
    // Use find command to search recursively
    // -iname for case-insensitive search
    // -type f for files, -type d for directories
    // Use both to find files and folders
    // Exclude hidden files with ! -name ".*"
    const searchCommand = `ssh root@45.26.230.248 '
        cd "${path}" 2>/dev/null || exit 1
        find . -maxdepth 10 \\( -type f -o -type d \\) ! -name ".*" -iname "*${query}*" 2>/dev/null | while read item; do
            fullpath="${path}/\${item#./}"
            if [ -d "$fullpath" ]; then
                echo "DIR|\$fullpath|\$(basename "$fullpath")"
            else
                size=\$(stat -c %s "$fullpath" 2>/dev/null || echo 0)
                echo "FILE|\$fullpath|\$(basename "$fullpath")|\$size"
            fi
        done | head -100
    '`;
    
    exec(searchCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Search error:', error);
            return res.json({
                success: false,
                error: `Search failed: ${error.message}`
            });
        }
        
        const results = [];
        const lines = stdout.trim().split('\n').filter(line => line);
        
        lines.forEach(line => {
            const parts = line.split('|');
            if (parts.length >= 3) {
                const type = parts[0] === 'DIR' ? 'directory' : 'file';
                const path = parts[1];
                const name = parts[2];
                const size = parts[3] ? parseInt(parts[3]) : 0;
                
                results.push({
                    type: type,
                    path: path,
                    name: name,
                    size: size,
                    permissions: '-'
                });
            }
        });
        
        console.log(`Found ${results.length} results for "${query}"`);
        res.json({
            success: true,
            results: results,
            count: results.length
        });
    });
});

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/tmp/');
    },
    filename: (req, file, cb) => {
        cb(null, `warlock_upload_${Date.now()}_${file.originalname}`);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Upload file endpoint
app.post('/upload-file', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.json({
            success: false,
            error: 'No file uploaded'
        });
    }
    
    const targetPath = req.body.path;
    const targetFile = `${targetPath}/${req.file.originalname}`;
    const tempFile = req.file.path;
    
    console.log('Uploading file:', req.file.originalname, 'to:', targetFile);
    
    // Transfer file to remote server
    const uploadCommand = `scp "${tempFile}" root@45.26.230.248:"${targetFile}" && rm -f "${tempFile}"`;
    
    exec(uploadCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Upload file error:', error);
            // Clean up temp file
            exec(`rm -f "${tempFile}"`, () => {});
            return res.json({
                success: false,
                error: `Cannot upload file: ${error.message}`
            });
        }
        
        console.log('File uploaded successfully:', targetFile);
        res.json({
            success: true,
            message: 'File uploaded successfully'
        });
    });
});

// Save file endpoint
app.post('/save-file', (req, res) => {
    const { path: filePath, content } = req.body;
    
    if (!filePath || content === undefined) {
        return res.json({
            success: false,
            error: 'File path and content are required'
        });
    }
    
    console.log('Saving file:', filePath);
    
    // Create a temporary file on the server with the content and then move it
    const tempFile = `/tmp/warlock_edit_${Date.now()}.tmp`;
    
    // Write content to temp file, then move it to the target location
    const saveCommand = `ssh root@45.26.230.248 '
        cat > "${tempFile}" << '\''EOF'\''
${content}
EOF
        if [ $? -eq 0 ]; then
            cp "${tempFile}" "${filePath}"
            rm -f "${tempFile}"
            echo "File saved successfully"
        else
            rm -f "${tempFile}"
            echo "Failed to write temporary file"
            exit 1
        fi
    '`;
    
    exec(saveCommand, { maxBuffer: 1024 * 1024 * 5 }, (error, stdout, stderr) => {
        if (error) {
            console.error('Save file error:', error);
            return res.json({
                success: false,
                error: `Cannot save file: ${error.message}`
            });
        }
        
        if (stderr && stderr.trim()) {
            console.error('Save file stderr:', stderr);
            return res.json({
                success: false,
                error: `Save error: ${stderr.trim()}`
            });
        }
        
        console.log('File saved successfully:', filePath);
        res.json({
            success: true,
            message: 'File saved successfully'
        });
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});