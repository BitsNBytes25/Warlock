const express = require('express');
const {validate_session} = require("../libs/validate_session.mjs");
const {injectHosts} = require("../libs/inject_hosts.mjs");
const {injectApps} = require("../libs/inject_apps.mjs");
const router = express.Router();

router.get('/', validate_session, injectHosts, injectApps, (req, res) => {
	res.render('dashboard');
});

module.exports = router;