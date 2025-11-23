const express = require('express');
const { validate_session } = require('../libs/validate_session.mjs');
const router = express.Router();

router.get('/', validate_session, (req, res) => {
	res.render('settings');
});

module.exports = router;

