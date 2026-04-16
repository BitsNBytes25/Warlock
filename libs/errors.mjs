/**
 * Error handler for 400 Bad Request errors.
 */
export class BadRequestError extends Error {
	constructor(message) {
		super(message);
		this.status = 400;

		let titles = [
			'Noob Move: Bad Request',
			'Skill Check Failed: Try Again',
			'Inventory Error: Invalid Item',
			'Out of Bounds: Request Not Allowed',
			'Glitch Detected: Fix Your Input'
		];
		this.title = titles[Math.floor(Math.random() * titles.length)];
	}
}

/**
 * Error handler for 401 Unauthorized errors.
 */
export class InvalidCredentialsError extends Error {
	constructor(message) {
		super(message);
		this.status = 401;

		let titles = [
			'Locked Out: Login Required',
			'Stealth Failed: Credentials Needed',
			'Access Denied: Level Too Low',
			'Unauthorized: You Need a Key',
			'Checkpoint Blocked: Authenticate First'
		];
		this.title = titles[Math.floor(Math.random() * titles.length)];
	}
}

/**
 * Error handler for 403 Forbidden errors.
 */
export class ForbiddenError extends Error {
	constructor(message) {
		super(message);
		this.status = 403;

		let titles = [
			'Forbidden Zone: Access Blocked',
			'You Shall Not Pass: Permission Denied',
			'Secret Area: Entry Restricted',
			'Gate Closed: Not for Your Class',
			'Boss Room Locked: Insufficient Privileges'
		];
		this.title = titles[Math.floor(Math.random() * titles.length)];
	}
}

/**
 * Error handler for 404 Not Found errors.
 */
export class NotFoundError extends Error {
	constructor(message) {
		super(message);
		this.status = 404;

		let titles = [
			'Quest Not Found: Try Another Path',
			'Lost in the Dungeon: Page Missing',
			'NPC Missing: Resource Not Found',
			'Map Not Discovered Yet',
			'Loot Box Empty: Nothing Here'
		];
		this.title = titles[Math.floor(Math.random() * titles.length)];
	}
}

/**
 * Error handler for 409 Conflict errors.
 */
export class ConflictError extends Error {
	constructor(message) {
		super(message);
		this.status = 409;

		let titles = [
			'PvP Zone: Conflict Detected',
			'Boss Fight: State Clash',
			'Party Disbanded: Resource in Use',
			'Inventory Clash: Item Already Exists',
			'Quest Log Full: Cannot Proceed'
		];
		this.title = titles[Math.floor(Math.random() * titles.length)];
	}
}

/**
 * Error handler for 412 Precondition Failed errors.
 */
export class PreconditionFailedError extends Error {
	constructor(message) {
		super(message);
		this.status = 412;

		let titles = [
			'Quest Giver Unavailable: Precondition Failed',
			'Level Requirement Not Met',
			'Buff Missing: Action Blocked',
			'Checkpoint Not Reached',
			'Prerequisite Quest Incomplete'
		];
		this.title = titles[Math.floor(Math.random() * titles.length)];
	}
}

/**
 * Error handler for 422 Unprocessable Entity errors.
 */
export class UnprocessableEntityError extends Error {
	constructor(message) {
		super(message);
		this.status = 422;

		let titles = [
			'Failed the Skill Check: Unprocessable',
			'Combo Move Not Recognized',
			'Crafting Failed: Invalid Recipe',
			'Character Build Not Supported',
			'Action Not Allowed: Try a Different Approach'
		];
		this.title = titles[Math.floor(Math.random() * titles.length)];
	}
}

/**
 * Error handler for 500 Internal Server Error errors.
 */
export class InternalServerError extends Error {
	constructor(message) {
		super(message);
		this.status = 500;

		let titles = [
			'Critical Hit: Server Down',
			'Game Crashed: Try Again Later',
			'Unexpected Boss Fight: Internal Error',
			'Server Rolled a 1: Oops',
			'Respawn Failed: Something Broke'
		];
		this.title = titles[Math.floor(Math.random() * titles.length)];
	}
}
