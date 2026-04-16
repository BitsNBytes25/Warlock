import NodeCache from 'node-cache';
import {logger} from "./logger.mjs";
const cache = new NodeCache();

const hostTagMap = new Map();

export default cache;

export const clearCache = () => cache.flushAll();

/**
 * Tag a cache key with a host and tag so it can be selectively cleared
 *
 * @param {string}               key  Cache key to tag
 * @param {string}               host Host identifier (IP or hostname) to tag
 * @param {string[]|string|null} tags  Additional tags to support selective cache clearing (e.g. 'app_data', 'service_data')
 */
export const tagCacheKey = (key, host, tags) => {
	tags = tags || '__default__';
	if (!Array.isArray(tags)) {
		tags = [tags];
	}

	tags.forEach(tag => {
		const tagKey = tag || '__default__';
		const hostEntry = hostTagMap.get(host) || {};
		const keys = hostEntry[tagKey] || [];
		if (!keys.includes(key)) keys.push(key);
		hostEntry[tagKey] = keys;
		hostTagMap.set(host, hostEntry);
	});
};

/**
 * Clear all values for a given host and optionally only a specific group of tags.
 *
 * @param {string}      host
 * @param {string|null} tag
 */
export const clearTaggedCache = (host, tag = null) => {
	const tagKey = tag || null;
	const hostEntry = hostTagMap.get(host) || {};

	if (tagKey) {
		logger.debug(`Clearing tagged cache for host ${host} with tag ${tagKey}`);
	}
	else {
		logger.debug(`Clearing all cache for host ${host}`);
	}


	if (tagKey === null) {
		// Clear all tagged keys for the specific host
		for (const key in hostEntry) {
			const keys = hostEntry[key] || [];
			keys.forEach(k => {
				cache.del(k);
				logger.debug(`Cleared tagged cache key ${k}`);
			});
			delete hostEntry[key];
		}
	}
	else {
		const keys = hostEntry[tagKey] || [];
		keys.forEach(key => {
			cache.del(key);
			logger.debug(`Cleared cache key ${key}`);
		});
	}
}
