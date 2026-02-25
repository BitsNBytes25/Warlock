const express = require('express');
const {validate_session} = require("../libs/validate_session.mjs");
const csrf = require('@dr.pogodin/csurf');
const bodyParser = require('body-parser');
const {Host} = require("../db");
const {get_ssh_key} = require("../libs/get_ssh_key.mjs");
const {exec} = require('child_process');
const {hostPostAdd} = require("../libs/host_post_add.mjs");
const cache = require("../libs/cache.mjs");
const fs = require('fs');

const router = express.Router();
const csrfProtection = csrf({ cookie: true });
const parseForm = bodyParser.urlencoded({ extended: false });

router.get('/', validate_session, csrfProtection, (req, res) => {
	res.locals.csrfToken = req.csrfToken();
	res.render('host_add');
});

router.post('/', validate_session, parseForm, csrfProtection, (req, res) => {
	const {ip, retry} = req.body;

	res.locals.csrfToken = req.csrfToken();

	if ( !ip ) {
		return res.render('host_add', {error: 'IP address is required.'});
	}

	if (ip === 'localhost' || ip === '127.0.0.1') {
		if (process.getuid() !== 0) {
			// If localhost, require this process be running as root!
			return res.render('host_add', {error: 'Adding localhost requires the application to be run as root.'});
		}

		if (fs.existsSync('/.dockerenv')) {
			// If localhost, do NOT allow localhost when in Docker, as it won't work correctly and can cause confusion.
			return res.render('host_add', {error: 'Adding localhost is not allowed when running in Docker.'});
		}
	}

	// Verify it's not already in the host database
	Host.findOne({ where: { ip } }).then(existingHost => {
		if (existingHost) {
			return res.render(
				'host_add', {error: 'Host with this IP already exists.', ip}
			);
		}

		// Ensure the local key is available first
		// This will auto-create it if it doesn't exist.
		let localKey = get_ssh_key();

		if (ip === 'localhost' || ip === '127.0.0.1') {
			// Localhost does not require an SSH connection; we can just add the host immediately
			Host.create({ ip })
				.then(newHost => {
					return res.redirect('/hosts');
				})
				.catch(err => {
					console.error('Error adding host to database:', err);
					return res.render(
						'host_add', {error: 'Error adding host to database. Please try again.', ip}
					);
				});
		}
		else {
			// Try a simple SSH connection to verify access
			const cmd = `ssh -o LogLevel=quiet -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=5 root@${ip} echo "SSH Connection Successful"`;
			exec(cmd, (error, stdout, stderr) => {
				if (error) {
					console.error(`SSH connection error: ${error.message}`);
					return res.render(
						'host_add',
						{
							error: 'Failed to connect via SSH. Please ensure the host is reachable and the SSH key is authorized.',
							showError: (retry === '1'),
							localKey,
							ip
						}
					);
				}
				if (stderr) {
					console.error(`SSH connection stderr: ${stderr}`);
				}
				console.log(`SSH connection stdout: ${stdout}`);

				// If successful, add the host to the database
				Host.create({ ip })
					.then(newHost => {
						// Perform any operations required on the host
						hostPostAdd(ip).then(() => {
							cache.default.set('all_applications', null, 1); // Invalidate cache
							return res.redirect('/hosts');
						}).catch(e => {
							console.error('Error during post-add operations:', e);
							return res.redirect('/hosts');
						});
					})
					.catch(err => {
						console.error('Error adding host to database:', err);
						return res.render('host_add', {error: 'Error adding host to database. Please try again.'});
					});
			});
		}
	});

});

module.exports = router;