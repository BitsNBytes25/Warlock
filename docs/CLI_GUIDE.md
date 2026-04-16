# Warlock CLI - User Management Recovery Tool

The Warlock CLI is a command-line interface for managing users without requiring web authentication. It's designed as a recovery tool for system operators who have lost access to their accounts due to forgotten passwords or locked-out 2FA configurations.

## Overview

The CLI provides direct database access to user management operations, bypassing the web interface and authentication layer. This makes it an essential recovery tool while maintaining the security of the application through filesystem-level access controls.

**Security Note:** Filesystem access to the `cli.js` script is the security boundary. Restrict access to this file and the `warlock.sqlite` database to authorized users only.

## Installation

The CLI is included with Warlock and requires no additional installation. It uses the same Node.js environment and dependencies as the main application.

## Usage

All CLI commands use the following format:

```bash
npm run cli -- <command> [arguments]
```

## Commands

### list-users

List all users currently registered in the system.

```bash
npm run cli -- list-users
```

**Output:**
```
╔════════════════════════════════════════════════════════════════╗
║                         Users in System                        ║
╠════════════════════════════════════════════════════════════════╣
║ ID │ Username         │ 2FA │ Created                          ║
╠════════════════════════════════════════════════════════════════╣
║ 1  │ admin            │ ✓   │ 2025-11-21T10:20:24              ║
║ 2  │ operator         │ ✗   │ 2026-01-15T14:30:00              ║
╚════════════════════════════════════════════════════════════════╝
```

The **2FA** column shows:
- `✓` = 2FA is enabled and configured
- `✗` = 2FA is not configured

---

### create-user

Create a new user account. Password can be provided as an argument or entered interactively.

**With inline password (visible in shell history):**
```bash
npm run cli -- create-user username password123
```

**With interactive password prompt (hidden input):**
```bash
npm run cli -- create-user username
# You will be prompted: Enter password (minimum 8 characters):
```

**Requirements:**
- Username must be non-empty
- Password must be at least 8 characters long
- Username must be unique (no duplicates)

**Output on success:**
```
✓ User "username" created successfully (ID: 3)
  User must configure 2FA on first login
```

---

### reset-password

Reset a user's password. This is useful for account recovery or when a password is forgotten.

**With inline password (visible in shell history):**
```bash
npm run cli -- reset-password username newpassword123
```

**With interactive password prompt (hidden input):**
```bash
npm run cli -- reset-password username
# You will be prompted: Enter new password (minimum 8 characters):
```

**Requirements:**
- User must exist in the system
- Password must be at least 8 characters long

**Output on success:**
```
✓ Password reset for user "username"
```

---

### reset-2fa

Clear the 2FA authentication for a user. This is essential if a user loses access to their 2FA device or account becomes locked out.

```bash
npm run cli -- reset-2fa username
```

**Effect:**
- Clears the stored 2FA secret
- User will be prompted to set up 2FA again on next login
- Temporarily allows login without 2FA until reconfigured

**Output on success:**
```
✓ 2FA reset for user "username"
  User must re-setup 2FA on next login
```

---

### delete-user

Permanently delete a user account. This action requires confirmation to prevent accidental deletion.

```bash
npm run cli -- delete-user username
```

**Confirmation prompt:**
```
⚠️  Permanently delete user "username"? Type "yes" to confirm:
```

**Requirements:**
- User must exist in the system
- You must type "yes" (case-insensitive) to confirm deletion
- Any other response cancels the operation

**Output on success:**
```
✓ User "username" deleted
```

---

### help

Display the CLI help message with all available commands and usage examples.

```bash
npm run cli -- help
npm run cli -- --help
npm run cli -- -h
```

## Recovery Scenarios

### Scenario 1: Forgotten Password

If you've forgotten your password and cannot log in:

```bash
npm run cli -- reset-password your_username NewSecurePassword123
```

Then log in with your username and the new password.

### Scenario 2: Locked Out Due to 2FA

If you've lost access to your 2FA device (phone, authenticator app, etc.) and cannot log in:

```bash
npm run cli -- reset-2fa your_username
```

Then log in with your username and password. You'll be guided through 2FA setup again using a new device.

### Scenario 3: Locked Out Due to Both Password and 2FA

If both your password and 2FA access are lost:

