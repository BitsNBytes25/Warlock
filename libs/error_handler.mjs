const taglines = [
	'Game over, but the adventure continues.',
	'You missed the jump - try again!',
	'Out of mana, please recharge.',
	'Loot box is empty this time.',
	'Respawn point not found.',
	'The boss dodged your attack.',
	"You've been disconnected from the lobby.",
	"Inventory is full, can't carry more.",
	'Quest objective not completed.',
	'Stealth failed, you’ve been spotted.',
	'No save file found - start a new game.',
	'Your party needs a healer.',
	'Level up before proceeding.',
	'The map is still loading, hang tight.',
	'Achievement locked, requirements not met.',
	'You wandered into a glitch zone.',
	'The server rolled a critical miss.',
	'Your skill is on cooldown.',
	'NPCs are on a coffee break.',
	'The portal is closed for now.',
	'You triggered a hidden trap.',
	'Side quest unavailable at this time.',
	'The game master is AFK.',
	'Your mount ran away - walk instead.',
];

export const errorHandler = (err, req, res, next) => {
	const status = err.status || 400;

	if (req.accepts('html')) {
		let tagLine = taglines[Math.floor(Math.random() * taglines.length)];

		return res.status(status).render('error', {error: err, tagLine});
	}
	else {
		// JSON expects a specific structure.
		let error = { success: false, error: err.message };
		res.status(status).json(error);
	}
};
