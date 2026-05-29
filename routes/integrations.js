const express = require('express');
const { validate_session } = require('../libs/validate_session.mjs');
const router = express.Router();
const { getBotConfig } = require('../libs/bot_manager.js');

router.get('/', validate_session, async (req, res) => {
    try {
        const config = await getBotConfig();
        
        res.render('integrations', {
            config: config
        });
    } catch (e) {
        console.error(e);
        res.status(500).send('Error loading integrations');
    }
});

module.exports = router;
