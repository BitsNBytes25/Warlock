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

const app = express();
const PORT = process.env.PORT || 3077;
const cookieParser = require('cookie-parser');
const session = require('express-session');
const {logger} = require("./libs/logger.mjs");
const {push_analytics} = require("./libs/push_analytics.mjs");
const {sequelize} = require("./db.js");

// Load environment variables
dotenv.config();


app.set('view engine', 'ejs')

app.use(cookieParser());

app.use(session({
    secret: process.env.SESSION_SECRET || 'warlock_secret_key',
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
}));


/***************************************************************
 **               Common Functions
 ***************************************************************/

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
app.use('/host/delete', require('./routes/host_delete'));
app.use('/host/firewall', require('./routes/host_firewall'));
app.use('/service/logs', require('./routes/service_logs'));
app.use('/service/configure', require('./routes/service_configure'));
app.use('/application/uninstall', require('./routes/application_uninstall'));
app.use('/application/install', require('./routes/application_install'));
app.use('/application/backups', require('./routes/application_backups'));
app.use('/application/configure', require('./routes/application_configure'));
app.use('/settings', require('./routes/settings'));


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
app.use('/api/application', require('./routes/api/application'));
app.use('/api/application/backup', require('./routes/api/application_backup'));
app.use('/api/application/configs', require('./routes/api/application_configs'));
app.use('/api/application/update', require('./routes/api/application_update'));
app.use('/api/quickpaths', require('./routes/api/quickpaths'));
app.use('/api/cron', require('./routes/api/cron'));
app.use('/api/users', require('./routes/api/users'));
app.use('/api/firewall', require('./routes/api/firewall'));
app.use('/api/ports', require('./routes/api/ports'));


// Start the server
app.listen(PORT, '127.0.0.1', () => {

    // Ensure the sqlite database is up to date with the schema.
    sequelize.sync({ alter: true }).then(() => {
        logger.info('Database synchronized');
    }).catch(err => {
        logger.error('Database synchronization error:', err);
    });

    logger.info(`Listening on ${PORT}`);

    // Send a tracking snippet to our analytics server so we can monitor basic usage.
    push_analytics('Start');
});
