const express = require('express');
const { validate_session } = require("../../libs/validate_session.mjs");
const { cmdRunner } = require("../../libs/cmd_runner.mjs");
const { filePushRunner } = require("../../libs/file_push_runner.mjs");
const path = require('path');
const fs = require('fs');
const { Host } = require('../../db');
const { logger } = require('../../libs/logger.mjs');
const {buildRemoteExec} = require("../../libs/build_remote_exec.mjs");
const {correctMimetype} = require("../../libs/correct_mimetype.mjs");
const crypto = require('crypto');
const {clearTaggedCache} = require("../../libs/cache.mjs");

const router = express.Router();

// File viewing endpoint
router.get('/:host', validate_session, (req, res) => {
	const filePath = req.query.path || null,
		host = req.params.host;
	let forceDownload = req.query.download || false;

	if (forceDownload === 'true' || forceDownload === '1') {
		forceDownload = true;
	}

	if (!filePath) {
		return res.json({
			success: false,
			error: 'File path is required'
		});
	}
	logger.info('Viewing file:', filePath);

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({
				success: false,
				error: 'Requested host is not in the configured HOSTS list'
			});
		}

		if (forceDownload) {
			// Create a temporary file to download the file to
			const tempFile = `/tmp/warlock_download_${Date.now()}_${path.basename(filePath)}`;
			filePushRunner(host, tempFile, filePath, true).then(() => {
				return res.download(tempFile, path.basename(filePath), (err) => {
					// Remove the temporary file after download
					fs.unlinkSync(tempFile);
					if (err) {
						logger.error('File download error:', err);
					}
				});
			}).catch(e => {
				return res.json({
					success: false,
					error: `Cannot download file: ${e.error.message}`
				});
			});
		}
		else {
			// First check if it's a text file and get its size and basic stats
			let cmd = `[ -h "${filePath}" ] && F="$(readlink -f "${filePath}")" || F="${filePath}"; ` +
				`file --mime-type "$F"; ` + // mimetype, line[0]
				`stat -c%s "$F"; ` + // filesize, line[1]
				`echo "$F"; ` + // filename, line[2]
				`[ -r "$F" ] && stat -c%Y "$F" || echo "0";`; // modified time, line[3]
			cmdRunner(host, cmd).then(result => {
				const textMimetypes = [
					'application/json',
					'application/yaml',
					'application/xml',
					'application/javascript',
					'application/x-javascript',
					'inode/x-empty',
					'application/x-wine-extension-ini',
				];

				let lines = result.stdout.trim().split('\n'),
					mimetype = lines[0] || '',
					encoding = null,
					cmd = null,
					filesize = parseInt(lines[1]) || 0,
					filename = lines[2] || '',
					modified = parseInt(lines[3]) || 0;

				if (mimetype) {
					mimetype = mimetype.split(':').pop().trim();
					mimetype = correctMimetype(filename, mimetype);
				}

				if (filesize <= 1024 * 1024 * 10) {
					if (mimetype.startsWith('text/') || textMimetypes.includes(mimetype)) {
						cmd = `cat "${filePath}"`;
						encoding = 'raw';
					} else if (mimetype.startsWith('image/') || mimetype.startsWith('video/')) {
						// For images/videos, return base64 encoding
						cmd = `base64 "${filePath}"`;
						encoding = 'base64';
					}
				}

				// Read the file content
				if (cmd) {
					cmdRunner(host, cmd).then(result => {
						return res.json({
							success: true,
							content: result.stdout,
							encoding: encoding,
							mimetype: mimetype,
							size: filesize,
							path: filename,
							modified: modified,
							name: path.basename(filePath),
						});
					})
						.catch(e => {
							return res.json({
								success: false,
								error: 'Cannot read file content'
							});
						});
				}
				else {
					return res.json({
						success: true,
						content: null,
						encoding: encoding,
						mimetype: mimetype,
						size: filesize,
						path: filename,
						modified: modified,
						name: path.basename(filePath),
					})
				}
			})
			.catch(e => {
				return res.json({
					success: false,
					error: e.error.message
				});
			});
		}
	});
});

