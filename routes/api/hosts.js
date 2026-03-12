const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {injectHosts} = require("../../libs/inject_hosts.mjs");

const router = express.Router();

/**
 * API endpoint to get all enabled hosts and their general information
 */
router.get('/', validate_session, injectHosts, (req, res) => {
	return res.json({
		success: true,
		hosts: res.locals.hosts
	});
});

module.exports = router;
