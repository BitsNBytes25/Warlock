const express = require('express');
const {validate_session} = require("../../libs/validate_session.mjs");
const {cmdRunner} = require("../../libs/cmd_runner.mjs");
const {Host} = require('../../db');

const router = express.Router();

/**
 * API endpoint to get all enabled hosts and their general information
 */
router.get('/', validate_session, (req, res) => {
	Host.findAll().then(hosts => {
		let promises = [];
		hosts.forEach(host => {
			// In one SSH session, retrieve the device hostname, mounted disks and their free/used space,
			// and OS name and version.

//echo "NETWORK_STATS:"
//cat /proc/net/dev | grep -v "lo:" | awk "NR>2 {rx+=\\$2; tx+=\\$10} END {print rx, tx}"

//echo "CONNECTIONS:"
//ss -tuln | wc -l


//echo "SYSTEM_STATS_END"

			promises.push(
				cmdRunner(
					host.ip,
					'echo "HOSTNAME: $(hostname -f)"; ' +
					'echo "KERNEL: $(uname -a)"; ' +
					'echo "UPTIME: $(uptime)"; ' +
					'echo "THREAD_COUNT: $(nproc)"; ' +
					'echo "CPU_COUNT: $(egrep "^physical id" /proc/cpuinfo | uniq | wc -l)"; ' +
					'echo "CPU_MODEL: $(egrep "^model name" /proc/cpuinfo | head -n1 | sed "s#.*: ##")"; ' +
					'echo "MEMORY_STATS: $(free | grep "^Mem:" | tr -s " " | cut -d" " -f2,3,4,5,6,7)"; ' +
					'echo "TOP_CPU_PROCESSES:"; ' +
					'ps aux --sort=-%cpu | head -6 | tail -5 | awk "{print \\$11}"; ' +
					'echo "TOP_MEMORY_PROCESSES:"; ' +
					'ps aux --sort=-%mem | head -6 | tail -5 | awk "{print \\$11}"; ' +
					'echo "OS_INFO:"; ' +
					'lsb_release -a; ' +
					'echo "DISK_INFO:"; ' +
					'df --output=source,fstype,used,avail,target -x tmpfs -x devtmpfs -x squashfs -x efivarfs',
					{ host: host.ip }
				)
			);
		});

		Promise.allSettled(promises).then(results => {
			let ret = {};
			results.forEach(result => {
				let hostInfo = {
					ip: '',
					connected: false,
					hostname: '',
					os: {
						name: '',
						title: '',
						version: '',
					},
					cpu: {
						model: '',
						count: 0,
						threads: 0,
						usage: 0,
						load1m: 0,
						load5m: 0,
						load15m: 0,
						topProcesses: [],
					},
					memory: {
						total: 0,
						used: 0,
						free: 0,
						shared: 0,
						cache: 0,
						topProcesses: [],
					},
					disks: []
				},
				host = null;

				if (result.status === 'fulfilled') {
					const lines = result.value.stdout.split('\n');
					let group = null;

					hostInfo.connected = true;
					host = result.value.extraFields.host;
					lines.forEach(line => {
						if (line.startsWith('HOSTNAME:')) {
							hostInfo.hostname = line.replace('HOSTNAME:', '').trim();
							group = null;
						}
						else if (group === null && line.startsWith('THREAD_COUNT: ')) {
							hostInfo.cpu.threads = parseInt(line.replace('THREAD_COUNT:', '').trim());
						}
						else if (group === null && line.startsWith('CPU_COUNT: ')) {
							hostInfo.cpu.count = parseInt(line.replace('CPU_COUNT:', '').trim());
						}
						else if (group === null && line.startsWith('CPU_MODEL: ')) {
							hostInfo.cpu.model = line.replace('CPU_MODEL:', '').trim();
						}
						else if (group === null && line.startsWith('UPTIME: ')) {
							const uptimeStr = line.replace('UPTIME:', '').trim();
							const loadMatch = uptimeStr.match(/load average: ([0-9.]+), ([0-9.]+), ([0-9.]+)/);
							if (loadMatch) {
								hostInfo.cpu.load1m = parseFloat(loadMatch[1]);
								hostInfo.cpu.load5m = parseFloat(loadMatch[2]);
								hostInfo.cpu.load15m = parseFloat(loadMatch[3]);
							}
						}
						else if (group === null && line.startsWith('MEMORY_STATS: ')) {
							const memParts = line.replace('MEMORY_STATS:', '').trim().split(' ');
							if (memParts.length === 6) {
								hostInfo.memory.total = parseInt(memParts[0]) * 1024;
								hostInfo.memory.used = parseInt(memParts[1]) * 1024;
								hostInfo.memory.free = parseInt(memParts[2]) * 1024;
								hostInfo.memory.shared = parseInt(memParts[3]) * 1024;
								hostInfo.memory.cache = parseInt(memParts[4]) * 1024;
							}
						}
						else if (line === 'DISK_INFO:') {
							group = 'disks';
						}
						else if (line === 'OS_INFO:') {
							group = 'os';
						}
						else if (line === 'TOP_CPU_PROCESSES:') {
							group = 'top_cpu';
						}
						else if (line === 'TOP_MEMORY_PROCESSES:') {
							group = 'top_memory';
						}
						else if (group === 'disks' && !line.startsWith('Filesystem')) {
							const parts = line.trim().split(/\s+/);
							if (parts.length === 5) {
								hostInfo.disks.push({
									filesystem: parts[0],
									fstype: parts[1],
									used: parseInt(parts[2]) * 1024,
									avail: parseInt(parts[3]) * 1024,
									size: (parseInt(parts[2]) + parseInt(parts[3])) * 1024,
									mountpoint: parts[4]
								});
							}
						}
						else if (group === 'os' && line.startsWith('Description:')) {
							hostInfo.os.title = line.replace('Description:', '').trim();
						}
						else if (group === 'os' && line.startsWith('Release:')) {
							hostInfo.os.version = line.replace('Release:', '').trim();
						}
						else if (group === 'os' && line.startsWith('Distributor ID:')) {
							hostInfo.os.name = line.replace('Distributor ID:', '').trim().toLowerCase();
						}
						else if (group === 'top_cpu') {
							if (line.trim().length > 0) {
								hostInfo.cpu.topProcesses.push(line.trim());
							}
						}
						else if (group === 'top_memory') {
							if (line.trim().length > 0) {
								hostInfo.memory.topProcesses.push(line.trim());
							}
						}
					});

					if (hostInfo.cpu.threads > 0 && hostInfo.cpu.load1m > 0) {
						hostInfo.cpu.usage = parseFloat(((hostInfo.cpu.load1m / hostInfo.cpu.threads) * 100).toFixed(2));
					}
				}
				else {
					host = result.reason.extraFields.host;
				}

				if (host) {
					hostInfo.ip = host;
					ret[host] = hostInfo;
				}
			});

			return res.json({
				success: true,
				hosts: ret
			});
		});
	});
});

module.exports = router;
