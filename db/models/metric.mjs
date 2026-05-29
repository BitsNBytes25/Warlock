import {metrics} from '../schema.js';
import {BaseModel} from './base.mjs';

export class MetricModel extends BaseModel {
	constructor(data) {
		super(data);
	}

	get id() { return this._data.id; }
	get ip() { return this._data.ip; }
	get app_guid() { return this._data.app_guid; }
	get service() { return this._data.service; }
	get timestamp() { return this._data.timestamp; }
	get cpu_usage() { return this._data.cpu_usage; }
	get memory_usage() { return this._data.memory_usage; }
	get player_count() { return this._data.player_count; }
	get response_time() { return this._data.response_time; }
	get status() { return this._data.status; }
	set ip(value) { this._data.ip = value; }
	set app_guid(value) { this._data.app_guid = value; }
	set service(value) { this._data.service = value; }
	set timestamp(value) { this._data.timestamp = value; }
	set cpu_usage(value) { this._data.cpu_usage = value; }
	set memory_usage(value) { this._data.memory_usage = value; }
	set player_count(value) { this._data.player_count = value; }
	set response_time(value) { this._data.response_time = value; }
	set status(value) { this._data.status = value; }

	/**
	 * Find a single user filtered by a where clause.
	 *
	 * @param {Object|null=null} where
	 * @param {string|Array<[string, string]>|null=null} order
	 * @returns {Promise<MetricModel|null>}
	 */
	static async findOne(where, order) {
		return BaseModel.findOne(MetricModel, where, order);
	}

	/**
	 * Get all users, optionally filtered by a where clause.
	 *
	 * @param {Object|null=null} where
	 * @param {string|Array<[string, string]>|null=null} order
	 * @returns {Promise<MetricModel[]>}
	 */
	static async findAll(where, order) {
		return BaseModel.findAll(MetricModel, where, order);
	}

	/**
	 * Count number of records matching the given where clause.
	 *
	 * @param {Object} where
	 * @returns {Promise<number>}
	 */
	static async count(where) {
		return BaseModel.count(MetricModel, where);
	}
}

MetricModel.prototype._tableDefinition = metrics;