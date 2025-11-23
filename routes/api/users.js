const express = require('express');
const { validate_session } = require('../../libs/validate_session.mjs');
const { User } = require('../../db');
const { logger } = require('../../libs/logger.mjs');

const router = express.Router();

// List users (omit password)
router.get('/', validate_session, async (req, res) => {
	try {
		const users = await User.findAll({ attributes: ['id', 'username', 'createdAt', 'updatedAt'] });
		return res.json({ success: true, data: users });
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
		const exists = await User.findOne({ where: { username } });
		if (exists) return res.json({ success: false, error: 'Username already exists' });
		const user = await User.create({ username, password });
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
		const user = await User.findByPk(id);
		if (!user) return res.json({ success: false, error: 'User not found' });
		const exists = await User.findOne({ where: { username } });
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
		const user = await User.findByPk(id);
		if (!user) return res.json({ success: false, error: 'User not found' });
		user.password = password; // model hooks will hash on save
		await user.save();
		return res.json({ success: true });
	} catch (e) {
		logger.error('Error changing password:', e);
		return res.json({ success: false, error: String(e) });
	}
});

// Delete user
router.delete('/:id', validate_session, async (req, res) => {
	const id = req.params.id;
	try {
		const user = await User.findByPk(id);
		if (!user) return res.json({ success: false, error: 'User not found' });
		await user.destroy();
		return res.json({ success: true });
	} catch (e) {
		logger.error('Error deleting user:', e);
		return res.json({ success: false, error: String(e) });
	}
});

module.exports = router;

