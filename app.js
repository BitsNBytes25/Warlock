const express = require('express');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3077;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Route to serve the main HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Additional route example
app.get('/about', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'about.html'));
});

// Monitor page route
app.get('/monitor', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'monitor.html'));
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});