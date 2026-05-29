import {db} from '../db.mjs';
import {and, asc, desc, eq, sql} from "drizzle-orm";

/**
 * Base Model which provides sequelize-like functionality without needing sequelize.
 */
export class BaseModel {
	constructor(data) {
		this._data = data;
		this._originalData = {};
	}

	/**
	 * Get a value from the record.
	 *
	 * @param {string} key
	 * @returns {*|null}
	 */
	get (key) {
		return this._data[key] || null;
	}

	/**
	 * Set a value on the record.
	 *
	 * @param {string} key
	 * @param {*} value
	 */
	set(key, value) {
		this._data[key] = value;
	}

	/**
	 * Check if a value has been changed since the record was created.
	 *
	 * If no key is requested, just checks if any value has changed.
	 *
	 * @param {string|null=null} key
	 * @returns {boolean}
	 */
	changed(key) {
		if (!key) {
			let changed = false;
			Object.keys(this._data).forEach(key => {
				if (this._originalData[key] !== this._data[key]) {
					changed = true;
				}
			});

			return changed;
		}

		return this._originalData[key] !== this._data[key];
	}

	/**
	 * Check if this record exists in the database.
	 *
	 * Doesn't lookup the record, just checks if the ID is set.
	 *
	 * @returns {boolean}
	 */
	exists() {
		return (this._originalData['id'] !== null && this._originalData['id'] !== undefined);
	}

	async _saveNew() {
		// Set of data to save; do not push EVERY key if it's not necessary.
		let data = {};

		Object.keys(this._data).forEach(key => {
			if (key !== 'id') {
				data[key] = this._data[key];
			}
		});

		return db
			.insert(this._tableDefinition)
			.values(data)
			.returning()
			.then(results => {
				this._originalData = {...results[0]};
				// Map the ID over, this is particularly useful for saveNew.
				this._data['id'] = this._originalData['id'];
				return this;
			});
	}

	async _saveExisting() {
		// Set of data to save; do not push EVERY key if it's not necessary.
		let data = {}, changes = false;
		const identifier = this._originalData['id'];

		Object.keys(this._data).forEach(key => {
			if (key !== 'id' && this.changed(key)) {
				data[key] = this._data[key];
				changes = true;
			}
		});

		if (!changes) {
			console.debug('No changes detected on model, skipping save', this._data);
			return this;
		}

		return db
			.update(this._tableDefinition)
			.set(data)
			.where(eq(this._tableDefinition.id, identifier))
			.returning()
			.then(results => {
				this._originalData = {...results[0]};
				return this;
			});
	}

	/**
	 *
	 * @returns {Promise<BaseModel>}
	 */
	async save () {
		if (this.exists()) {
			return this._saveExisting();
		}
		else {
			return this._saveNew();
		}
	}

	async remove () {
		let identifier = this.get('id');
		if (identifier === null || !identifier) {
			throw new Error('Invalid identifier provided for deletion');
		}
		return db.delete(this._tableDefinition).where(eq(this._tableDefinition.id, identifier)).limit(1).execute();
	}

	/**
	 * Find a single record by the given where clause.
	 *
	 * If no records match the lookup, NULL is returned instead.
	 *
	 * @param {function} recordType
	 * @param {Object|null=null} where
	 * @param {string|Array<[string, string]>|null=null} order
	 * @returns {Promise<BaseModel|null>}
	 */
	static async findOne(recordType, where, order) {
		const tableDefinition = recordType.prototype._tableDefinition;
		const lookup = db
			.select()
			.from(tableDefinition)
			.limit(1);

		if (where) {
			const conditions = Object.keys(where).map(key =>
				eq(tableDefinition[key], where[key])
			);
			lookup.where(and(...conditions));
		}

		if (order) {
			if (typeof order === 'string') {
				// Simple order by
				lookup.orderBy(asc(tableDefinition[order]));
			}
			else {
				order.forEach(o => {
					if (o[1].toLowerCase() === 'desc') {
						lookup.orderBy(desc(tableDefinition[o[0]]));
					}
					else {
						lookup.orderBy(asc(tableDefinition[o[0]]));
					}
				});
			}
		}

		return lookup.execute().then(results => {
			if (results.length < 1) {
				return null;
			}

			const ret = new recordType(results[0]);
			ret._originalData = {...results[0]};
			return ret;
		});
	}

