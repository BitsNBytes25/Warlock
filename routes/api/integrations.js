const express = require('express');
const { validate_session } = require('../../libs/validate_session.mjs');
const { Meta } = require('../../db.js');
const { restartBot } = require('../../libs/bot_manager.js');

const router = express.Router();

router.post('/save', validate_session, async (req, res) => {
    try {
        const keys = [
            'BOT_ENABLED',
            'DISCORD_TOKEN',
            'DISCORD_STATUS_CHANNEL_ID',
            'DISCORD_ADMIN_ROLE_ID',
            'FLUXER_TOKEN',
            'STATUS_CHANNEL_ID',
            'ADMIN_ROLE_ID'
        ];

        for (const key of keys) {
            let value = req.body[key];
            if (value !== undefined) {
                // Upsert into Meta table
                const [meta, created] = await Meta.findOrCreate({
                    where: { key: key },
                    defaults: { value: value }
                });
                
                if (!created) {
                    await meta.update({ value: value });
                }
            }
        }

        // Restart bot process with new configuration
        restartBot();

        res.json({ success: true, message: 'Integrations settings saved and bot restarting.' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    }
});

module.exports = router;