router.move('/:host', validate_session, (req, res) => {
	const { oldPath, newPath } = req.body,
		host = req.params.host;

	if (!oldPath || !newPath) {
		return res.json({
			success: false,
			error: 'Old path and new path are required'
		});
	}

	logger.info('Renaming item:', oldPath, '->', newPath);

	// Use mv command to rename
	cmdRunner(host, `mv "${oldPath}" "${newPath}"`).then(() => {
		clearTaggedCache(host, 'files');
		logger.info('Item renamed successfully:', oldPath, '->', newPath);
		res.json({
			success: true,
			message: 'Item renamed successfully'
		});
	})
	.catch(e => {
		logger.error('Rename error:', e);
		return res.json({
			success: false,
			error: `Cannot rename item: ${e.error.message}`
		});
	});
});

/**
 * Save file contents to a given path on the target host
 */
router.post('/:host', validate_session, (req, res) => {
	let host = req.params.host,
		path = req.query.path,
		{ content } = req.body,
		name = req.query.name || null,
		isDir = req.query.isdir || false;

	isDir = (isDir === 'true' || isDir === '1');

	// Sanity checks
	if (!path) {
		return res.json({
			success: false,
			error: 'Please enter a file path'
		});
	}
	if (name) {
		// Allow the user to submit a path + name separately so we can validate the name
		['"', "'", '/', '\\', '?', '%', '*', ':', '|', '<', '>'].forEach(char => {
			if (name.includes(char)) {
				return res.json({
					success: false,
					error: `The file name cannot contain the following characters: " ' / \\ ? % * : | < >`
				});
			}
		});
	}
	['"', "'", '\\', '?', '%', '*', ':', '|', '<', '>'].forEach(char => {
		if (path.includes(char)) {
			return res.json({
				success: false,
				error: `The file path cannot contain the following characters: " ' \\ ? % * : | < >`
			});
		}
	});

	if (isDir && !name) {
		return res.json({
			success: false,
			error: 'Please enter a directory name'
		});
	}

	if (name) {
		// If name and path are requested separately, combine them to perform file operations.
		path = path.replace(/\/+$/, '') + '/' + name;
	}

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({
				success: false,
				error: 'Requested host is not in the configured HOSTS list'
			});
		}
		if (isDir) {
			// Create directory
			logger.info('Creating directory:', path);
			let cmd = `mkdir -p "${path}" && chown $(stat -c%U "$(dirname "${path}")"):$(stat -c%U "$(dirname "${path}")") "${path}"`;
			cmdRunner(host, cmd).then(() => {
				clearTaggedCache(host, 'files');
				logger.debug('Directory created successfully:', path);
				res.json({
					success: true,
					message: 'Directory created successfully'
				});
			})
				.catch(e => {
					logger.error('Create directory error:', e);
					return res.json({
						success: false,
						error: `Cannot create directory: ${e.error.message}`
					});
				});
		}
		else if (content) {
			// Content was requested, save to a local /tmp file to transfer to the target server
			logger.info('Saving file:', path);

			// Create a temporary file on the server with the content and then move it
			const tempFile = `/tmp/warlock_edit_${Date.now()}.tmp`;
			fs.writeFileSync(tempFile, content, 'utf8');

			// Push the temporary file to the target device
			filePushRunner(host, tempFile, path).then(() => {
				clearTaggedCache(host, 'files');
				logger.info('File saved successfully:', path);
				res.json({
					success: true,
					message: 'File saved successfully'
				});
			})
				.catch(error => {
					logger.error('Save file error:', error);
					return res.json({
						success: false,
						error: `Cannot save file: ${error.message}`
					});
				})
				.finally(() => {
					// Remove the temporary file
					fs.unlinkSync(tempFile);
				});
		} else {
			// No content supplied, that's fine!  We can still create an empty file.
			let cmd = `[ -e "${path}" ] && echo -n "" > "${path}" || touch "${path}"; chown $(stat -c%U "$(dirname "${path}")"):$(stat -c%U "$(dirname "${path}")") "${path}"`;
			cmdRunner(host, cmd).then(() => {
				clearTaggedCache(host, 'files');
				logger.debug('File created successfully:', path);
				res.json({
					success: true,
					message: 'File saved successfully'
				});
			})
				.catch(e => {
					logger.error('Create file error:', e);
					return res.json({
						success: false,
						error: `Cannot create file: ${e.error.message}`
					});
				});
		}
	});
});

