import { User } from '../db.js';

export const validate_session = (req, res, next) => {
	if (process.env.SKIP_AUTHENTICATION === 'true' || process.env.SKIP_AUTHENTICATION === '1') {
		// If authentication is skipped, attach a default user object
		req.user = {
			id: 1,
			username: 'admin',
		};
		return next();
	}

	if (req.session && req.session.user) {
		// Lookup the user in the database to ensure session is valid
		const userId = req.session.user;
		User.findByPk(userId).then((user) => {
			if (user) {
				// User exists, proceed to next middleware
				// Attach the values from the user, (sans password and sensitive info)
				req.user = {
					id: user.id,
					username: user.username,
					// Add other non-sensitive fields as needed
				};

				// Redirect to a 2FA setup page if 2FA is not configured and we're not already on /2fa-setup
				if (!(process.env.SKIP_2FA === 'true' || process.env.SKIP_2FA === '1')) {
					if (!user.secret_2fa && req.baseUrl !== '/2fa-setup') {
						// User has not activated 2FA yet, redirect to setup page
						return res.redirect('/2fa-setup');
					}

					// Check to see if the 2fa successful flag is set in the session for users with 2FA enabled
					if (!req.session.twofa_authenticated && req.baseUrl !== '/2fa-setup') {
						req.session.destroy(() => {
							return res.redirect('/login');
						});
					}
				}

				return next();
			} else {
				// User not found, destroy session and redirect to login
				req.session.destroy(() => {
					return res.redirect('/login');
				});
			}
		}).catch((err) => {
			console.error('Database error during session validation:', err);
			return res.status(500).send('Internal Server Error');
		});
	} else {
		// No session, redirect to login or install (if not installed)
		// If there are no users in the database, redirect to install page
		User.count().then((count) => {
			if (count === 0) {
				return res.redirect('/install');
			}
			else {
				return res.redirect('/login');
			}
		});
	}
};
