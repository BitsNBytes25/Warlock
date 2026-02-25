const express = require('express');
const {User} = require("../db");
const {validate_session} = require("../libs/validate_session.mjs");
const router = express.Router();

router.get('/', validate_session, (req, res) => {
	res.redirect('/dashboard');
});

module.exports = router;