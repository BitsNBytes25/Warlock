const express = require('express');
const {validate_session} = require("../libs/validate_session.mjs");
const {validateHost} = require("../libs/validate_host.mjs");
const router = express.Router();

router.get('/:host', validate_session, validateHost, (req, res) => {
	res.render('host_details');
});

module.exports = router;

