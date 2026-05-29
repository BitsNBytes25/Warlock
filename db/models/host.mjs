import {hosts} from '../schema.mjs';
import {BaseModel} from './base.mjs';


export class HostModel extends BaseModel {
	constructor(data) {
		super(data);
	}

	get id() { return this._data.id; }
	get ip() { return this._data.ip; }
	get createdAt() { return this._data.createdAt; }
	get updatedAt() { return this._data.updatedAt; }
	set ip(value) { this._data.ip = value; }


	async _saveNew() {
		this._data['createdAt'] = BaseModel.generateNow();

		return super._saveNew();
	}

	/**
	 * Save the user to the database.
	 *
	 * @returns {Promise<HostModel>}
	 */
	async save() {
		if (this.changed()) {
			this._data['updatedAt'] = BaseModel.generateNow();
		}

		return super.save();
	}

	/**
	 * Find a single user filtered by a where clause.
	 *
	 * @param {Object|null=null} where
	 * @param {string|Array<[string, string]>|null=null} order
	 * @returns {Promise<HostModel|null>}
	 */
	static async findOne(where, order) {
		return BaseModel.findOne(HostModel, where, order);
	}

	/**
	 * Get all users, optionally filtered by a where clause.
	 *
	 * @param {Object|null=null} where
	 * @param {string|Array<[string, string]>|null=null} order
	 * @returns {Promise<HostModel[]>}
	 */
	static async findAll(where, order) {
		return BaseModel.findAll(HostModel, where, order);
	}

	/**
	 * Count number of records matching the given where clause.
	 *
	 * @param {Object} where
	 * @returns {Promise<number>}
	 */
	static async count(where) {
		return BaseModel.count(HostModel, where);
	}
}

HostModel.prototype._tableDefinition = hosts;
