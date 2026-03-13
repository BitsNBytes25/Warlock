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
	const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
	let diff = {};

	for (const key of keys) {
		if (newData[key] === undefined) {
			// Key exists in the old data, but not the new; that's fine.
			continue;
		}
		if (Array.isArray(oldData[key]) && Array.isArray(newData[key])) {
			if (arraysDiffer(oldData[key], newData[key])) {
				diff[key] = newData[key];
			}
		}
		else if (oldData[key] !== newData[key]) {
			diff[key] = newData[key];
		}
	}
	return diff;
}
