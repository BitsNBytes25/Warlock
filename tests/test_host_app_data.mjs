import {test} from 'node:test';
import assert from 'node:assert';


test('HostAppData v1 API', async (t) => {
	// Mock the module before importing the function under test
	await t.mock.module('../libs/cmd_runner.mjs', {
		namedExports: {
			cmdRunner: async () => ({
				stdout: `usage: manage.py [-h] [--service SERVICE] [--pre-stop] [--post-start] [--stop]...

options:
  -h, --help            show this help message and exit
  --service SERVICE     Specify the service instance to manage (default: ALL)
  --pre-stop            Send notifications to game players and Discord and save the world
  --post-start          Send notifications to game players and Discord after starting the server`,
				stderr: ''
			})
		}
	});

	// Import AFTER mocking so it picks up the mock
	const { HostAppData } = await import('../libs/host_app_data.mjs');

	const host = new HostAppData('testhost', '/path/to/app');
	await host.init();
	assert.strictEqual(host.options.includes('pre-stop'), true, 'Expected options to include "pre-stop"');
	assert.strictEqual(host.options.includes('post-start'), true, 'Expected options to include "post-start"');
	assert.strictEqual(host.version, 1);
	assert.strictEqual(host.getCommandString('pre-stop'), '/path/to/app/manage.py --pre-stop');
});

test('HostAppData v2 API', async (t) => {
	// Mock the module before importing the function under test
	await t.mock.module('../libs/cmd_runner.mjs', {
		namedExports: {
			cmdRunner: async () => ({
				stdout: `
Usage: manage.py [OPTIONS] COMMAND [ARGS]...

╭─ Options ─────────────────────────────────────────────────────────────────╮
│ --debug                 --no-debug      Enable debug logging output       │
│                                         [default: no-debug]               │
│ --install-completion                    Install completion for the        │
│                                         current shell.                    │
│ --show-completion                       Show completion for the current   │
│                                         shell, to copy it or customize    │
│                                         the installation.                 │
│ --help                                  Show this message and exit.       │
╰───────────────────────────────────────────────────────────────────────────╯
╭─ Commands ────────────────────────────────────────────────────────────────╮
│ start            Start a service instance, or all instances if no service │
│                  is specified                                             │
│ restart          Restart a service instance, or all instances if no       │
│                  service is specified                                     │
│ delayed-restart  Issue a delayed restart, providing 1 hour for players to │
│                  disconnect before restarting`,
				stderr: ''
			})
		}
	});

	// Import AFTER mocking so it picks up the mock
	const { HostAppData } = await import('../libs/host_app_data.mjs');

	const host = new HostAppData('testhost', '/path/to/app');
	await host.init();
	console.log(host.options);
	assert.strictEqual(host.options.includes('start'), true, 'Expected options to include start');
	assert.strictEqual(host.options.includes('restart'), true, 'Expected options to include restart');
	assert.strictEqual(host.options.includes('delayed-restart'), true, 'Expected options to include delayed-restart');
	assert.strictEqual(host.options.length, 3, 'Expected exactly 3 options');
	assert.strictEqual(host.version, 2, 'Expected version to be 2');
	assert.strictEqual(host.getCommandString('start', '--service', 'test'), '/path/to/app/manage.py start --service test');
});
