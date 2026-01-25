const express = require('express');
const {validate_session} = require("../libs/validate_session.mjs");
const {validateHostService} = require("../libs/validate_host_service.mjs");
const router = express.Router();

router.get('/:guid/:host/:service', validate_session, (req, res) => {
	validateHostService(req.params.host, req.params.guid, req.params.service)
		.then(() => {
			res.render('service_details');
		})
		.catch(error => {
			res.status(404).send(`Service not found: ${error.message}`);
		});
});

module.exports = router;