```bash
# Reset password first
npm run cli -- reset-password your_username NewSecurePassword123

# Then reset 2FA
npm run cli -- reset-2fa your_username

# Now log in normally and set up new 2FA
```

### Scenario 4: Create Emergency Access Account

If the primary admin account is unavailable, create a temporary recovery account:

```bash
npm run cli -- create-user emergency_admin EmergencyPassword789
```

Use this account to recover or manage the system, then delete it when no longer needed:

```bash
npm run cli -- delete-user emergency_admin
```

## Password Requirements

- **Minimum length:** 8 characters
- **Recommended:** Use strong passwords with a mix of uppercase, lowercase, numbers, and special characters
- **Example strong password:** `Warlock$2026#SecurePass`

## Security Considerations

### Inline Passwords vs Interactive Input

**Inline (Arguments):**
```bash
npm run cli -- create-user alice MyPassword123
```
- ✓ Easier for scripting/automation
- ✗ Password visible in shell history and process list
- Use only in isolated/testing environments

**Interactive (Prompt):**
```bash
npm run cli -- create-user alice
# Prompted for password with hidden input
```
- ✓ Password hidden from history and process visibility
- ✓ More secure for production use
- Recommended for sensitive operations

### Database Access

The CLI directly accesses the SQLite database file (`warlock.sqlite`). Ensure:
- Database file permissions are restricted (e.g., `chmod 600`)
- Only authorized users can access the Warlock data directory
- Database backups are stored securely

### Audit Trail

All CLI operations are logged to the application logger. Check logs for:
- User creation/deletion
- Password resets
- 2FA modifications

Review logs regularly: `grep "cli" warlock.log` (if applicable)

## Troubleshooting

### Error: "User not found"

The specified username doesn't exist. Check the spelling or list all users:

```bash
npm run cli -- list-users
```

### Error: "Username already exists"

You're trying to create a user with a name that's already taken. Choose a different username or list existing users:

```bash
npm run cli -- list-users
```

### Error: "Password must be at least 8 characters"

The provided password is too short. Use a password with 8 or more characters:

```bash
npm run cli -- reset-password username NewPassword123
```

### Error: "Database connection failed"

The Warlock application isn't properly installed or the database file is corrupted. Check:
- Node.js is installed and version 24.0.0 or higher
- `warlock.sqlite` file exists in the application root
- Sufficient disk space available
- File permissions allow read/write access

### Exit codes

- `0` = Command executed successfully
- `1` = Command failed or was cancelled

Use in scripts: `npm run cli -- command && echo "Success" || echo "Failed"`

## Advanced Usage

### Batch Operations (Scripting)

Create multiple users from a script:

```bash
#!/bin/bash

users=(
  "user1:Password1234"
  "user2:Password5678"
  "user3:Password9012"
)

for user_pass in "${users[@]}"; do
  IFS=':' read -r username password <<< "$user_pass"
  npm run cli -- create-user "$username" "$password"
  echo "Created user: $username"
done
```

### Automated Recovery

Reset password and 2FA in one script:

```bash
#!/bin/bash

USERNAME="admin"
NEW_PASSWORD="RecoveryPassword123"

echo "Resetting account for: $USERNAME"
npm run cli -- reset-password "$USERNAME" "$NEW_PASSWORD"
npm run cli -- reset-2fa "$USERNAME"

echo "✓ Account recovered. New password: $NEW_PASSWORD"
echo "✓ User must reconfigure 2FA on next login"
```

### Piped Input (Non-Interactive Mode)

For automation, input can be piped instead of interactive prompts:

```bash
# Create user with piped input
echo "InteractivePassword123" | npm run cli -- create-user alice

# Confirm deletion
echo "yes" | npm run cli -- delete-user temporary_user
```

## Related Documentation

- [Warlock README](../README.md) - Main documentation
- [Installation Guide](install.md) - How to install Warlock
- [Database Schema](../db.js) - User model definition
- [User API](../routes/api/users.js) - Web API for user management

## Support

For issues or questions about the CLI:

1. Check this guide for your specific scenario
2. Review the help message: `npm run cli -- help`
3. Check application logs for error details
4. Verify your system meets [installation requirements](install.md)

---

**Last Updated:** March 2026  
**CLI Version:** 1.0  
**Compatible with:** Warlock 1.2.0+

