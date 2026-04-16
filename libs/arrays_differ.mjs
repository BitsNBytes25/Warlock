/**
 * Compare two simple arrays for differences in their values
 *
 * @param {Array} a
 * @param {Array} b
 * @returns {boolean}
 */
export function arraysDiffer (a, b) {
	const lenA = a.length, lenB = b.length;
	if (lenA !== lenB) return true;
	for (let i = 0; i < lenA; i++) {
		if (a[i] !== b[i]) return true;
	}
	return false;
}
