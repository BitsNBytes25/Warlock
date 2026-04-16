const express = require('express');
const { validate_session } = require('../libs/validate_session.mjs');
const router = express.Router();

// Get package version (cached via require). Fallback to 'unknown' on error.
let version = 'unknown';
try {
    const pkg = require('../package.json');
    if (pkg && pkg.version) version = pkg.version;
} catch (err) {
    console.warn('settings: failed to load package.json:', err && err.message);
}

router.get('/', validate_session, (req, res) => {
	res.render(
		'settings', {
			version,
			twofactor: (!(process.env.SKIP_2FA === 'true' || process.env.SKIP_2FA === '1')),
			authentication: (!(process.env.SKIP_AUTHENTICATION === 'true' || process.env.SKIP_AUTHENTICATION === '1')),
		}
	);
});

module.exports = router;
