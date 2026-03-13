const express = require('express');
const {validate_session} = require("../libs/validate_session.mjs");
const {injectHosts} = require("../libs/inject_hosts.mjs");
const {getAllApplications} = require("../libs/get_all_applications.mjs");
const {validateHostApplication} = require("../libs/validate_host_application.mjs");
const router = express.Router();

router.get(
	'/',
	validate_session,
	injectHosts,
	async (req, res) => {
		res.locals.apps = await getAllApplications();
		res.render('application_install');
	}
);

router.get(
	'/:guid/:host',
	validate_session,
	validateHostApplication,
	(req, res) => {
		res.render('application_install2', {});
	}
);

module.exports = router;