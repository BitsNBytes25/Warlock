import datetime
import os
import subprocess
import time
from typing import Union
from scriptlets.warlock.base_app import *
from scriptlets.bz_eval_tui.prompt_yn import *
from scriptlets.bz_eval_tui.prompt_text import *


class BaseService:
	"""
	Service definition and handler
	"""
	def __init__(self, service: str, game: BaseApp):
		"""
		Initialize and load the service definition
		:param file:
		"""
		self.service = service
		self.game = game
		self.configs = {}

	def get_options(self) -> list:
		"""
		Get a list of available configuration options for this service
		:return:
		"""
		opts = []
		for config in self.configs.values():
			opts.extend(list(config.options.keys()))

		# Sort alphabetically
		opts.sort()

		return opts

	def get_option_value(self, option: str) -> Union[str, int, bool]:
		"""
		Get a configuration option from the service config
		:param option:
		:return:
		"""
		for config in self.configs.values():
			if option in config.options:
				return config.get_value(option)

		print('Invalid option: %s, not present in service configuration!' % option, file=sys.stderr)
		return ''

	def get_option_default(self, option: str) -> str:
		"""
		Get the default value of a configuration option
		:param option:
		:return:
		"""
		for config in self.configs.values():
			if option in config.options:
				return config.get_default(option)

		print('Invalid option: %s, not present in service configuration!' % option, file=sys.stderr)
		return ''

	def get_option_type(self, option: str) -> str:
		"""
		Get the type of a configuration option from the service config
		:param option:
		:return:
		"""
		for config in self.configs.values():
			if option in config.options:
				return config.get_type(option)

		print('Invalid option: %s, not present in service configuration!' % option, file=sys.stderr)
		return ''

	def get_option_help(self, option: str) -> str:
		"""
		Get the help text of a configuration option from the service config
		:param option:
		:return:
		"""
		for config in self.configs.values():
			if option in config.options:
				return config.options[option][4]

		print('Invalid option: %s, not present in service configuration!' % option, file=sys.stderr)
		return ''

	def option_value_updated(self, option: str, previous_value, new_value):
		"""
		Handle any special actions needed when an option value is updated
		:param option:
		:param previous_value:
		:param new_value:
		:return:
		"""
		pass

	def set_option(self, option: str, value: Union[str, int, bool]):
		"""
		Set a configuration option in the service config
		:param option:
		:param value:
		:return:
		"""
		for config in self.configs.values():
			if option in config.options:
				previous_value = config.get_value(option)
				if previous_value == value:
					# No change
					return

				config.set_value(option, value)
				config.save()

				self.option_value_updated(option, previous_value, value)
				return

		print('Invalid option: %s, not present in service configuration!' % option, file=sys.stderr)

	def option_has_value(self, option: str) -> bool:
		"""
		Check if a configuration option has a value set in the service config
		:param option:
		:return:
		"""
		for config in self.configs.values():
			if option in config.options:
				return config.has_value(option)

		print('Invalid option: %s, not present in service configuration!' % option, file=sys.stderr)
		return False

	def prompt_option(self, option: str):
		"""
		Prompt the user to set a configuration option for the service
		:param option:
		:return:
		"""
		val_type = self.get_option_type(option)
		val = self.get_option_value(option)
		help_text = self.get_option_help(option)

		print('')
		if help_text:
			print(help_text)
		if val_type == 'bool':
			default = 'y' if val else 'n'
			val = prompt_yn(option, default)
		else:
			val = prompt_text(option, default=val, prefill=True)

		self.set_option(option, val)

	def get_player_max(self) -> Union[int, None]:
		"""
		Get the maximum player count on the server, or None if the API is unavailable
		:return:
		"""
		pass

	def get_player_count(self) -> Union[int, None]:
		"""
		Get the current player count on the server, or None if the API is unavailable
		:return:
		"""
		pass

	def get_pid(self) -> int:
		"""
		Get the PID of the running service, or 0 if not running
		:return:
		"""
		pid = subprocess.run([
			'systemctl', 'show', '-p', 'MainPID', self.service
		], stdout=subprocess.PIPE).stdout.decode().strip()[8:]

		return int(pid)

	def get_process_status(self) -> int:
		return int(subprocess.run([
			'systemctl', 'show', '-p', 'ExecMainStatus', self.service
		], stdout=subprocess.PIPE).stdout.decode().strip()[15:])

	def get_game_pid(self) -> int:
		"""
		Get the primary game process PID of the actual game server, or 0 if not running
		:return:
		"""
		pass

	def get_memory_usage(self) -> str:
		"""
		Get the formatted memory usage of the service, or N/A if not running
		:return:
		"""

		pid = self.get_game_pid()

		if pid == 0:
			return 'N/A'

		mem = subprocess.run([
			'ps', 'h', '-p', str(pid), '-o', 'rss'
		], stdout=subprocess.PIPE).stdout.decode().strip()

		if mem.isdigit():
			mem = int(mem)
			if mem >= 1024 * 1024:
				mem_gb = mem / (1024 * 1024)
				return '%.2f GB' % mem_gb
			else:
				mem_mb = mem // 1024
				return '%.0f MB' % mem_mb
		else:
			return 'N/A'

	def get_cpu_usage(self) -> str:
		"""
		Get the formatted CPU usage of the service, or N/A if not running
		:return:
		"""

		pid = self.get_game_pid()

		if pid == 0:
			return 'N/A'

		cpu = subprocess.run([
			'ps', 'h', '-p', str(pid), '-o', '%cpu'
		], stdout=subprocess.PIPE).stdout.decode().strip()

		if cpu.replace('.', '', 1).isdigit():
			return '%.0f%%' % float(cpu)
		else:
			return 'N/A'

	def get_exec_start_status(self) -> Union[dict, None]:
		"""
		Get the ExecStart status of the service
		This includes:

		* path - string: Path of the ExecStartPre command
		* arguments - string: Arguments passed to the ExecStartPre command
		* start_time - datetime: Time the ExecStartPre command started
		* stop_time - datetime: Time the ExecStartPre command stopped
		* pid - int: PID of the ExecStartPre command
		* code - string: Exit code of the ExecStartPre command
		* status - int: Exit status of the ExecStartPre command
		* runtime - int: Runtime of the ExecStartPre command in seconds

		:return:
		"""
		return self._get_exec_status('ExecStart')

	def get_exec_start_pre_status(self) -> Union[dict, None]:
		"""
		Get the ExecStart status of the service
		This includes:

		* path - string: Path of the ExecStartPre command
		* arguments - string: Arguments passed to the ExecStartPre command
		* start_time - datetime: Time the ExecStartPre command started
		* stop_time - datetime: Time the ExecStartPre command stopped
		* pid - int: PID of the ExecStartPre command
		* code - string: Exit code of the ExecStartPre command
		* status - int: Exit status of the ExecStartPre command
		* runtime - int: Runtime of the ExecStartPre command in seconds

		:return:
		"""
		return self._get_exec_status('ExecStartPre')


	def _get_exec_status(self, lookup: str) -> Union[dict, None]:
		"""
		Get the ExecStartPre status of the service
		This includes:

		* path - string: Path of the ExecStartPre command
		* arguments - string: Arguments passed to the ExecStartPre command
		* start_time - datetime: Time the ExecStartPre command started
		* stop_time - datetime: Time the ExecStartPre command stopped
		* pid - int: PID of the ExecStartPre command
		* code - string: Exit code of the ExecStartPre command
		* status - int: Exit status of the ExecStartPre command
		* runtime - int: Runtime of the ExecStartPre command in seconds

		:return:
		"""

		output = subprocess.run([
			'systemctl', 'show', '-p', lookup, self.service
		], stdout=subprocess.PIPE).stdout.decode().strip()[len(lookup)+1:]
		if output == '':
			return None

		output = output[1:-1]  # Remove surrounding {}
		parts = output.split(' ; ')
		result = {}
		for part in parts:
			if '=' not in part:
				continue
			key, val = part.split('=', 1)
			key = key.strip()
			val = val.strip()
			if key == 'path':
				result['path'] = val
			elif key == 'argv[]':
				result['arguments'] = val
			elif key == 'start_time':
				val = val[1:-1]  # Remove surrounding []
				if val == 'n/a':
					result['start_time'] = None
				else:
					result['start_time'] = datetime.datetime.strptime(val, '%a %Y-%m-%d %H:%M:%S %Z')
			elif key == 'stop_time':
				val = val[1:-1]
				if val == 'n/a':
					result['stop_time'] = None
				else:
					result['stop_time'] = datetime.datetime.strptime(val, '%a %Y-%m-%d %H:%M:%S %Z')
			elif key == 'pid':
				result['pid'] = int(val)
			elif key == 'code':
				if val == '(null)':
					result['code'] = None
				else:
					result['code'] = val
			elif key == 'status':
				if '/' in val:
					result['status'] = int(val.split('/')[0])
				else:
					result['status'] = int(val)

		if result['start_time'] and result['stop_time']:
			delta = result['stop_time'] - result['start_time']
			result['runtime'] = int(delta.total_seconds())
		else:
			result['runtime'] = 0

		return result

	def _is_enabled(self) -> str:
		"""
		Get the output of systemctl is-enabled for this service

		* enabled - Service is enabled
		* disabled - Service is disabled
		* static - Service is static and cannot be enabled/disabled
		* masked - Service is masked

		:return:
		"""
		return subprocess.run(
			['systemctl', 'is-enabled', self.service],
			stdout=subprocess.PIPE,
			stderr=subprocess.PIPE,
			check=False
		).stdout.decode().strip()

	def _is_active(self) -> str:
		"""
		Returns a string based on the status of the service:

		* active - Running
		* reloading - Running but reloading configuration
		* inactive - Stopped
		* failed - Failed to start
		* activating - Starting
		* deactivating - Stopping

		:return:
		"""
		return subprocess.run(
			['systemctl', 'is-active', self.service],
			stdout=subprocess.PIPE,
			stderr=subprocess.PIPE,
			check=False
		).stdout.decode().strip()

	def is_enabled(self) -> bool:
		"""
		Check if this service is enabled in systemd
		:return:
		"""
		return self._is_enabled() == 'enabled'

	def is_running(self) -> bool:
		"""
		Check if this service is currently running
		:return:
		"""
		return self._is_active() == 'active'

	def is_starting(self) -> bool:
		"""
		Check if this service is currently starting
		:return:
		"""
		return self._is_active() == 'activating'

	def is_stopping(self) -> bool:
		"""
		Check if this service is currently stopping
		:return:
		"""
		return self._is_active() == 'deactivating'

	def is_api_enabled(self) -> bool:
		"""
		Check if an API is available for this service
		:return:
		"""
		return False

	def enable(self):
		"""
		Enable this service in systemd
		:return:
		"""
		if os.geteuid() != 0:
			print('ERROR - Unable to enable game service unless run with sudo', file=sys.stderr)
			return
		subprocess.run(['systemctl', 'enable', self.service])

	def disable(self):
		"""
		Disable this service in systemd
		:return:
		"""
		if os.geteuid() != 0:
			print('ERROR - Unable to disable game service unless run with sudo', file=sys.stderr)
			return
		subprocess.run(['systemctl', 'disable', self.service])

	def print_logs(self, lines: int = 20):
		"""
		Print the latest logs from this service
		:param lines:
		:return:
		"""
		subprocess.run(['journalctl', '-u', self.service, '-n', str(lines), '--no-pager'])

	def get_logs(self, lines: int = 20) -> str:
		"""
		Get the latest logs from this service
		:param lines:
		:return:
		"""
		return subprocess.run(
			['journalctl', '-u', self.service, '-n', str(lines), '--no-pager'],
			stdout=subprocess.PIPE
		).stdout.decode()

	def post_start(self):
		"""
		Perform the necessary operations for after a game has started
		:return:
		"""
		pass

	def start(self):
		"""
		Start this service in systemd
		:return:
		"""
		if self.is_running():
			print('Game is currently running!', file=sys.stderr)
			return

		if self.is_starting():
			print('Game is currently starting!', file=sys.stderr)
			return

		if os.geteuid() != 0:
			print('ERROR - Unable to stop game service unless run with sudo', file=sys.stderr)

		try:
			print('Starting game via systemd, please wait a minute...')
			start_timer = time.time()
			subprocess.run(['systemctl', 'start', self.service])

			ready = False
			counter = 0
			print('loading...')
			while counter < 240:
				counter += 1
				pid = self.get_pid()
				exec_status = self.get_process_status()

				if exec_status != 0:
					self.print_logs()
					print('Game failed to start, ExecMainStatus: %s' % str(exec_status), file=sys.stderr)
					return

				if pid == 0:
					self.print_logs()
					print('Game failed to start, no PID found.', file=sys.stderr)
					return

				memory = self.get_memory_usage()
				cpu = self.get_cpu_usage()
				seconds_elapsed = round(time.time() - start_timer)
				since_minutes = str(seconds_elapsed // 60)
				since_seconds = seconds_elapsed % 60
				if since_seconds < 10:
					since_seconds = '0' + str(since_seconds)
				else:
					since_seconds = str(since_seconds)

				if self.is_api_enabled():
					players = self.get_player_count()
					if players is not None:
						ready = True
						api_status = 'CONNECTED'
					else:
						api_status = 'waiting'
				else:
					api_status = 'not enabled'
					# API is not enabled so just assume ready after some time
					if seconds_elapsed >= 60:
						ready = True

				print(
					'\033[1A\033[K Time: %s, PID: %s, CPU: %s, Memory: %s, API: %s' % (
						since_minutes + ':' + since_seconds,
						str(pid),
						cpu,
						memory,
						api_status
					)
				)

				if ready:
					print('Game has started successfully!')
					break
				time.sleep(.5)
		except KeyboardInterrupt:
			print('Cancelled startup wait check, (game is probably still started)')

	def pre_stop(self):
		"""
		Perform operations necessary for safely stopping a server

		Called automatically via systemd
		:return:
		"""
		pass

	def stop(self):
		"""
		Stop this service in systemd
		:return:
		"""
		if os.geteuid() != 0:
			print('ERROR - Unable to stop game service unless run with sudo', file=sys.stderr)
			return

		print('Stopping server, please wait...')
		subprocess.run(['systemctl', 'stop', self.service])

	def restart(self):
		"""
		Restart this service in systemd
		:return:
		"""
		if not self.is_running():
			print('Game is not currently running!', file=sys.stderr)
			return

		self.stop()
		self.start()
