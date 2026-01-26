const express = require('express');
const {validate_session} = require("../libs/validate_session.mjs");
const {validateHost} = require("../libs/validate_host.mjs");
const router = express.Router();

router.get('/:host', validate_session, (req, res) => {
	validateHost(req.params.host)
		.then(() => {
			res.render('host_details');
		})
		.catch(error => {
			res.status(404).send(`Host not found: ${error.message}`);
		});
});

module.exports = router;

