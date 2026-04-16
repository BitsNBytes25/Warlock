# Command Performance Monitoring

## Overview

The Warlock application includes an optional command performance profiler that tracks all SSH command executions, including the host, command details, execution time, and status. This feature is useful for identifying slow operations, bottlenecks, and monitoring system performance over time.

## Enabling the Profiler

The profiler is disabled by default. Enable it using the `WARLOCK_PROFILE` environment variable:

### Development Mode with Profiling
```bash
npm run dev:profile
```
This runs the application with nodemon in development mode with profiling enabled.

### Production Mode with Profiling
```bash
npm run start:profile
```
This runs the application in production mode with profiling enabled.

### Manual Environment Variable
```bash
WARLOCK_PROFILE=1 npm start
WARLOCK_PROFILE=true npm start
```

## Output Format

When profiling is enabled, command metrics are recorded in a CSV file: `warlock-profile.csv`

### CSV Structure
The CSV file has the following columns:

| Column      | Type     | Description                        |
|-------------|----------|------------------------------------|
| timestamp   | ISO 8601 | When the command started execution |
| host        | string   | Target host IP or hostname         |
| duration_ms | integer  | Execution time in milliseconds     |
| status      | string   | Either `success` or `error`        |
| command     | string   | The command that was executed      |

### Example CSV Output
```csv
timestamp,host,duration_ms,status,command
2026-02-27T14:32:45.123Z,192.168.1.100,245,success,"ps aux | grep node"
2026-02-27T14:32:47.456Z,192.168.1.101,89,success,"df -h"
2026-02-27T14:32:49.789Z,localhost,156,success,"systemctl status warlock"
2026-02-27T14:33:05.012Z,192.168.1.100,2341,error,"cat /var/log/syslog"
```

## File Location

The profiler output file is created at:
```
/path/to/warlock/warlock-profile.csv
```

The file is created in the application's root directory when the profiler is first initialized. If the file already exists, new metrics are appended to it.

## Profiler Behavior

### Initialization
- When the application starts with `WARLOCK_PROFILE=1`, the profiler module is initialized
- If `warlock-profile.csv` doesn't exist, it's created with CSV headers
- A log message is printed: `Command profiler enabled - metrics will be written to warlock-profile.csv`

### Recording Metrics
- Every command executed via `cmdRunner()` is tracked
- Execution time is measured from the start of the command to completion (including SSH connection time)
- Both successful and failed commands are recorded
- Metrics are appended to the CSV file; the file grows over time

### Performance Impact
- Recording metrics has minimal performance overhead (simple timestamp recording)
- File I/O uses synchronous append operations; this may impact performance under very high command volumes
- Profiling can be disabled at any time by not setting the environment variable

## Implementation Details

### Module: `libs/cmd_profiler.mjs`

**Exported Functions:**

#### `initializeProfiler()`
Initializes the profiler by creating the CSV file with headers if it doesn't exist.

#### `recordMetric(host, cmd, durationMs, status = 'success')`
Records a single command execution metric to the profiler CSV.

**Parameters:**
- `host` (string): Target host IP or hostname
- `cmd` (string): The command that was executed
- `durationMs` (number): Execution time in milliseconds
- `status` (string): Either `'success'` or `'error'`

#### `isEnabled()`
Returns a boolean indicating whether the profiler is currently enabled.

#### `getProfilerPath()`
Returns the absolute path to the profiler CSV file.

### Integration in `libs/cmd_runner.mjs`

The `cmdRunner()` function automatically records metrics:
- Timing starts when `cmdRunner()` is called
- If a host validation error occurs, it's recorded as an `error` status
- If command execution fails, it's recorded as an `error` status
- If command execution succeeds, it's recorded as a `success` status
- Metrics are recorded regardless of whether caching is enabled

## Use Cases

### Performance Analysis
Track which commands are slow and which hosts take longer to respond.

### Capacity Planning
Identify patterns in command execution times to help with resource allocation decisions.

### Debugging
Determine if slowness is related to specific hosts, commands, or time periods.

### Auditing
Maintain a historical log of all commands executed on the system.

## CSV File Management

### Viewing Results
You can view the profiler output directly:
```bash
cat warlock-profile.csv
tail -f warlock-profile.csv  # Watch in real-time
```

### Analyzing with Tools
The CSV format is compatible with common analysis tools:
```bash
# View with column formatting
column -t -s ',' warlock-profile.csv

# Count commands by host
cut -d ',' -f 2 warlock-profile.csv | sort | uniq -c

# Average duration by host
awk -F ',' 'NR>1 {sum[$2]+=$3; count[$2]++} END {for (h in sum) print h, sum[h]/count[h]}' warlock-profile.csv

# Find slowest commands
sort -t ',' -k3 -nr warlock-profile.csv | head -20
```

### Archiving
Since the CSV file grows over time, you may want to periodically archive it:
```bash
# Back up and reset the profiler
cp warlock-profile.csv warlock-profile.$(date +%Y%m%d-%H%M%S).csv
# Remove the old file (it will be recreated when the app starts)
rm warlock-profile.csv
```

## Troubleshooting

### Profiler Not Creating File
- Ensure `WARLOCK_PROFILE` is set to `1` or `true`
- Check that the application has write permissions in its root directory
- Look for error messages in the application logs

### Missing Metrics
- Some metrics may not be recorded if the command fails at the host validation stage
- Cache hits do not record metrics (only actual command execution is tracked)

### File Size Growing Too Large
- Consider archiving the file periodically
- The profiler has no built-in rotation; you need to manage this manually
- For production deployments, consider a separate log management solution

## Future Enhancements

Potential improvements for the profiler system:
- Automatic CSV rotation when file size reaches a threshold
- Command sanitization to exclude sensitive data (passwords, tokens)
- Metrics aggregation and summary reporting
- Integration with metrics database for historical analysis
- Performance alerting based on execution time thresholds

