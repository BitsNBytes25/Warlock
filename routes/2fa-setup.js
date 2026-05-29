const express = require('express');
const {UserModel} = require("../db/models/user.mjs");
const csrf = require('@dr.pogodin/csurf');
const bodyParser = require('body-parser');
const {validate_session} = require("../libs/validate_session.mjs");

const router = express.Router();
const csrfProtection = csrf({ cookie: true });
const parseForm = bodyParser.urlencoded({ extended: false });
const twofactor = require("node-2fa");


router.get('/', validate_session, csrfProtection, (req, res) => {
	res.locals.csrfToken = req.csrfToken();

	if (!(req.session && req.session.setup_2fa)) {
		// Generate a new 2FA secret and QR code here, store in session to be saved upon successful form submission.
		req.session.setup_2fa = twofactor.generateSecret({ name: "Warlock", account: req.user.id }).secret;
	}

	res.locals.secret_2fa = req.session.setup_2fa;
	res.locals.hostname = req.hostname;

	res.render('2fa-setup');
});

router.post('/', validate_session, parseForm, csrfProtection, (req, res) => {
	const {authcode} = req.body;

	if (!(req.session && req.session.setup_2fa)) {
		// Generate a new 2FA secret and QR code here, store in session to be saved upon successful form submission.
		res.redirect('/2fa-setup');
		return;
	}

	res.locals.csrfToken = req.csrfToken();
	res.locals.secret_2fa = req.session.setup_2fa;
	res.locals.hostname = req.hostname;

	if ( !authcode ) {
		return res.render('2fa-setup', {error: 'Please enter your 2FA code!'});
	}

	const verification = twofactor.verifyToken(req.session.setup_2fa, authcode);
	if (!verification || verification.delta !== 0) {
		return res.render('2fa-setup', {error: 'Invalid 2FA code. Please try again.'});
	}

	// Save the secret to the user's account
	UserModel.findByPk(req.user.id).then((user) => {
		if (!user) {
			res.redirect('/login');
			return;
		}
		user.secret_2fa = req.session.setup_2fa;
		user.save().then(() => {
			// Clear the setup_2fa from session and store that 2FA is authenticated
			delete req.session.setup_2fa;
			req.session.twofa_authenticated = true;

			// Redirect to dashboard
			res.redirect('/dashboard');
		}).catch((err) => {
			console.error('Error saving 2FA secret:', err);
			res.render('2fa-setup', {error: 'Error saving 2FA settings. Please try again.'});
		});
	});
});

module.exports = router;