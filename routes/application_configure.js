const express = require('express');
const {validate_session} = require("../libs/validate_session.mjs");
const router = express.Router();

router.get('/:guid/:host', validate_session, (req, res) => {
	res.render('application_configure');
});

module.exports = router;