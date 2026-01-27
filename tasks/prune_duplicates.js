#!/usr/bin/env node

/**
 * Prune duplicate Users and Hosts from the database.
 *
 * This script finds duplicate entries in the Users and Hosts tables,
 * merges their data (keeping the record with the lowest ID),
 * and removes the duplicates.
 *
 * Usage:
 *   npm run prune-duplicates          # Dry run (shows what would be done)
 *   npm run prune-duplicates -- --apply  # Actually perform the pruning
 *   npm run prune-duplicates -- -y       # Same as --apply
 */

const { sequelize, User, Host } = require('../db.js');

const args = process.argv.slice(2);
const applyChanges = args.includes('--apply') || args.includes('-y');

/**
 * Find and process duplicate Users by normalized username
 */
async function pruneDuplicateUsers() {
	const users = await User.findAll({ order: [['id', 'ASC']] }),
		userGroups = {},
		duplicateGroups = [];

	// Group users by normalized username (lowercase, trimmed)
	users.forEach(user => {
		const normalized = user.username.trim().toLowerCase();
		if (!userGroups[normalized]) {
			userGroups[normalized] = [];
		}
		userGroups[normalized].push(user);
	});

	// Find groups with duplicates
	Object.entries(userGroups).forEach(([normalized, group]) => {
		if (group.length > 1) {
			duplicateGroups.push({ normalized, users: group });
		}
	});

	if (duplicateGroups.length === 0) {
		console.log('✓ No duplicate users found.');
		return 0;
	}

	console.log(`Found ${duplicateGroups.length} duplicate user group(s):\n`);

	let totalDeleted = 0;

	for (const { normalized, users: group } of duplicateGroups) {
		const keeper = group[0], // Keep the one with lowest ID
			duplicates = group.slice(1);

		console.log(`  Username: "${normalized}"`);
		console.log(`    Keeper:     ID=${keeper.id}, username="${keeper.username}", password=${keeper.password ? 'set' : 'null'}, 2fa=${keeper.secret_2fa ? 'set' : 'null'}`);

		// Merge data: if keeper is missing fields, take from duplicates
		let mergedData = {};
		if (!keeper.password) {
			const withPassword = duplicates.find(u => u.password);
			if (withPassword) {
				mergedData.password = withPassword.password;
				console.log(`    Merging password from ID=${withPassword.id}`);
			}
		}
		if (!keeper.secret_2fa) {
			const with2fa = duplicates.find(u => u.secret_2fa);
			if (with2fa) {
				mergedData.secret_2fa = with2fa.secret_2fa;
				console.log(`    Merging 2FA secret from ID=${with2fa.id}`);
			}
		}

		duplicates.forEach(dup => {
			console.log(`    Duplicate:  ID=${dup.id}, username="${dup.username}", password=${dup.password ? 'set' : 'null'}, 2fa=${dup.secret_2fa ? 'set' : 'null'} [WILL DELETE]`);
		});

		if (applyChanges) {
			// Update keeper with merged data if any
			if (Object.keys(mergedData).length > 0) {
				await keeper.update(mergedData);
			}

			// Delete duplicates
			for (const dup of duplicates) {
				await dup.destroy();
				totalDeleted++;
			}
		}

		console.log('');
	}

	if (!applyChanges) {
		console.log(`Would delete ${duplicateGroups.reduce((sum, g) => sum + g.users.length - 1, 0)} duplicate user(s).\n`);
	} else {
		console.log(`Deleted ${totalDeleted} duplicate user(s).\n`);
	}

	return totalDeleted;
}

/**
 * Find and process duplicate Hosts by normalized IP
 */
async function pruneDuplicateHosts() {
	const hosts = await Host.findAll({ order: [['id', 'ASC']] }),
		hostGroups = {},
		duplicateGroups = [];

	// Group hosts by normalized IP (trimmed, lowercase for hostname compatibility)
	hosts.forEach(host => {
		const normalized = host.ip.trim().toLowerCase();
		if (!hostGroups[normalized]) {
			hostGroups[normalized] = [];
		}
		hostGroups[normalized].push(host);
	});

	// Find groups with duplicates
	Object.entries(hostGroups).forEach(([normalized, group]) => {
		if (group.length > 1) {
			duplicateGroups.push({ normalized, hosts: group });
		}
	});

	if (duplicateGroups.length === 0) {
		console.log('✓ No duplicate hosts found.');
		return 0;
	}

	console.log(`Found ${duplicateGroups.length} duplicate host group(s):\n`);

	let totalDeleted = 0;

	for (const { normalized, hosts: group } of duplicateGroups) {
		const keeper = group[0], // Keep the one with lowest ID
			duplicates = group.slice(1);

		console.log(`  Host IP: "${normalized}"`);
		console.log(`    Keeper:     ID=${keeper.id}, ip="${keeper.ip}"`);

		duplicates.forEach(dup => {
			console.log(`    Duplicate:  ID=${dup.id}, ip="${dup.ip}" [WILL DELETE]`);
		});

		if (applyChanges) {
			// Delete duplicates
			for (const dup of duplicates) {
				await dup.destroy();
				totalDeleted++;
			}
		}

		console.log('');
	}

	if (!applyChanges) {
		console.log(`Would delete ${duplicateGroups.reduce((sum, g) => sum + g.hosts.length - 1, 0)} duplicate host(s).\n`);
	} else {
		console.log(`Deleted ${totalDeleted} duplicate host(s).\n`);
	}

	return totalDeleted;
}

/**
 * Main execution
 */
async function main() {
	console.log('='.repeat(60));
	console.log('Warlock Database Duplicate Pruner');
	console.log('='.repeat(60));
	console.log('');

	if (!applyChanges) {
		console.log('⚠️  DRY RUN MODE - No changes will be made');
		console.log('   Run with --apply or -y to actually delete duplicates\n');
	} else {
		console.log('✓ APPLY MODE - Changes will be committed to database\n');
	}

	try {
		await sequelize.authenticate();
		console.log('✓ Database connection established\n');

		// Run within a transaction for safety
		await sequelize.transaction(async (transaction) => {
			console.log('--- Processing Users Table ---\n');
			const usersDeleted = await pruneDuplicateUsers();

			console.log('--- Processing Hosts Table ---\n');
			const hostsDeleted = await pruneDuplicateHosts();

			console.log('='.repeat(60));
			console.log('Summary:');
			console.log(`  Users: ${usersDeleted} duplicate(s) ${applyChanges ? 'deleted' : 'would be deleted'}`);
			console.log(`  Hosts: ${hostsDeleted} duplicate(s) ${applyChanges ? 'deleted' : 'would be deleted'}`);
			console.log('='.repeat(60));

			if (!applyChanges) {
				// Rollback transaction in dry-run mode
				throw new Error('DRY_RUN_ROLLBACK');
			}
		});

		if (applyChanges) {
			console.log('\n✓ Changes committed successfully!');
		} else {
			console.log('\n✓ Dry run completed. Use --apply to commit changes.');
		}

		process.exit(0);
	} catch (error) {
		if (error.message === 'DRY_RUN_ROLLBACK') {
			console.log('\n✓ Dry run completed. Use --apply to commit changes.');
			process.exit(0);
		} else {
			console.error('\n✗ Error:', error.message);
			process.exit(1);
		}
	}
}

// Run the script
main();