router.put('/:host', validate_session, (req, res) => {
	const host = req.params.host,
		filePath = req.query.path,
		chunk = req.query.chunk || 0,
		totalChunks = req.query.totalChunks || 0,
		size = parseInt(req.query.size) || null;

	if (!filePath) {
		return res.json({
			success: false,
			error: 'Please enter a file path'
		});
	}

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({
				success: false,
				error: 'Requested host is not in the configured HOSTS list'
			});
		}

		if (totalChunks) {
			if (!size) {
				return res.json({
					success: false,
					error: 'Total file size must be provided when uploading in chunks'
				});
			}

			logger.info(`Uploading chunk ${chunk+1}/${totalChunks} for file:`, filePath);
		}
		else {
			logger.info('Uploading binary file:', filePath);
		}

		// Generate a hash of the file path to use as an identifier for this upload session
		const hash = crypto.createHash('sha256').update(host + ':' + filePath).digest('hex');

		// Create a temporary file
		const tempFile = `/tmp/warlock_upload_${hash}.tmp`;
		// Create an APPEND write stream to the temporary file
		const writeStream = fs.createWriteStream(tempFile, {flags: 'a'});

		req.pipe(writeStream);

		writeStream.on('finish', () => {
			if (totalChunks) {
				logger.info(`Finished writing chunk ${chunk+1}/${totalChunks} to temporary file:`, tempFile);

				if (chunk < totalChunks - 1) {
					// Not the last chunk, wait for the next one
					return res.json({
						success: true,
						message: `Chunk ${chunk+1} uploaded successfully`
					});
				}

				// Check the filesize to provide some measure of validation.
				const stats = fs.statSync(tempFile);
				if (stats.size !== size) {
					logger.warn(`Uploaded file size (${stats.size}) does not match expected size (${size}) for file:`, filePath);

					// Reject the upload attempt, the client should retry the upload
					fs.unlinkSync(tempFile);
					return res.json({
						success: false,
						error: 'Uploaded file size does not match expected size, please retry the upload'
					});
				}
				else {
					logger.info('All chunks uploaded successfully, proceeding with file push for:', filePath);
				}
			}

			// Push the temporary file to the target device
			filePushRunner(host, tempFile, filePath).then(() => {
				clearTaggedCache(host, 'files');
				logger.info('File uploaded successfully:', filePath);
				res.json({
					success: true,
					message: 'File uploaded successfully'
				});
			})
				.catch(error => {
					logger.error('Upload file error:', error);
					return res.json({
						success: false,
						error: `Cannot upload file: ${error.message}`
					});
				})
				.finally(() => {
					// Remove the temporary file
					if (fs.existsSync(tempFile)) {
						fs.unlinkSync(tempFile);
					}
				});
		});

		writeStream.on('error', (err) => {
			logger.error('File write error:', err);
			res.json({
				success: false,
				error: 'Error writing file'
			});
		});
	});
});

/**
 * Delete file on a given path on the target host
 */
router.delete('/:host', validate_session, (req, res) => {
	const host = req.params.host;

	let path = req.query.path || null;

	// Sanity checks
	if (!path) {
		return res.json({
			success: false,
			error: 'Please enter a file path'
		});
	}
	if (path === '/') {
		return res.json({
			success: false,
			error: 'LULZ, Do not delete the root directory'
		});
	}

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({
				success: false,
				error: 'Requested host is not in the configured HOSTS list'
			});
		}

		logger.info('Deleting file:', path);
		cmdRunner(host, `rm -fr "${path}"`).then(() => {
			clearTaggedCache(host, 'files');
			logger.debug('File deleted successfully:', path);
			res.json({
				success: true,
				message: 'File removed successfully'
			});
		})
			.catch(e => {
				logger.error('Delete file error:', e);
				return res.json({
					success: false,
					error: `Cannot delete file: ${e.error.message}`
				});
			});
	});
});

/**
 * Save file contents to a given path on the target host
 */
