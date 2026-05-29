const { spawn } = require('child_process');
const path = require('path');
const { logger } = require('./logger.mjs');
const { Meta } = require('../db.js');

let botProcess = null;

async function getBotConfig() {
    const keys = [
        'BOT_ENABLED',
        'DISCORD_TOKEN',
        'DISCORD_STATUS_CHANNEL_ID',
        'DISCORD_ADMIN_ROLE_ID',
        'FLUXER_TOKEN',
        'STATUS_CHANNEL_ID',
        'ADMIN_ROLE_ID'
    ];
    
    const config = {};
    for (const key of keys) {
        const row = await Meta.findOne({ where: { key } });
        if (row && row.value) {
            config[key] = row.value;
        }
    }
    
    // Default to true if not set
    if (!config.BOT_ENABLED || config.BOT_ENABLED !== '0') {
        config.BOT_ENABLED = '1';
    }
    return config;
}

async function startBot() {
    try {
        const config = await getBotConfig();
        
        if (config.BOT_ENABLED === '0') {
            logger.info('[BotManager] Bot is disabled in settings. Not starting.');
            return;
        }

        if (botProcess) {
            logger.info('[BotManager] Bot is already running.');
            return;
        }

        logger.info('[BotManager] Starting Warlock-Game-Server-Bot process...');
        
        const env = {
            ...process.env, // inherit Warlock's env (WARLOCK_API_URL etc if present, though we might want to default to localhost)
            WARLOCK_API_URL: process.env.WARLOCK_API_URL || `http://127.0.0.1:${process.env.PORT || 3077}`,
            // We use the admin token if it exists, otherwise the bot will login
            WARLOCK_API_TOKEN: process.env.WARLOCK_API_TOKEN || '',
            WARLOCK_TARGET_HOST: process.env.WARLOCK_TARGET_HOST || 'local',
            WARLOCK_USERNAME: 'admin', // The bot needs creds if no token
            WARLOCK_PASSWORD: process.env.ADMIN_PASSWORD || 'admin',
        };

        // Inject db configuration
        if (config.DISCORD_TOKEN) env.DISCORD_TOKEN = config.DISCORD_TOKEN;
        if (config.DISCORD_STATUS_CHANNEL_ID) env.DISCORD_STATUS_CHANNEL_ID = config.DISCORD_STATUS_CHANNEL_ID;
        if (config.DISCORD_ADMIN_ROLE_ID) env.DISCORD_ADMIN_ROLE_ID = config.DISCORD_ADMIN_ROLE_ID;
        if (config.FLUXER_TOKEN) env.FLUXER_TOKEN = config.FLUXER_TOKEN;
        if (config.STATUS_CHANNEL_ID) env.STATUS_CHANNEL_ID = config.STATUS_CHANNEL_ID;
        if (config.ADMIN_ROLE_ID) env.ADMIN_ROLE_ID = config.ADMIN_ROLE_ID;

        const botDir = path.join(__dirname, 'warlock-bot');
        const scriptPath = path.join(botDir, 'dist', 'index.js');

        botProcess = spawn('node', [scriptPath], {
            cwd: botDir,
            env: env,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        botProcess.stdout.on('data', (data) => {
            const line = data.toString().trim();
            if (line) logger.info(`[Bot] ${line}`);
        });

        botProcess.stderr.on('data', (data) => {
            const line = data.toString().trim();
            if (line) logger.error(`[Bot Error] ${line}`);
        });

        botProcess.on('close', (code) => {
            logger.info(`[BotManager] Bot process exited with code ${code}`);
            botProcess = null;
        });

    } catch (e) {
        logger.error(`[BotManager] Failed to start bot: ${e.message}`);
    }
}

function stopBot() {
    if (botProcess) {
        logger.info('[BotManager] Stopping bot process...');
        botProcess.kill('SIGTERM');
        botProcess = null;
    }
}

async function restartBot() {
    logger.info('[BotManager] Restarting bot process due to configuration changes...');
    stopBot();
    
    // Give it a second to shutdown gracefully
    setTimeout(() => {
        startBot();
    }, 1500);
}

module.exports = {
    startBot,
    stopBot,
    restartBot,
    getBotConfig
};
