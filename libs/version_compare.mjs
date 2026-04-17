export const VersionCompare = {
	/**
	 * Internal comparison helper.
	 * @param {string|number} v1
	 * @param {string|number} v2
	 * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
	 */
	_compare(v1, v2) {
		if (typeof v1 === 'number') {
			v1 = v1.toString() + '.0.0';
		}
		if (typeof v2 === 'number') {
			v2 = v2.toString() + '.0.0';
		}

		const parts1 = v1.split('.').map(Number);
		const parts2 = v2.split('.').map(Number);
		const maxLength = Math.max(parts1.length, parts2.length);

		for (let i = 0; i < maxLength; i++) {
			const num1 = parts1[i] || 0;
			const num2 = parts2[i] || 0;

			if (num1 > num2) return 1;
			if (num1 < num2) return -1;
		}

		return 0;
	},

	/**
	 * Check if v1 is greater than v2
	 *
	 * @param {string|number} v1
	 * @param {string|number} v2
	 * @returns {boolean}
	 */
	gt(v1, v2) {
		return this._compare(v1, v2) === 1;
	},

	/**
	 * Check if v1 is greater than or equal to v2
	 *
	 * @param {string|number} v1
	 * @param {string|number} v2
	 * @returns {boolean}
	 */
	ge(v1, v2) {
		return this._compare(v1, v2) >= 0;
	},

	/**
	 * Check if v1 is less than v2
	 *
	 * @param {string|number} v1
	 * @param {string|number} v2
	 * @returns {boolean}
	 */
	lt(v1, v2) {
		return this._compare(v1, v2) === -1;
	},

	/**
	 * Check if v1 is less than or equal to v2
	 *
	 * @param {string|number} v1
	 * @param {string|number} v2
	 * @returns {boolean}
	 */
	le(v1, v2) {
		return this._compare(v1, v2) <= 0;
	},

	/**
	 * Check if v1 and v2 are equal
	 *
	 * @param {string|number} v1
	 * @param {string|number} v2
	 * @returns {boolean}
	 */
	eq(v1, v2) {
		return this._compare(v1, v2) === 0;
	},

	/**
	 * Check if v1 satisfies the version range specified in v2.
	 *
	 * v1 is the basic string to compare.
	 * v2 is the Node-esque version range string, accepting either a caret (^) or tilde (~) prefix.
	 *
	 * When in caret mode, it is "compatible with"; checks the major version ONLY.
	 * When in tilde mode, it is "patch mode"; checks the major AND minor versions.
	 *
	 * Tilde mode is useful for keeping within the same API version of something,
	 * as minor versions may introduce new features and some minor breaking changes.
	 *
	 * @param {string|number} v1
	 * @param {string} v2
	 * @returns {boolean}
	 */
	satisfies(v1, v2) {
		let minCheck = v2, maxCheck = v2;

		if (v2.startsWith('~')) {
			// Tilde mode, e.g. ~1.2.3. Take the major and minor versions
			v2 = v2.substring(1);
			const v2Parts = v2.split('.');
			if (v2Parts.length >= 3) {
				minCheck = v2;
				maxCheck = v2Parts[0] + '.' + v2Parts[1] + '.999';
			}
			else if (v2Parts.length === 2) {
				minCheck = v2Parts[0] + '.' + v2Parts[1] + '.0';
				maxCheck = v2Parts[0] + '.' + v2Parts[1] + '.999';
			}
			else if (v2Parts.length === 1) {
				minCheck = v2Parts[0] + '.0.0';
				maxCheck = v2Parts[0] + '.0.999';
			}
			else {
				throw new Error('Invalid version range: ' + v2);
			}
		}
		else if (v2.startsWith('^')) {
			// Caret mode, e.g. ^1.2.3. Take the major version
			v2 = v2.substring(1);
			const v2Parts = v2.split('.');
			if (v2Parts.length >= 2) {
				minCheck = v2;
				maxCheck = v2Parts[0] + '.999.999';
			}
			else if (v2Parts.length === 1) {
				minCheck = v2Parts[0] + '.0.0';
				maxCheck = v2Parts[0] + '.999.999';
			}
			else {
				throw new Error('Invalid version range: ' + v2);
			}
		}
		else {
			// Exact version match
			return this.eq(v1, v2);
		}

		return this.ge(v1, minCheck) && this.le(v1, maxCheck);
	}
};