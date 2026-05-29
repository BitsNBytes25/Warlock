import {users} from '../schema.js';
import {BaseModel} from './base.mjs';
import bcrypt from 'bcrypt';

export class UserModel extends BaseModel {
	constructor(data) {
		super(data);
	}

	get id() { return this._data.id; }
	get username() { return this._data.username; }
	get password() { return this._data.password; }
	get secret_2fa() { return this._data.secret_2fa; }
	get createdAt() { return this._data.createdAt; }
	get updatedAt() { return this._data.updatedAt; }
	set username(value) { this._data.username = value; }
	set password(value) { this._data.password = value; }
	set secret_2fa(value) { this._data.secret_2fa = value; }

	/**
	 * Validate the password against the hashed password in the database.
	 *
	 * @param {string} password
	 * @returns {bool}
	 */
	validatePassword(password) {
		return bcrypt.compareSync(password, this.password);
	}

	async _saveNew() {
		this._data['createdAt'] = BaseModel.generateNow();

		return super._saveNew();
	}

	/**
	 * Save the user to the database.
	 *
	 * @returns {Promise<UserModel>}
	 */
	async save() {
		// Hash the password if it's marked as changed.
		if (this.password && this.changed('password')) {
			const salt = await bcrypt.genSalt(10);
			this.password = await bcrypt.hash(this.password, salt);
		}

		if (this.changed()) {
			this._data['updatedAt'] = BaseModel.generateNow();
		}

		return super.save();
	}

	/**
	 * Find a single user filtered by a where clause.
	 *
	 * @param {Object|null} where
	 * @returns {Promise<UserModel|null>}
	 */
	static async findOne(where) {
		return BaseModel.findOne(UserModel, where);
	}

	/**
	 * Find a single user by its ID
	 *
	 * @param {number} id
	 * @returns {Promise<UserModel|null>}
	 */
	static async findByPk(id) {
		return BaseModel.findOne(UserModel, { id: id });
	}

	/**
	 * Get all users, optionally filtered by a where clause.
	 *
	 * @param {Object|null} where
	 * @returns {Promise<UserModel[]>}
	 */
	static async findAll(where) {
		return BaseModel.findAll(UserModel, where);
	}

	/**
	 * Count number of records matching the given where clause.
	 *
	 * @param {Object|null=null} where
	 * @returns {Promise<number>}
	 */
	static async count(where) {
		return BaseModel.count(UserModel, where);
	}
}

UserModel.prototype._tableDefinition = users;
