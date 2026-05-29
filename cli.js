#!/usr/bin/env node

/**
 * Warlock User Management CLI
 * 
 * A command-line interface for managing users without web authentication.
 * Useful for account recovery when system operator loses access.
 * 
 * Usage:
 *   npm run cli -- list-users
 *   npm run cli -- create-user <username> [password]
 *   npm run cli -- reset-password <username> [password]
 *   npm run cli -- reset-2fa <username>
 *   npm run cli -- delete-user <username>
 *   npm run cli -- help
 */

const dotenv = require('dotenv');
const readline = require('readline');
const {UserModel} = require('./db/models/user.mjs');
const { logger } = require('./libs/logger.mjs');

// Load environment variables
dotenv.config();

let rl = null;

/**
 * Get or create the readline interface
 */
function getReadlineInterface() {
	if (!rl) {
		rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});
	}
	return rl;
}

/**
 * Prompts user for input
 */
function prompt(question) {
	return new Promise((resolve, reject) => {
		try {
			const promptInterface = getReadlineInterface();
			promptInterface.question(question, resolve);
		} catch (error) {
			reject(error);
		}
	});
}

/**
 * Prompts user for password input (hidden when in terminal, visible in non-interactive mode)
 */
function promptPassword(question) {
	return new Promise((resolve, reject) => {
		try {
			// Check if input is a TTY (interactive terminal)
			if (process.stdin.isTTY) {
				// Hide password input
				process.stdin.setRawMode(true);
				let password = '';
				process.stdout.write(question);

				const onData = (char) => {
					char = char.toString();
					if (char === '\n' || char === '\r' || char === '\u0004') {
						process.stdin.removeListener('data', onData);
						process.stdin.setRawMode(false);
						console.log('');
						resolve(password);
					} else if (char === '\u0003') {
						process.exit();
					} else if (char === '\u007f' || char === '\b') {
						password = password.slice(0, -1);
					} else {
						password += char;
					}
				};

				process.stdin.on('data', onData);
			} else {
				// Non-interactive mode (piped input)
				const promptInterface = getReadlineInterface();
				promptInterface.question(question, resolve);
			}
		} catch (error) {
			reject(error);
		}
	});
}

/**
 * Display help/usage information
 */
function showHelp() {
	console.log(`
╔════════════════════════════════════════════════════════════════╗
║        Warlock User Management CLI - Recovery Tool             ║
╚════════════════════════════════════════════════════════════════╝

Usage:
  npm run cli -- <command> [args]

Commands:

  list-users
    List all users in the system
    Example: npm run cli -- list-users

  create-user <username> [password]
    Create a new user account
    If password not provided, you will be prompted for it
    Example: npm run cli -- create-user admin
    Example: npm run cli -- create-user admin MySecurePassword123!

  reset-password <username> [password]
    Reset a user's password
    If password not provided, you will be prompted for it
    Example: npm run cli -- reset-password admin
    Example: npm run cli -- reset-password admin NewPassword456!

  reset-2fa <username>
    Clear 2FA authentication for a user (forces re-setup on next login)
    Example: npm run cli -- reset-2fa admin

  delete-user <username>
    Delete a user account permanently
    Example: npm run cli -- delete-user olduser

  help
    Display this help message
    Example: npm run cli -- help

Notes:
  - Passwords must be at least 8 characters long
  - All database changes are applied immediately
  - This CLI requires direct filesystem access to the warlock.sqlite database

Recovery Scenario:
  If you have lost access to your account, use this CLI to:
  1. Reset your password: npm run cli -- reset-password <your_username> <new_password>
  2. Reset your 2FA if locked out: npm run cli -- reset-2fa <your_username>
`);
}

/**
 * List all users
 */
async function listUsers() {
	try {
		const users = await UserModel.findAll();

		if (users.length === 0) {
			console.log('\n✗ No users found in system');
			return true;
		}

		console.log('\n╔════════════════════════════════════════════════════════════════╗');
		console.log('║                         Users in System                        ║');
		console.log('╠════════════════════════════════════════════════════════════════╣');
		console.log('║ ID │ Username         │ 2FA │ Created                          ║');
		console.log('╠════════════════════════════════════════════════════════════════╣');

		users.forEach(user => {
			const id = String(user.id).padEnd(2);
			const username = user.username.padEnd(16);
			const has2fa = user.secret_2fa ? '✓' : '✗';
			const created = user.createdAt.substring(0, 19);
			console.log(`║ ${id} │ ${username} │ ${has2fa}   │ ${created}              ║`);
		});

		console.log('╚════════════════════════════════════════════════════════════════╝\n');
		return true;
	} catch (error) {
		logger.error('Error listing users:', error);
		console.error('\n✗ Error listing users:', error.message);
		return false;
	}
}

/**
 * Create a new user
 */
