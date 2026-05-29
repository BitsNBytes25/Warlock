import {hostMetrics} from '../schema.js';
import {BaseModel} from './base.mjs';


export class HostMetricModel extends BaseModel {
	constructor(data) {
		super(data);
	}

	get id() { return this._data.id; }
	get ip() { return this._data.ip; }
	get timestamp() { return this._data.timestamp; }
	get cpu() { return this._data.cpu; }
	get memory() { return this._data.memory; }
	get disk() { return this._data.disk; }
	get rx_last() { return this._data.rx_last; }
	get rx() { return this._data.rx; }
	get tx_last() { return this._data.tx_last; }
	get tx() { return this._data.tx;}
	set ip(value) { this._data.ip = value; }
	set timestamp(value) { this._data.timestamp = value; }
	set cpu(value) { this._data.cpu = value; }
	set memory(value) { this._data.memory = value; }
	set disk(value) { this._data.disk = value; }
	set rx_last(value) { this._data.rx_last = value; }
	set rx(value) { this._data.rx = value; }
	set tx_last(value) { this._data.tx_last = value; }
	set tx(value) { this._data.tx = value; }

	/**
	 * Find a single user filtered by a where clause.
	 *
	 * @param {Object|null} where
	 * @returns {Promise<HostMetricModel|null>}
	 */
	static async findOne(where) {
		return BaseModel.findOne(HostMetricModel, where);
	}

	/**
	 * Get all users, optionally filtered by a where clause.
	 *
	 * @param {Object|null} where
	 * @returns {Promise<HostMetricModel[]>}
	 */
	static async findAll(where) {
		return BaseModel.findAll(HostMetricModel, where);
	}

	/**
	 * Count number of records matching the given where clause.
	 *
	 * @param {Object} where
	 * @returns {Promise<number>}
	 */
	static async count(where) {
		return BaseModel.count(HostMetricModel, where);
	}
}

HostMetricModel.prototype._tableDefinition = hostMetrics;