	/**
	 * Find all records matching the given where clause.
	 *
	 * @param {function} recordType
	 * @param {Object|null=null} where
	 * @param {string|Array<[string, string]>|null=null} order
	 * @returns {Promise<BaseModel[]>}
	 */
	static async findAll(recordType, where, order) {
		const tableDefinition = recordType.prototype._tableDefinition;
		const lookup = db
			.select()
			.from(tableDefinition);

		if (where) {
			const conditions = Object.keys(where).map(key =>
				eq(tableDefinition[key], where[key])
			);
			lookup.where(and(...conditions))
		}

		if (order) {
			if (typeof order === 'string') {
				// Simple order by
				lookup.orderBy(asc(tableDefinition[order]));
			}
			else {
				order.forEach(o => {
					if (o[1].toLowerCase() === 'desc') {
						lookup.orderBy(desc(tableDefinition[o[0]]));
					}
					else {
						lookup.orderBy(asc(tableDefinition[o[0]]));
					}
				});
			}
		}

		return lookup.execute().then(results => {
			let res = [];
			results.forEach(result => {
				const ret = new recordType(result);
				ret._originalData = {...result};
				res.push(ret);
			});
			return res;
		});
	}

	/**
	 * Count number of records matching the given where clause.
	 *
	 * @param {function} recordType
	 * @param {Object} where
	 * @returns {Promise<number>}
	 */
	static async count(recordType, where) {
		const tableDefinition = recordType.prototype._tableDefinition;
		const lookup = db
			.select({ count: sql`count(*)` })
			.from(tableDefinition);

		if (where) {
			const conditions = Object.keys(where).map(key =>
				eq(tableDefinition[key], where[key])
			);
			lookup.where(and(...conditions))
		}

		return lookup.execute().then(results => {
			return results[0]['count'] || 0;
		});
	}

	/**
	 * Generate a timestamp in usual sqlite format (2026-01-27 05:56:59.236 +00:00)
	 *
	 * @returns {string}
	 */
	static generateNow() {
		const now = new Date();

		// Helper function to pad single digits with a leading zero (e.g., 5 -> "05")
		const pad = (number) => String(number).padStart(2, '0');

		// Extract components from the Date object
		const year = now.getFullYear();
		const month = pad(now.getMonth() + 1); // getMonth() is 0-indexed!
		const day = pad(now.getDate());
		const hours = pad(now.getHours());
		const minutes = pad(now.getMinutes());
		const seconds = pad(now.getSeconds());
		// Milliseconds need to be padded to three digits
		const milliseconds = String(now.getMilliseconds()).padStart(3, '0');

		// Determine the timezone offset string (+HH:MM or -HH:MM)
		// getTimezoneOffset() returns the difference in minutes from UTC (e.g., for GMT+1, it returns -60)
		const offsetMinutes = now.getTimezoneOffset();
		const sign = offsetMinutes >= 0 ? '+' : '-'; // If positive or zero, use '+'. If negative, use '-'.
		// Use Math.abs() to ensure we get a positive number for padding the minutes part
		const absOffset = Math.abs(offsetMinutes);
		const offsetHours = pad(Math.floor(absOffset / 60));
		const offsetMins = pad(absOffset % 60);

		// Assemble the final string in the desired format: "YYYY-MM-DD HH:mm:ss.sss +ZZ:ZZ"
		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds} ${sign}${offsetHours}:${offsetMins}`;
	}
}
