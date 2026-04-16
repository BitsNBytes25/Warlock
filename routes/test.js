const express = require('express');
const { validate_session } = require('../libs/validate_session.mjs');
const router = express.Router();


router.get(
	'/terminal',
	validate_session,
	(req, res) => {
		return res.render('test_terminal');
	}
);

module.exports = router;
