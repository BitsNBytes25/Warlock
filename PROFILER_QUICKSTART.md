# Quick Start: Command Performance Profiler

## Enable Profiling

### Development
```bash
npm run dev:profile
```

### Production
```bash
npm run start:profile
```

## View Results

```bash
# Real-time viewing
tail -f warlock-profile.csv

# Pretty print with column formatting
column -t -s ',' warlock-profile.csv

# View last 20 entries
tail -20 warlock-profile.csv
```

## Common Analytics

### Find Slowest Commands
```bash
sort -t ',' -k4 -nr warlock-profile.csv | head -20
```

### Average Duration by Host
```bash
awk -F ',' 'NR>1 {sum[$2]+=$4; count[$2]++} END {for (h in sum) printf "%s: %.0fms\n", h, sum[h]/count[h]}' warlock-profile.csv
```

### Count Commands by Host
```bash
awk -F ',' 'NR>1 {count[$2]++} END {for (h in count) print h, count[h]}' warlock-profile.csv | sort -k2 -rn
```

### Filter by Status
```bash
# Show only errors
grep ',error$' warlock-profile.csv

# Show only successes
grep ',success$' warlock-profile.csv
```

### Commands by Timeframe
```bash
# Commands from a specific date (e.g., 2026-02-27)
grep '2026-02-27' warlock-profile.csv
```

## CSV Format

```
timestamp,host,command,duration_ms,status
2026-02-27T14:32:45.123Z,192.168.1.100,"ps aux | grep node",245,success
```

- **timestamp**: ISO 8601 format (UTC)
- **host**: Target hostname or IP
- **command**: Full command executed (quoted)
- **duration_ms**: Execution time in milliseconds
- **status**: `success` or `error`

## File Location

`/path/to/warlock/warlock-profile.csv`

The file is created automatically when profiler is initialized.

## Archiving Old Data

```bash
# Back up the profiler file
mv warlock-profile.csv warlock-profile.backup.csv

# File will be recreated on next app start
```

For more details, see `docs/performance-monitoring.md`

