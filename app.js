/**
 * Represents the details of an application.
 *
 * @typedef {Object} AppData
 * @property {string} title Name of the application.
 * @property {string} guid Globally unique identifier of the application.
 * @property {string} icon Icon URL of the application.
 * @property {string} repo Repository URL fragment of the application.
 * @property {string} installer Installer URL fragment of the application.
 * @property {string} source Source handler for the application installer.
 * @property {string} thumbnail Thumbnail URL of the application.
 * @property {HostAppData[]} hosts List of hosts where the application is installed.
 * @property {string} image Full size image URL of the application.
 * @property {string} header Header image URL of the application.
 */

/**
 * Represents the details of a host specifically regarding an installed application.
 *
 * @typedef {Object} HostAppData
 * @property {string} host Hostname or IP of host.
 * @property {string} path Path where the application is installed on the host.
 *
 */

/**
 * Represents the details of a service.
 *
 * @typedef {Object} ServiceData
 * @property {string} name Name of the service, usually operator set for the instance/map name.
 * @property {string} service Service identifier registered in systemd.
 * @property {string} status Current status of the service, one of [running, stopped, starting, stopping].
 * @property {string} cpu_usage Current CPU usage of the service as a percentage or 'N/A'.
 * @property {string} memory_usage Current memory usage of the service in MB/GB or 'N/A'.
 * @property {number} game_pid Process ID of the game server process, or 0 if not running.
 * @property {number} service_pid Process ID of the service manager process, or 0 if not running.
 * @property {string} ip IP address the service is bound to.
 * @property {number} port Port number the service is using.
 * @property {number} player_count Current number of players connected to the service.
 * @property {number} max_players Maximum number of players allowed on the service.
 */

/**
 * Represents a configuration option for a given service or app
 *
 * @typedef {Object} AppConfigOption
 * @property {string} option Name of the configuration option.
 * @property {string|number|bool} value Current value of the configuration option.
 * @property {string|number|bool} default Default value of the configuration option.
 * @property {string} type Data type of the configuration option (str, int, bool, float, text).
 * @property {string} help Help text or description for the configuration option.
 */


const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
//const { exec } = require('child_process');
//const multer = require('multer');
//const fs = require('fs');
//const yaml = require('js-yaml');
//const NodeCacheStore = require('node-cache');
//const cache = new NodeCacheStore();

const app = express();
const PORT = process.env.PORT || 3077;
//const passport = require('passport');
//const LocalStrategy = require('passport-local');
//const {User} = require("./db");
//const csrf = require('csurf');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const {logger} = require("./libs/logger.mjs");
//const SQLiteStore = require('connect-sqlite3')(session);

// Load environment variables
dotenv.config();
//require('dotenv').config();



app.set('view engine', 'ejs')

app.use(cookieParser());

/*passport.use(new LocalStrategy(
    function(username, password, done) {
        User.findOne({ where: { username: username } }).then(user => {
            if (err) { return done(err); }
            if (!user) { return done(null, false, { message: 'Incorrect username.' }); }
            user.validatePassword(password).then(isValid => {
                if (!isValid) {
                    return done(null, false, { message: 'Incorrect password.' });
                }
                return done(null, user);
            });
        });
    }
));*/


app.use(session({
    secret: process.env.SESSION_SECRET || 'warlock_secret_key',
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
}));






/***************************************************************
 **               Common Functions
 ***************************************************************/


// @todo Make filePullRunner which uses process.spawn to receive a remote file in its entirety.
// Use tar on remote server and tar on local server to drop contents into a local /tmp file for reading.

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


/***************************************************************
 **               Application/UI Endpoints
 ***************************************************************/

app.use('/', require('./routes/index'));
app.use('/install', require('./routes/install'));
app.use('/files', require('./routes/files'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/login', require('./routes/login'));
app.use('/hosts', require('./routes/hosts'));
app.use('/host/add', require('./routes/host_add'));
app.use('/service/logs', require('./routes/service_logs'));
app.use('/service/configure', require('./routes/service_configure'));


/***************************************************************
 **                      API Endpoints
 ***************************************************************/

app.use('/api/applications', require('./routes/api/applications'));
app.use('/api/file', require('./routes/api/file'));
app.use('/api/files', require('./routes/api/files'));
app.use('/api/hosts', require('./routes/api/hosts'));
app.use('/api/services', require('./routes/api/services'));
app.use('/api/service', require('./routes/api/service'));
app.use('/api/service/logs', require('./routes/api/service_logs'));
app.use('/api/service/control', require('./routes/api/service_control'));
app.use('/api/service/configs', require('./routes/api/service_configs'));


/*// Rename file or folder endpoint
app.post('/rename-item', (req, res) => {
    const { oldPath, newPath, isDirectory } = req.body;
    
    if (!oldPath || !newPath) {
        return res.json({
            success: false,
            error: 'Old path and new path are required'
        });
    }
    
    logger.info('Renaming item:', oldPath, '->', newPath);
    
    // Use mv command to rename
    const renameCommand = buildSSHCommand(`mv "${oldPath}" "${newPath}" && echo "Renamed successfully"`);
    
    exec(renameCommand, (error, stdout, stderr) => {
        if (error) {
            logger.error('Rename error:', error);
            return res.json({
                success: false,
                error: `Cannot rename item: ${error.message}`
            });
        }
        
        if (stderr && stderr.trim()) {
            logger.error('Rename stderr:', stderr);
            return res.json({
                success: false,
                error: `Rename error: ${stderr.trim()}`
            });
        }
        
        logger.info('Item renamed successfully:', oldPath, '->', newPath);
        res.json({
            success: true,
            message: 'Item renamed successfully'
        });
    });
});*/



/*// Recursive file search endpoint
app.post('/search-files', (req, res) => {
    const { path, query } = req.body;
    
    if (!path || !query) {
        return res.json({
            success: false,
            error: 'Path and search query are required'
        });
    }
    
    logger.info('Searching for:', query, 'in path:', path);
    
    // Use find command to search recursively
    // -iname for case-insensitive search
    // -type f for files, -type d for directories
    // Use both to find files and folders
    // Exclude hidden files with ! -name ".*"
    const searchCommand = buildSSHCommand(`
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
    `);
    
    exec(searchCommand, (error, stdout, stderr) => {
        if (error) {
            logger.error('Search error:', error);
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
        
        logger.info(`Found ${results.length} results for "${query}"`);
        res.json({
            success: true,
            results: results,
            count: results.length
        });
    });
});*/

// Start the server
app.listen(PORT, () => {
    logger.info(`Listening on ${PORT}`);
});