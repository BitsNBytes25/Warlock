const express = require('express');
const { validate_session } = require('../../libs/validate_session.mjs');
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
				createdAt: user.createdAt,
				updatedAt: user.updatedAt
			});
		}
		return res.json({ success: true, data: userData });
	} catch (e) {
		logger.error('Error fetching users:', e);
		return res.json({ success: false, error: String(e) });
	}
});

// Create user
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

// Update username
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

// Change password (admin reset)
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

// Reset 2FA authentication
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

// Delete user
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

module.exports = router;

