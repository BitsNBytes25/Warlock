const express = require('express');
const {validate_session} = require("../libs/validate_session.mjs");
const {validateHostService} = require("../libs/validate_host_service.mjs");
const router = express.Router();

router.get('/:guid/:host/:service', validate_session, validateHostService, (req, res) => {
	return res.render('service_logs');
});

module.exports = router;