# Warlock CLI - Quick Reference

## Commands at a Glance

```bash
# List all users
npm run cli -- list-users

# Create user (with inline password)
npm run cli -- create-user <username> <password>

# Create user (interactive password prompt)
npm run cli -- create-user <username>

# Reset password
npm run cli -- reset-password <username> <new_password>

# Reset password (interactive)
npm run cli -- reset-password <username>

# Reset 2FA (forces re-setup on next login)
npm run cli -- reset-2fa <username>

# Delete user (requires "yes" confirmation)
npm run cli -- delete-user <username>

# Show help
npm run cli -- help
npm run cli -- --help
npm run cli -- -h
```

## Common Recovery Scenarios

### I forgot my password
```bash
npm run cli -- reset-password myusername NewSecurePassword123
```

### I lost my 2FA device
```bash
npm run cli -- reset-2fa myusername
```

### I lost both password and 2FA
```bash
npm run cli -- reset-password myusername NewPassword123
npm run cli -- reset-2fa myusername
```

### Create emergency recovery account
```bash
npm run cli -- create-user recovery_admin EmergencyPass123
```

## Requirements

- Password must be at least 8 characters
- Username must be unique (no duplicates)
- Node.js 24.0.0+ installed
- Database file must be accessible

## Using in Scripts

```bash
#!/bin/bash

# Batch create users
for user in user1 user2 user3; do
  npm run cli -- create-user "$user" "Password$(date +%s)"
done

# With error checking
if npm run cli -- reset-password admin NewPassword123; then
  echo "Password reset successful"
else
  echo "Password reset failed"
  exit 1
fi

# Piped input (non-interactive)
echo "yes" | npm run cli -- delete-user tempuser
```

## Exit Codes

- `0` = Success
- `1` = Failure

Use in scripts: `npm run cli -- command && echo "OK" || echo "ERROR"`

## Password Best Practices

- Avoid passwords in command history: use interactive mode
- Use strong passwords: mix uppercase, lowercase, numbers, symbols
- Example: `Warlock$2026#Management`

## Security Notes

- Filesystem access to `cli.js` and `warlock.sqlite` is the only security layer
- Restrict access to Warlock data directory
- All operations are logged
- Use interactive mode for sensitive operations (hides from history)

---

For detailed documentation, see: `CLI_GUIDE.md`