async function createUser(username, password) {
	try {
		const trimmedUsername = username.trim();

		if (!trimmedUsername) {
			console.error('\n✗ Username is required');
			return false;
		}

		if (!password) {
			password = await promptPassword('Enter password (minimum 8 characters): ');
		}

		if (!password || password.length < 8) {
			console.error('\n✗ Password must be at least 8 characters');
			return false;
		}

		const exists = await UserModel.findOne({ username: trimmedUsername } );
		if (exists) {
			console.error(`\n✗ Username "${trimmedUsername}" already exists`);
			return false;
		}

		const user = await (new UserModel({
			username: trimmedUsername,
			password: password
		})).save();

		console.log(`\n✓ User "${user.username}" created successfully (ID: ${user.id})`);
		console.log('  User must configure 2FA on first login\n');
		return true;
	} catch (error) {
		logger.error('Error creating user:', error);
		console.error('\n✗ Error creating user:', error.message);
		return false;
	}
}

/**
 * Reset user password
 */
async function resetPassword(username, password) {
	try {
		const trimmedUsername = username.trim();

		if (!trimmedUsername) {
			console.error('\n✗ Username is required');
			return false;
		}

		const user = await UserModel.findOne({ username: trimmedUsername } );
		if (!user) {
			console.error(`\n✗ User "${trimmedUsername}" not found`);
			return false;
		}

		if (!password) {
			password = await promptPassword('Enter new password (minimum 8 characters): ');
		}

		if (!password || password.length < 8) {
			console.error('\n✗ Password must be at least 8 characters');
			return false;
		}

		user.password = password; // Model hooks will hash on save
		await user.save();

		console.log(`\n✓ Password reset for user "${user.username}"\n`);
		return true;
	} catch (error) {
		logger.error('Error resetting password:', error);
		console.error('\n✗ Error resetting password:', error.message);
		return false;
	}
}

/**
 * Reset user 2FA authentication
 */
async function reset2FA(username) {
	try {
		const trimmedUsername = username.trim();

		if (!trimmedUsername) {
			console.error('\n✗ Username is required');
			return false;
		}

		const user = await UserModel.findOne({ username: trimmedUsername } );
		if (!user) {
			console.error(`\n✗ User "${trimmedUsername}" not found`);
			return false;
		}

		user.secret_2fa = null;
		await user.save();

		console.log(`\n✓ 2FA reset for user "${user.username}"`);
		console.log('  User must re-setup 2FA on next login\n');
		return true;
	} catch (error) {
		logger.error('Error resetting 2FA:', error);
		console.error('\n✗ Error resetting 2FA:', error.message);
		return false;
	}
}

/**
 * Delete a user
 */
async function deleteUser(username) {
	try {
		const trimmedUsername = username.trim();

		if (!trimmedUsername) {
			console.error('\n✗ Username is required');
			return false;
		}

		const user = await UserModel.findOne({ username: trimmedUsername } );
		if (!user) {
			console.error(`\n✗ User "${trimmedUsername}" not found`);
			return false;
		}

		const confirm = await prompt(
			`\n⚠️  Permanently delete user "${user.username}"? Type "yes" to confirm: `
		);

		if (confirm.toLowerCase() !== 'yes') {
			console.log('Delete cancelled');
			return false;
		}

		await user.remove();
		console.log(`\n✓ User "${user.username}" deleted\n`);
		return true;
	} catch (error) {
		logger.error('Error deleting user:', error);
		console.error('\n✗ Error deleting user:', error.message);
		return false;
	}
}

/**
 * Main CLI entry point
 */
async function main() {
	try {

		const command = process.argv[2];
		const args = process.argv.slice(3);
		let success = false;

		switch (command) {
			case 'list-users':
				success = await listUsers();
				break;

			case 'create-user':
				if (!args[0]) {
					console.error('\n✗ Username is required');
					showHelp();
					break;
				}
				success = await createUser(args[0], args[1]);
				break;

			case 'reset-password':
				if (!args[0]) {
					console.error('\n✗ Username is required');
					showHelp();
					break;
				}
				success = await resetPassword(args[0], args[1]);
				break;

			case 'reset-2fa':
				if (!args[0]) {
					console.error('\n✗ Username is required');
					showHelp();
					break;
				}
				success = await reset2FA(args[0]);
				break;

			case 'delete-user':
				if (!args[0]) {
					console.error('\n✗ Username is required');
					showHelp();
					break;
				}
				success = await deleteUser(args[0]);
				break;

			case 'help':
			case '--help':
			case '-h':
				showHelp();
				success = true;
				break;

			default:
				console.log('\n✗ Unknown command:', command || '(none provided)');
				showHelp();
				break;
		}

		process.exit(success ? 0 : 1);
	} catch (error) {
		logger.error('Fatal CLI error:', error);
		console.error('\n✗ Fatal error:', error.message);
		process.exit(1);
	}
}

// Run the CLI
main();
