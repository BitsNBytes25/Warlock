const express = require('express');
const {UserModel} = require("../db/models/user.mjs");
const {HostModel} = require("../db/models/host.mjs");
const router = express.Router();
const csrf = require('@dr.pogodin/csurf');
const bodyParser = require('body-parser');
const fs = require('fs');

let csrfProtection = csrf({ cookie: true });
let parseForm = bodyParser.urlencoded({ extended: false });

router.get('/', csrfProtection, (req, res) => {
	res.locals.csrfToken = req.csrfToken();

	// If there are no users in the database, proceed
	UserModel.count().then(count => {
		if (count === 0) {
			res.render('install');
		}
		else {
			res.redirect('/');
		}
	});
});

router.post('/', parseForm, csrfProtection, (req, res) => {
	const {username, password, confirm} = req.body,
		isRoot = process.getuid() === 0,
		isDocker = fs.existsSync('/.dockerenv');

	res.locals.csrfToken = req.csrfToken();

	if (password !== confirm) {
		return res.render('install', {error: 'Passwords do not match.'});
	}

	if ( !username || !password ) {
		return res.render('install', {error: 'Username and password are required.'});
	}

	if (password.length < 6) {
		return res.render('install', {error: 'Password must be at least 6 characters long.'});
	}

	// Create the initial admin user
	// In a real application, you'd want to add validation and error handling here
	(new UserModel({username, password})).save()
		.then(user => {
			// Set session user
			req.session.user = user.id;

			if (isRoot && !isDocker) {
				// If the service is running as root and not in Docker, we can add localhost to the list of management servers.
				(new HostModel({ ip: '127.0.0.1' })).save().then(() => {
					res.redirect('/');
				});
			}
			else {
				// Redirect to the host add page
				res.redirect('/host/add');
			}
		})
		.catch(err => {
			console.error('Error creating user:', err);
			res.render('install', {error: 'Error creating user. Please try again.'});
		});
});

module.exports = router;