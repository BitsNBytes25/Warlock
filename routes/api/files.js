const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {Host} = require('../../db');
const {logger} = require('../../libs/logger.mjs');
const {correctMimetype} = require('../../libs/correct_mimetype.mjs');

const router = express.Router();

// File browser endpoints
router.get('/:host', validate_session, (req, res) => {
	const requestedPath = req.query.path || '/root';
	const host = req.params.host;

	if (!requestedPath) {
		return res.json({
			success: false,
			error: 'Path is required'
		});
	}

	Host.count({where: {ip: host}}).then(count => {
		if (count === 0) {
			return res.json({
				success: false,
				error: 'Requested host is not in the configured HOSTS list'
			});
		}

		logger.info('Browsing directory:', requestedPath);

		// Use ls with detailed output to get file information
		// -la shows all details including symlinks
		//let cmd = `ls -la "${requestedPath}" | tail -n +2`;
		let cmd = `P="${requestedPath}"; ` +
			'ls -1a "$P" | while read F; do ' +
			'P="${P%/}"; ' +
			'[ -h "$P/$F" ] && FP="$(readlink -f "$P/$F")" || FP="$P/$F";' +
			'[ -h "$P/$F" ] && SL="true" || SL="false";' +
			'[ -f "$FP" ] && [ -r "$FP" ] && S="$(stat -L -c%s "$FP")" || S="null";' +
			'[ -r "$FP" ] && M="$(file --mime-type "$FP" | sed "s#.*: ##")" || M="";' +
			'[ -r "$FP" ] && PERMS="$(stat -c%a "$FP")" || PERMS="null";' +
			'U="$(stat -c%U "$FP")";' +
			'G="$(stat -c%G "$FP")";' +
			'[ -r "$FP" ] && MTIME="$(stat -c%Y "$FP")" || MTIME="null";' +
			`echo "{\\"name\\":\\"$F\\",\\"mimetype\\":\\"$M\\",\\"path\\":\\"$FP\\",\\"size\\":$S,\\"symlink\\":$SL,\\"permissions\\":$PERMS,\\"user\\":\\"$U\\",\\"group\\":\\"$G\\",\\"modified\\":$MTIME},";` +
			'done;';
		cmdRunner(host, cmd, 300, 'files').then(result => {
			// Resulting code will be _almost_ JSON compatible, just strip the trailing comma and wrap in []
			let jsonOutput = `[${result.stdout.trim().replace(/,$/, '')}]`;
			let files = [];
			try {
				files = JSON.parse(jsonOutput);

				// Skip '.' and '..'
				files = files.filter(f => f.name !== '.' && f.name !== '..');

				// Ensure the mimetypes are actually accurate; useful for things like .json files being reported as text/plain
				files = files.map(f => {
					f.mimetype = correctMimetype(f.name, f.mimetype);
					return f;
				});
			} catch (e) {
				return res.json({
					success: false,
					error: 'Failed to parse directory listing'
				});
			}

			res.json({
				success: true,
				files: files,
				path: requestedPath
			});
		})
		.catch(e => {
			return res.json({
				success: false,
				error: e.error.message
			});
		});
	});
});

module.exports = router;