router.post('/extract/:host', validate_session, (req, res) => {
	let host = req.params.host,
		path = req.query.path || null;

	// Sanity checks
	if (!path) {
		return res.json({
			success: false,
			error: 'Please enter a file path'
		});
	}

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({
				success: false,
				error: 'Requested host is not in the configured HOSTS list'
			});
		}

		// Retrieve some information about the file and target environment.
		// We'll need to know the mimetype of the archive and which archive formats are available.
		const cmdDiscover = `if [ -e "${path}" ]; then file --mime-type "${path}"; else echo "missing"; fi;` +
			'if which unzip &>/dev/null; then echo "zip"; fi;' +
			'if which unrar &>/dev/null; then echo "rar"; fi;' +
			'if which tar &>/dev/null; then echo "tar"; echo "tar/gzip"; echo "tar/xz"; echo "tar/bzip2"; fi;' +
			'if which unxz &>/dev/null; then echo "xz"; fi;' +
			'if which bunzip2 &>/dev/null; then echo "bzip2"; fi;' +
			'if which 7z &>/dev/null; then echo "7z"; fi;';

		const mimetypeToHandler = {
			'application/zip': 'zip',
			'application/x-rar': 'rar',
			'application/x-tar': 'tar',
			'application/gzip': 'gzip',
			'application/x-bzip2': 'bzip2',
			'application/x-xz': 'xz',
			'application/x-7z-compressed': '7z',
		};

		const handlerSources = {
			'zip': 'https://raw.githubusercontent.com/eVAL-Agency/ScriptsCollection/refs/heads/main/dist/zip/linux_install_unzip.sh',
			'rar': 'https://raw.githubusercontent.com/eVAL-Agency/ScriptsCollection/refs/heads/main/dist/rar/linux_install_unrar.sh',
			'7z': 'https://raw.githubusercontent.com/eVAL-Agency/ScriptsCollection/refs/heads/main/dist/7zip/linux_install_7zip.sh',
		};

		const cmdSudoPrefix = `sudo -u $(stat -c%U "$(dirname "${path}")")`;

		const cmdExtracts = {
			'zip': `${cmdSudoPrefix} unzip -o "${path}" -d "$(dirname "${path}")/"`,
			'rar': `${cmdSudoPrefix} unrar x -o+ "${path}" "$(dirname "${path}")/"`,
			'7z': `${cmdSudoPrefix} 7z x "${path}" -o"$(dirname "${path}")/" -y`,
			'tar/gzip': `${cmdSudoPrefix} tar -xzf "${path}" -C "$(dirname "${path}")/"`,
			'tar/bzip2': `${cmdSudoPrefix} tar -xjf "${path}" -C "$(dirname "${path}")/"`,
			'tar/xz': `${cmdSudoPrefix} tar -xJf "${path}" -C "$(dirname "${path}")/"`,
			'gzip': `${cmdSudoPrefix} gunzip -c "${path}" > "$(dirname "${path}")/$(basename "${path}" .gz)"`,
			'bzip2': `${cmdSudoPrefix} bunzip2 -c "${path}" > "$(dirname "${path}")/$(basename "${path}" .bz2)"`,
			'xz': `${cmdSudoPrefix} unxz -c "${path}" > "$(dirname "${path}")/$(basename "${path}" .xz)"`,
		}

		cmdRunner(host, cmdDiscover).then(async output => {
			let lines = output.stdout.trim().split('\n'),
				mimetype = lines[0] || 'missing',
				availableExtractors = lines.slice(1);

			if (mimetype.includes(': ')) {
				mimetype = mimetype.split(': ').pop().trim();
			}

			if (mimetype === 'missing') {
				return res.json({
					success: false,
					error: 'The specified file does not exist'
				});
			}

			let handler = mimetypeToHandler[mimetype] || null;
			if (!handler) {
				return res.json({
					success: false,
					error: `Unsupported archive mimetype: ${mimetype}`
				});
			}

			// Tarballs can be complicated, ie '.tar.gz' or '.tgz' will both be 'application/gzip' mimetype
			// but so will '.gz' files which are not tarballs.  We need to check the filename as well.
			if (handler === 'gzip' && (path.endsWith('.tar.gz') || path.endsWith('.tgz'))) {
				handler = 'tar/gzip';
			}
			else if (handler === 'bzip2' && path.endsWith('.tar.bz2')) {
				handler = 'tar/bzip2';
			}
			else if (handler === 'xz' && path.endsWith('.tar.xz')) {
				handler = 'tar/xz';
			}

			if (!availableExtractors.includes(handler)) {
				// Install this handler on the server
				let source = handlerSources[handler] || null;
				if (!source) {
					return res.json({
						success: false,
						error: `No installation source found for missing extractor: ${handler}`
					});
				}

				await cmdRunner(host, buildRemoteExec(source).cmd);
			}

			const cmdExtract = cmdExtracts[handler] || null;
			if (!cmdExtract) {
				return res.json({
					success: false,
					error: `No extraction command found for handler: ${handler}`
				});
			}

			// Finally, extract the archive
			cmdRunner(host, cmdExtract).then(async output => {
				clearTaggedCache(host, 'files');
				logger.info('Extracted archive successfully:', path);
				res.json({
					success: true,
					message: 'Archive extracted successfully'
				});
			});
		})
		.catch(e => {
			return res.json({
				success: false,
				error: `Cannot extract archive: ${e.error.message}`
			});
		});
	});
});

