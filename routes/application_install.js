const express = require('express');
const {validate_session} = require("../libs/validate_session.mjs");
const router = express.Router();

router.get('/', validate_session, (req, res) => {
	res.render('application_install', {});
});

router.get('/:guid/:host', validate_session, (req, res) => {
	res.render('application_install2', {});
});

module.exports = router;