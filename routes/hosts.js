const express = require('express');
const {validate_session} = require("../libs/validate_session.mjs");
const {injectHosts} = require("../libs/inject_hosts.mjs");
const router = express.Router();

router.get(
	'/',
	validate_session,
	injectHosts,
	(req, res) => {
		res.render('hosts');
	}
);

module.exports = router;