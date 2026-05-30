const express = require('express');
const { validate_session } = require('../../libs/validate_session.mjs');
const crypto = require('crypto');
const {UserModel} = require('../../db/models/user.mjs');
const { logger } = require('../../libs/logger.mjs');

const router = express.Router();

// List users (omit password)
router.get('/', validate_session, async (req, res) => {
	try {
		const users = await UserModel.findAll();
		let userData = [];
		for (let user of users) {
			userData.push({
				id: user.id,
				username: user.username,
				secret_2fa: parseInt(user.id) === parseInt(req.user.id) ? user.secret_2fa : !!user.secret_2fa,
				api_key: parseInt(user.id) === parseInt(req.user.id) ? user.api_key : !!user.api_key,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
				_current: parseInt(user.id) === parseInt(req.user.id)
			});
		}
		return res.json({ success: true, data: userData });
	} catch (e) {
		logger.error('Error fetching users:', e);
		return res.json({ success: false, error: String(e) });
	}
});

/**
 * Create new user account
 *
 * API Endpoint: POST /api/users
 */
router.post('/', validate_session, async (req, res) => {
	const { username, password } = req.body || {};
	if (!username || typeof username !== 'string' || username.trim().length === 0) {
		return res.json({ success: false, error: 'Username is required' });
	}
	if (!password || typeof password !== 'string' || password.length < 8) {
		return res.json({ success: false, error: 'Password is required and must be at least 8 characters' });
	}
	try {
		const exists = await UserModel.findOne({ username } );
		if (exists) return res.json({ success: false, error: 'Username already exists' });
		const user = new UserModel({ username, password });
		await user.save();
		return res.json({ success: true, data: { id: user.id, username: user.username } });
	} catch (e) {
		logger.error('Error creating user:', e);
		return res.json({ success: false, error: String(e) });
	}
});

/**
 * Update the username for a given user
 *
 * API Endpoint: PUT /api/users/:id
 */
router.put('/:id', validate_session, async (req, res) => {
	const id = req.params.id;
	const { username } = req.body || {};
	if (!username || typeof username !== 'string' || username.trim().length === 0) {
		return res.json({ success: false, error: 'Username is required' });
	}
	try {
		const user = await UserModel.findByPk(id);
		if (!user) return res.json({ success: false, error: 'User not found' });
		const exists = await UserModel.findOne({ username } );
		if (exists && exists.id !== user.id) return res.json({ success: false, error: 'Username already in use' });
		user.username = username;
		await user.save();
		return res.json({ success: true, data: { id: user.id, username: user.username } });
	} catch (e) {
		logger.error('Error updating user:', e);
		return res.json({ success: false, error: String(e) });
	}
});

/**
 * Change password (admin reset)
 *
 * API Endpoint: POST /api/users/:id/password
 */
router.post('/:id/password', validate_session, async (req, res) => {
	const id = req.params.id;
	const { password } = req.body || {};
	if (!password || typeof password !== 'string' || password.length < 8) {
		return res.json({ success: false, error: 'Password is required and must be at least 8 characters' });
	}
	try {
		const user = await UserModel.findByPk(id);
		if (!user) return res.json({ success: false, error: 'User not found' });
		user.password = password; // model hooks will hash on save
		await user.save();
		return res.json({ success: true });
	} catch (e) {
		logger.error('Error changing password:', e);
		return res.json({ success: false, error: String(e) });
	}
});

/**
 * Reset 2FA authentication
 *
 * API Endpoint: POST /api/users/:id/reset2fa
 */
router.post('/:id/reset2fa', validate_session, async (req, res) => {
	const id = req.params.id;

	try {
		const user = await UserModel.findByPk(id);
		if (!user) return res.json({ success: false, error: 'User not found' });
		// Clearing the 2FA secret to force re-setup
		user.secret_2fa = null;
		await user.save();
		return res.json({ success: true });
	} catch (e) {
		logger.error('Error resetting 2FA:', e);
		return res.json({ success: false, error: String(e) });
	}
});

/**
 * Delete requested user
 *
 * API Endpoint: DELETE /api/users/:id
 */
router.delete('/:id', validate_session, async (req, res) => {
	const id = req.params.id;
	try {
		const user = await UserModel.findByPk(id);
		if (!user) return res.json({ success: false, error: 'User not found' });
		await user.remove();
		return res.json({ success: true });
	} catch (e) {
		logger.error('Error deleting user:', e);
		return res.json({ success: false, error: String(e) });
	}
});

/**
 * Regenerate API Key for a user
 *
 * API Endpoint: POST /api/users/:id/regenerate-key
 */
router.post('/:id/regenerate-key', validate_session, async (req, res) => {
	const id = req.params.id;
	try {
		const user = await UserModel.findByPk(id);
		if (!user) return res.json({ success: false, error: 'User not found' });

		// Generate a secure 32-byte API key (64 hex characters)
		const newApiKey = crypto.randomBytes(32).toString('hex');

		// Update the user record with the new API key
		user.api_key = newApiKey;
		await user.save();

		return res.json({
			success: true,
			data: { id: user.id, username: user.username, api_key: newApiKey }
		});
	} catch (e) {
		logger.error('Error regenerating API key:', e);
		return res.json({ success: false, error: String(e) });
	}
});

module.exports = router;

