const { Sequelize, DataTypes} = require('sequelize');
const bcrypt = require('bcrypt');

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

// Sync database - alter: true will update schema without dropping data
sequelize.sync({ alter: true }).then(() => {
	console.log('Database synced successfully');
}).catch(err => {
	console.error('Error syncing database:', err);
});

module.exports = {
	sequelize,
	User,
	Host
};
