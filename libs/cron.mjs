import {cmdRunner} from "./cmd_runner.mjs";
import {clearTaggedCache} from "./cache.mjs";
import {logger} from "./logger.mjs";
import crypto from 'crypto';


// Helper validators
function isValidIdentifier(id) {
	if (!id || typeof id !== 'string') return false;
	// Allow alnum, underscore, dot, colon, dash
	return /^[A-Za-z0-9_.:-]+$/.test(id);
}

function validateSchedule(schedule) {
	if (!schedule || typeof schedule !== 'string') return false;
	const s = schedule.trim();
	if (s.length === 0) return false;
	// Accept either @special or five-field cron (very basic check)
	if (s.startsWith('@')) return true;
	const parts = s.split(/\s+/);
	return parts.length === 5;
}

function hasWarlockTag(line) {
	return line && line.indexOf('#warlock:') !== -1;
}

function parseIdentifier(line) {
	const m = line.match(/#warlock:id=([A-Za-z0-9_.:-]+)/);
	if (m && !line.startsWith('#')) {
		return m[1];
	}
	else {
		// Generate a hash of the line to allow updating even without an identifier
		return 'hash:' + crypto.createHash('md5').update(line).digest('hex');
	}
}

async function pushLines(host, lines) {
	const timestamp = Date.now(),
		dl = `EOF_${timestamp}`,
		newCron = lines.join('\n') + '\n';

	// Write new crontab and activate it
	const tmp = `/tmp/warlock_cron_${timestamp}`;
	const writeCmd = `cat > ${tmp} <<${dl}\n${newCron}\n${dl}\ncrontab ${tmp} && rm -f ${tmp}`;
	cmdRunner(host, writeCmd).then(() => {
		clearTaggedCache(host, 'cron');
		return true;
	});
}

export class Cron{
	constructor(host, identifier, command, schedule) {
		this.host = host;
		this.identifier = identifier;
		this.command = command;
		this.schedule = schedule;

		if (!host) {
			throw new Error('Host is required');
		}

		if (identifier && !isValidIdentifier(identifier)) {
			throw new Error('Identifier contains invalid characters');
		}
		if (!validateSchedule(schedule)) {
			throw new Error('Schedule must be a @special or 5-field cron expression');
		}
		if (!command || typeof command !== 'string' || command.trim().length === 0) {
			throw new Error('Command is required');
		}
		if (command.indexOf('\n') !== -1 || command.indexOf('\r') !== -1) {
			throw new Error('Command cannot contain newline characters');
		}

		if (!identifier && !this.isComment()) {
			this._generateIdentifier();
		}
	}

	/**
	 * Generate a unique and repeatable identifier for this cron job.
	 * @private
	 */
	_generateIdentifier() {
		let line = `${this.schedule} ${this.command}`;
		// Generate a hash of the line to allow updating even without an identifier
		this.identifier = 'hash:' + crypto.createHash('md5').update(line).digest('hex');
	}

	/**
	 * Check if this cron is a Warlock job
	 *
	 * @returns {boolean}
	 */
	isWarlock() {
		return !this.identifier.startsWith('hash:');
	}

	/**
	 * Check if this cron entry is a comment
	 *
	 * @returns {boolean}
	 */
	isComment() {
		return this.command.startsWith('#');
	}

	/**
	 * Check if this cron entry exists in the crontab
	 *
	 * @returns {Promise<boolean>}
	 */
	async exists() {
		let jobs = await Cron.GetAll(this.host);
		jobs = jobs.filter(j => j.identifier === this.identifier);
		return jobs.length > 0;
	}

	/**
	 * Get the full raw command string that is suitable for injection in the cron system
	 *
	 * @returns {string}
	 */
	getRaw() {
		if (this.isComment()) {
			return this.command;
		}
		else if (this.isWarlock()) {
			return `${this.schedule} ${this.command} #warlock:id=${this.identifier}`;
		}
		else {
			return `${this.schedule} ${this.command}`;
		}
	}

	toJSON() {
		return {
			raw: this.getRaw(),
			is_comment: this.isComment(),
			schedule: this.schedule,
			command: this.command,
			identifier: this.identifier,
			is_warlock: this.isWarlock()
		};
	}

	/**
	 * Save this cron job to the server.
	 *
	 * @returns {Promise<Object<success: boolean, message: string>>}
	 */
	async save() {
		const jobs = await Cron.GetAll(this.host);
		let exists = false,
			newLines = [];

		for(let j of jobs) {
			if (j.identifier === this.identifier) {
				// Located job is the same as the one being requested to be saved.
				// Check if it's actually changed; if not, we can skip the update entirely.
				if (j.getRaw() === this.getRaw()) {
					return {
						success: true,
						message: 'No changes detected'
					};
				}
				// If it did change, save the new line instead of the existing one.
				newLines.push(j.getRaw());
				exists = true;
			}
			else {
				// All other lines just get appended as-is.
				newLines.push(j.getRaw());
			}
		}

		if (!exists) {
			// If this cron is new, append it to the end of the crontab.
			newLines.push(this.getRaw());
		}

		// Save this on the server
		return pushLines(this.host, newLines).then(() => {
			return {
				success: true,
				message: `Saved cron entry ${this.identifier} successfully`
			};
		});
	}

	/**
	 * Delete this cron job from the server.
	 *
	 * @returns {Promise<Object<success: boolean, message: string>>}
	 */
	async delete() {
		const jobs = await Cron.GetAll(this.host);
		let exists = false,
			newLines = [];

		for(let j of jobs) {
			if (j.identifier === this.identifier) {
				// Located job on the server! Skip it to delete.
				exists = true;
			}
			else {
				// All other lines just get appended as-is.
				newLines.push(j.getRaw());
			}
		}

		if (!exists) {
			return {
				success: true,
				message: `Cron job with identifier ${this.identifier} not found on server`
			};
		}

		// Save this on the server
		return pushLines(this.host, newLines).then(() => {
			return {
				success: true,
				message: `Removed cron entry ${this.identifier} successfully`
			};
		});
	}

	/**
	 * Load a Cron entry from a single line of a crontab file.
	 *
	 * @param {string} host
	 * @param {string} line
	 * @returns {Cron}
	 */
	static FromLine(host, line) {

		const is_comment = line.trim().startsWith('#');
		const identifier = parseIdentifier(line);

		if (is_comment) {
			return new Cron(host, identifier, line, null);
		}
		else {
			let schedule = null;
			let command = null;
			// Extract portion before the first #warlock: tag
			const idx = line.indexOf('#warlock:');
			const pre = (idx >= 0) ? line.substring(0, idx).trim() : line.trim();

			// Determine schedule and command
			const tokens = pre.split(/\s+/);
			if (tokens[0] && tokens[0].startsWith('@')) {
				schedule = tokens[0];
				command = tokens.slice(1).join(' ').trim() || null;
			} else if (tokens.length >= 6) {
				schedule = tokens.slice(0,5).join(' ');
				command = tokens.slice(5).join(' ').trim() || null;
			} else {
				// Could be malformed; provide raw pre as command
				command = pre || null;
			}

			return new Cron(host, identifier, command, schedule);
		}
	}

	/**
	 * Get all cron jobs for a given host.
	 *
	 * @param {string} host
	 * @return {Cron[]}
	 */
	static async GetAll(host) {
		const cmd = "crontab -l 2>/dev/null || true";
		return cmdRunner(host, cmd, true, 'cron').then(result => {
			const out = (result.stdout || '').split(/\r?\n/);
			const jobs = [];
			for (let line of out) {
				if (!line) continue;
				try{
					jobs.push(Cron.FromLine(host, line));
				}
				catch(e) {
					logger.error(`Error parsing cron line: ${line}`, e);
				}
			}

			return jobs;
		});
	}

	/**
	 * Find a cron job by its identifier
	 *
	 * @param {string} host
	 * @param {string} identifier
	 *
	 * @returns {Promise<Cron|null>}
	 */
	static async FindByIdentifier(host, identifier) {
		const jobs = await Cron.GetAll(host);
		return jobs.find(j => j.identifier === identifier) || null;
	}
}