/**
 * Save file contents to a given path on the target host
 */
router.post('/compress/:host', validate_session, (req, res) => {
	let host = req.params.host,
		path = req.query.path || null,
		format = req.query.format || 'tar/gz';

	// Sanity checks
	if (!path) {
		return res.json({
			success: false,
			error: 'Please enter a file path'
		});
	}

	Host.count({ where: { ip: host } }).then(count => {
		if (count === 0) {
			return res.json({
				success: false,
				error: 'Requested host is not in the configured HOSTS list'
			});
		}

		// Retrieve some information about the file and target environment.
		// We'll need to know the mimetype of the archive and which archive formats are available.
		const cmdDiscover = 'if which zip &>/dev/null; then echo "zip"; fi;' +
			'if which rar &>/dev/null; then echo "rar"; fi;' +
			'if which tar &>/dev/null; then echo "tar"; echo "tar/gz"; echo "tar/xz"; echo "tar/bzip2"; fi;' +
			'if which unxz &>/dev/null; then echo "xz"; fi;' +
			'if which bunzip2 &>/dev/null; then echo "bzip2"; fi;' +
			'if which 7z &>/dev/null; then echo "7z"; fi;';

		const handlerSources = {
			'zip': 'https://raw.githubusercontent.com/eVAL-Agency/ScriptsCollection/refs/heads/main/dist/zip/linux_install_zip.sh',
			'rar': 'https://raw.githubusercontent.com/eVAL-Agency/ScriptsCollection/refs/heads/main/dist/rar/linux_install_rar.sh',
			'7z': 'https://raw.githubusercontent.com/eVAL-Agency/ScriptsCollection/refs/heads/main/dist/7zip/linux_install_7zip.sh',
		};

		const basename = path.split('/').pop();

		let compressName = '';

		switch (format) {
			case 'zip':
				compressName = `${basename}.zip`;
				break;
			case 'rar':
				compressName = `${basename}.rar`;
				break;
			case '7z':
				compressName = `${basename}.7z`;
				break;
			case 'tar/gz':
				compressName = `${basename}.tar.gz`;
				break;
			case 'tar/bzip2':
				compressName = `${basename}.tar.bz2`;
				break;
		}

		if (!compressName) {
			return res.json({
				success: false,
				error: `Unsupported compression format: ${format}`
			});
		}

		const cmdSudoPrefix = `sudo -u $(stat -c%U "$(dirname "${path}")")`;

		const cmdCompressors = {
			'zip': `cd "$(dirname "${path}")"; ${cmdSudoPrefix} zip -r "${compressName}" "${basename}"`,
			'rar': `cd "$(dirname "${path}")"; ${cmdSudoPrefix} rar a "${compressName}" "${basename}"`,
			'7z': `cd "$(dirname "${path}")"; ${cmdSudoPrefix} 7z a "${compressName}" "${basename}"`,
			'tar/gz': `${cmdSudoPrefix} tar -czf "$(dirname "${path}")/${compressName}" -C "$(dirname "${path}")" "${basename}"`,
			'tar/bzip2': `${cmdSudoPrefix} tar -cjf "$(dirname "${path}")/${compressName}" -C "$(dirname "${path}")" "${basename}"`,
		}

		cmdRunner(host, cmdDiscover).then(async output => {
			let availableExtractors = output.stdout.trim().split('\n');

			if (!availableExtractors.includes(format)) {
				// Install this handler on the server
				let source = handlerSources[format] || null;
				if (!source) {
					return res.json({
						success: false,
						error: `No installation source found for missing compressor: ${format}`
					});
				}

				await cmdRunner(host, buildRemoteExec(source).cmd);
			}

			const cmdCompress = cmdCompressors[format] || null;
			if (!cmdCompress) {
				return res.json({
					success: false,
					error: `No compression command found for handler: ${format}`
				});
			}

			// Finally, extract the archive
			cmdRunner(host, cmdCompress).then(async output => {
				clearTaggedCache(host, 'files');
				logger.info('Compressed archive successfully:', path);
				res.json({
					success: true,
					message: 'Archive created successfully'
				});
			});
		})
			.catch(e => {
				return res.json({
					success: false,
					error: `Cannot create archive: ${e.error.message}`
				});
			});
	});
});

module.exports = router;
