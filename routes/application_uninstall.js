const express = require('express');
const {validate_session} = require("../libs/validate_session.mjs");
const {validateHostApplication} = require("../libs/validate_host_application.mjs");
const router = express.Router();

router.get(
	'/:guid/:host',
	validate_session,
	validateHostApplication,
	(req, res) => {
		res.render('application_uninstall', {});
	}
);

module.exports = router;