const express = require('express');
const {UserModel} = require("../db/models/user.mjs");
const csrf = require('@dr.pogodin/csurf');
const bodyParser = require('body-parser');
const twofactor = require("node-2fa");

const router = express.Router();
const csrfProtection = csrf({ cookie: true });
const parseForm = bodyParser.urlencoded({ extended: false });

router.get('/', csrfProtection, (req, res) => {
	res.locals.csrfToken = req.csrfToken();
	res.locals.twofactor = (!(process.env.SKIP_2FA === 'true' || process.env.SKIP_2FA === '1'));

	res.render('login');
});

router.post('/', parseForm, csrfProtection, (req, res) => {
	const {username, password, authcode} = req.body;

	res.locals.csrfToken = req.csrfToken();
	res.locals.twofactor = (!(process.env.SKIP_2FA === 'true' || process.env.SKIP_2FA === '1'));

	let badPasswordOrCode;
	if (!(process.env.SKIP_2FA === 'true' || process.env.SKIP_2FA === '1')) {
		badPasswordOrCode = 'Invalid username, password, or 2FA code.';
	}
	else {
		badPasswordOrCode = 'Invalid username or password.';
	}

	if ( !username || !password ) {
		return res.render('install', {error: 'Username and password are required.'});
	}

	UserModel.findOne({ username } )
		.then(user => {
			if (!user || !user.validatePassword(password)) {
				return res.render('login', { error: badPasswordOrCode });
			}

			if (!(process.env.SKIP_2FA === 'true' || process.env.SKIP_2FA === '1')) {
				if (user.secret_2fa) {
					if ( !authcode ) {
						return res.render('login', { error: badPasswordOrCode });
					}

					const verification = twofactor.verifyToken(user.secret_2fa, authcode);
					if (!verification || verification.delta !== 0) {
						return res.render('login', { error: badPasswordOrCode });
					}
					req.session.twofa_authenticated = true;
				}
				else {
					// User has not set up 2FA yet
					req.session.user = user.id;
					return res.redirect('/2fa-setup');
				}
			}

			// Set session user
			req.session.user = user.id;
			res.redirect('/dashboard');
		})
		.catch(err => {
			console.error('Error during login:', err);
			res.status(500).send('Internal Server Error');
		});
});

module.exports = router;