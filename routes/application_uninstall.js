const express = require('express');
const router = express.Router();

router.get('/:guid/:host', (req, res) => {
	res.render('application_uninstall', {});
});

module.exports = router;