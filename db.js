const { Sequelize, DataTypes} = require('sequelize');
const bcrypt = require('bcrypt');
const { stat } = require('fs');

const sequelize = new Sequelize({
	dialect: 'sqlite',
	storage: 'warlock.sqlite'
});

// User model with username and password fields
const User = sequelize.define('User', {
	username: {
		type: DataTypes.STRING
	},
	password: {
		type: DataTypes.STRING
	}
}, {
	hooks: {
		// Hash password before creating a new user
		beforeCreate: async (user) => {
			if (user.password) {
				const salt = await bcrypt.genSalt(10);
				user.password = await bcrypt.hash(user.password, salt);
			}
		},
		// Hash password before updating a user
		beforeUpdate: async (user) => {
			if (user.changed('password')) {
				const salt = await bcrypt.genSalt(10);
				user.password = await bcrypt.hash(user.password, salt);
			}
		}
	}
});

// Add instance method to validate password
User.prototype.validatePassword = async function(password) {
	return await bcrypt.compare(password, this.password);
};

// Host model with ip field
const Host = sequelize.define('Host', {
	ip: {
		type: DataTypes.STRING
	}
});

// Simple key-value meta model for storing miscellaneous data
const Meta = sequelize.define('Meta', {
	key: {
		type: DataTypes.STRING
	},
	value: {
		type: DataTypes.STRING
	}
});

// Metrics model for storing time-series service metrics
const Metric = sequelize.define('Metric', {
	ip: {
		type: DataTypes.STRING,
		allowNull: false
	},
	app_guid: {
		type: DataTypes.STRING,
		allowNull: false
	},
	service: {
		type: DataTypes.STRING,
		allowNull: false
	},
	timestamp: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	cpu_usage: {
		type: DataTypes.INTEGER,
		allowNull: true
	},
	memory_usage: {
		type: DataTypes.INTEGER,
		allowNull: true
	},
	player_count: {
		type: DataTypes.INTEGER,
		allowNull: true
	},
	response_time: {
		type: DataTypes.INTEGER,
		allowNull: true
	},
	status: {
		type: DataTypes.INTEGER,
		allowNull: true
	}

}, {
	indexes: [
		{ fields: ['ip', 'service', 'timestamp'] },
		{ fields: ['app_guid', 'service', 'timestamp'] }
	],
	timestamps: false
});

module.exports = {
	sequelize,
	User,
	Host,
	Meta,
	Metric
};
