import {arraysDiffer} from "./arrays_differ.mjs";

/**
 * Diff two objects and return the differences
 *
 * The order is important in that if a key exists in oldData but not newData,
 * that key is ignored.
 *
 * Only the changed values from newData are returned.
 *
 * ie: newData takes priority
 *
 * @param {Object} oldData
 * @param {Object} newData
 *
 * @returns {Object}
 */
export function diffObjects(oldData, newData) {
	if (typeof(oldData) !== 'object' || oldData === null) {
		return newData;
	}

	const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
	let diff = {};

	for (const key of keys) {
		if (newData[key] === undefined) {
			// Key exists in the old data, but not the new; that's fine.
			continue;
		}
		if (Array.isArray(oldData[key]) && Array.isArray(newData[key])) {
			const lenA = oldData[key].length, lenB = newData[key].length;
			if (lenA !== lenB) {
				// Array lengths differ; return the entire new array
				diff[key] = newData[key];
			}
			else {
				// Array lengths are the same, so we need to compare each element.
				for (let i = 0; i < lenA; i++) {
					if (typeof(oldData[key][i]) !== typeof(newData[key][i])) {
						diff[key] = newData[key];
					}
					else if (typeof(oldData[key][i]) === 'object') {
						let keyDiff = diffObjects(oldData[key][i], newData[key][i]);
						if (Object.keys(keyDiff).length > 0) {
							diff[key] =	newData[key];
						}
					}
					else if (oldData[key][i] !== newData[key][i]) {
						diff[key] = newData[key];
					}
				}
			}
		}
		else if (typeof oldData[key] === 'object' && typeof newData[key] === 'object') {
			let keyDiff = diffObjects(oldData[key], newData[key]);
			if (Object.keys(keyDiff).length > 0) {
				diff[key] =	keyDiff;
			}
		}
		else if (oldData[key] !== newData[key]) {
			diff[key] = newData[key];
		}
	}
	return diff;
}
