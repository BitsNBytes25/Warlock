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
 * @property {AppInstallData[]} installs List of hosts where the application is installed.
 * @property {string} image Full size image URL of the application.
 * @property {string} header Header image URL of the application.
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
const packageJson = require('./package.json');
const fs = require('fs');

const app = express();
const cookieParser = require('cookie-parser');
const session = require('express-session');
const {logger} = require("./libs/logger.mjs");
const {push_analytics} = require("./libs/push_analytics.mjs");
const {sequelize} = require("./db.js");
const {MetricsPollTask} = require("./tasks/metrics_poll.mjs");
const {MetricsMergeTask} = require("./tasks/metrics_merge.mjs");
const {HostMetricsMergeTask} = require("./tasks/host_metrics_merge.mjs");
const {HostMetricsPollTask} = require("./tasks/host_metrics_poll.mjs");
const {initializeProfiler, isEnabled: isProfilerEnabled} = require("./libs/cmd_profiler.mjs");

// Load environment variables
dotenv.config();

// Initialize profiler if enabled
initializeProfiler();
if (isProfilerEnabled()) {
	logger.info('Command profiler enabled - metrics will be written to warlock-profile.csv');
}


app.set('view engine', 'ejs')

// Expose app version for cache busting
app.locals.appVersion = packageJson.version;

// Helper function for versioned asset URLs (cache busting)
app.locals.assetUrl = function(assetPath) {
	return `${assetPath}?v=${packageJson.version}`;
}

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
app.use('/host/details', require('./routes/host_details'));
app.use('/service/logs', require('./routes/service_logs'));
app.use('/service/configure', require('./routes/service_configure'));
app.use('/service/details', require('./routes/service_details'));
app.use('/application/uninstall', require('./routes/application_uninstall'));
app.use('/application/install', require('./routes/application_install'));
app.use('/application/backups', require('./routes/application_backups'));
app.use('/application/configure', require('./routes/application_configure'));
app.use('/settings', require('./routes/settings'));
app.use('/2fa-setup', require('./routes/2fa-setup'));


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
app.use('/api/service/cmd', require('./routes/api/service_cmd'));
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
app.use('/api/metrics', require('./routes/api/metrics'));


const PORT = process.env.PORT || 3077;
const HOST = process.env.IP || '127.0.0.1';
const SKIP_AUTOMATIONS = process.env.SKIP_AUTOMATIONS === '1';

// Start the server
app.listen(PORT, HOST, () => {
	if (fs.existsSync('/.dockerenv')) {
		// If running in Docker, check to make sure we're not listening on 127.0.0.1/localhost.
		// Doing so inside a container is pointless, as it won't be accessible from outside.
		if (HOST === '127.0.0.1' || HOST === 'localhost') {
			logger.warn(`Warlock is listening on ${HOST}:${PORT} ONLY - this will probably not work how you think it will.`);
			logger.warn('Recommended setting IP=0.0.0.0 instead.');
		}
		else {
			logger.info(`Running in Docker and listening on ${HOST} port ${PORT}`);
		}
	}
	else {
		logger.info(`Listening on ${HOST} port ${PORT}`);
	}

	if (!SKIP_AUTOMATIONS) {
		// Sequelize doesn't handle cleaning up _backup tables all the time, so manually check if there are any.
		sequelize.showAllSchemas().then(res => {
			let dropPromises = [];
			res.forEach(schema => {
				if (schema.name && schema.name.endsWith('_backup')) {
					const tableName = schema.name;
					logger.info(`Dropping leftover backup table: ${tableName}`);
					dropPromises.push(sequelize.getQueryInterface().dropTable(tableName));
				}
			});

			Promise.allSettled(dropPromises).then(() => {
				// Ensure the sqlite database is up to date with the schema.
				sequelize.sync({ alter: true }).then(() => {
					logger.info('Initialized database connection and synchronized schema.');

					// Send a tracking snippet to our analytics server so we can monitor basic usage.
					push_analytics('Start');

					MetricsPollTask();
					setInterval(MetricsPollTask, 60000); // Run every 60 seconds

					HostMetricsPollTask();
					setInterval(HostMetricsPollTask, 60000); // Run every 60 seconds

					MetricsMergeTask();
					setInterval(MetricsMergeTask, 3600000); // Run every hour

					HostMetricsMergeTask();
					setInterval(HostMetricsMergeTask, 3600000); // Run every hour
				});
			});
		});
	}
});
