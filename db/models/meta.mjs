import {meta} from '../schema.mjs';
import {BaseModel} from './base.mjs';

export class MetaModel extends BaseModel {
	constructor(data) {
		super(data);
	}

	get id() { return this._data.id; }
	get key() { return this._data.key; }
	get value() { return this._data.value; }
	set key(value) { this._data.key = value; }
	set value(value) { this._data.value = value; }

	/**
	 * Find a single user filtered by a where clause.
	 *
	 * @param {Object|null} where
	 * @returns {Promise<MetaModel|null>}
	 */
	static async findOne(where) {
		return BaseModel.findOne(MetaModel, where);
	}

	/**
	 * Get all users, optionally filtered by a where clause.
	 *
	 * @param {Object|null} where
	 * @returns {Promise<MetaModel[]>}
	 */
	static async findAll(where) {
		return BaseModel.findAll(MetaModel, where);
	}

	/**
	 * Count number of records matching the given where clause.
	 *
	 * @param {Object} where
	 * @returns {Promise<number>}
	 */
	static async count(where) {
		return BaseModel.count(MetaModel, where);
	}
}

MetaModel.prototype._tableDefinition = meta;