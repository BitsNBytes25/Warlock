import datetime
import json
import os
import shutil
import sys
from urllib import request
from urllib import error as urllib_error
from typing import Union
from scriptlets.bz_eval_tui.prompt_yn import *
from scriptlets.bz_eval_tui.prompt_text import *


class BaseApp:
	"""
	Game application manager
	"""

	def __init__(self):
		self.name = ''
		"""
		:type str:
		Short name for this game
		"""

		self.desc = ''
		"""
		:type str:
		Description / full name of this game
		"""

		self.services = []
		"""
		:type list<str>:
		List of available services (instances) for this game
		"""

		self._svcs = None
		"""
		:type list<BaseService>:
		Cached list of service instances for this game
		"""

		self.configs = {}
		"""
		:type dict<str, BaseConfig>: 
		Dictionary of configuration files for this game
		"""

		self.configured = False

	def load(self):
		"""
		Load the configuration files
		:return:
		"""
		for config in self.configs.values():
			if config.exists():
				config.load()
				self.configured = True

	def save(self):
		"""
		Save the configuration files back to disk
		:return:
		"""
		for config in self.configs.values():
			config.save()

	def get_options(self) -> list:
		"""
		Get a list of available configuration options for this game
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
		Get a configuration option from the game config
		:param option:
		:return:
		"""
		for config in self.configs.values():
			if option in config.options:
				return config.get_value(option)

		print('Invalid option: %s, not present in game configuration!' % option, file=sys.stderr)
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

		print('Invalid option: %s, not present in game configuration!' % option, file=sys.stderr)
		return ''

	def get_option_type(self, option: str) -> str:
		"""
		Get the type of a configuration option from the game config
		:param option:
		:return:
		"""
		for config in self.configs.values():
			if option in config.options:
				return config.get_type(option)

		print('Invalid option: %s, not present in game configuration!' % option, file=sys.stderr)
		return ''

	def get_option_help(self, option: str) -> str:
		"""
		Get the help text of a configuration option from the game config
		:param option:
		:return:
		"""
		for config in self.configs.values():
			if option in config.options:
				return config.options[option][4]

		print('Invalid option: %s, not present in game configuration!' % option, file=sys.stderr)
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
		Set a configuration option in the game config
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

		print('Invalid option: %s, not present in game configuration!' % option, file=sys.stderr)

	def get_option_options(self, option: str):
		"""
		Get the list of possible options for a configuration option
		:param options:
		:return:
		"""
		for config in self.configs.values():
			if option in config.options:
				return config.get_options(option)

		print('Invalid option: %s, not present in service configuration!' % option, file=sys.stderr)
		return []

	def prompt_option(self, option: str):
		"""
		Prompt the user to set a configuration option for the game
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
			val = prompt_yn('%s: ' % option, default)
		else:
			val = prompt_text('%s: ' % option, default=val, prefill=True)

		self.set_option(option, val)

	def get_services(self) -> list:
		"""
		Get a dictionary of available services (instances) for this game

		:return:
		"""
		if self._svcs is None:
			self._svcs = []
			for svc in self.services:
				self._svcs.append(GameService(svc, self))
		return self._svcs

	def is_active(self) -> bool:
		"""
		Check if any service instance is currently running or starting
		:return:
		"""
		for svc in self.get_services():
			if svc.is_running() or svc.is_starting() or svc.is_stopping():
				return True
		return False

	def check_update_available(self) -> bool:
		"""
		Check if there's an update available for this game

		:return:
		"""
		return False

	def update(self) -> bool:
		"""
		Update the game server

		:return:
		"""
		return False

	def send_discord_message(self, message: str):
		"""
		Send a message to the configured Discord webhook

		:param message:
		:return:
		"""
		if not self.get_option_value('Discord Enabled'):
			print('Discord notifications are disabled.')
			return

		if self.get_option_value('Discord Webhook URL') == '':
			print('Discord webhook URL is not set.')
			return

		print('Sending to discord: ' + message)
		req = request.Request(
			self.get_option_value('Discord Webhook URL'),
			headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:135.0) Gecko/20100101 Firefox/135.0'},
			method='POST'
		)
		data = json.dumps({'content': message}).encode('utf-8')
		try:
			with request.urlopen(req, data=data) as resp:
				pass
		except urllib_error.HTTPError as e:
			print('Could not notify Discord: %s' % e)

	def get_save_directory(self) -> Union[str, None]:
		"""
		Get the save directory for this game, or None if not applicable

		:return:
		"""
		return None

	def get_save_files(self) -> Union[list, None]:
		"""
		Get the list of save files/directories for this game, or None if not applicable

		:return:
		"""
		return None

	def backup(self, max_backups: int = 0) -> bool:
		"""
		Perform a backup of the game configuration and save files

		:param max_backups: Maximum number of backups to keep (0 = unlimited)
		:return:
		"""
		self.prepare_backup()
		backup_path = self.complete_backup(max_backups)
		print('Backup saved to %s' % backup_path)
		return True

	def prepare_backup(self) -> str:
		"""
		Prepare a backup directory for this game and return the file path

		:return:
		"""
		here = os.path.dirname(os.path.realpath(__file__))
		temp_store = os.path.join(here, '.save')
		save_source = self.get_save_directory()
		save_files = self.get_save_files()

		# Temporary directories for various file sources
		for d in ['config', 'save']:
			p = os.path.join(temp_store, d)
			if not os.path.exists(p):
				os.makedirs(p)

		# Copy the various configuration files used by the game
		for cfg in self.configs.values():
			src = cfg.path
			if src and os.path.exists(src):
				print('Backing up configuration file: %s' % src)
				dst = os.path.join(temp_store, 'config', os.path.basename(src))
				shutil.copy(src, dst)

		# Include service-specific configuration files too
		for svc in self.get_services():
			p = os.path.join(temp_store, svc.service)
			if not os.path.exists(p):
				os.makedirs(p)
			for cfg in svc.configs.values():
				src = cfg.path
				if src and os.path.exists(src):
					print('Backing up configuration file: %s' % src)
					dst = os.path.join(p, os.path.basename(src))
					shutil.copy(src, dst)

		# Copy save files if specified
		if save_source and save_files:
			for f in save_files:
				src = os.path.join(save_source, f)
				dst = os.path.join(temp_store, 'save', f)
				if os.path.exists(src):
					if os.path.isfile(src):
						print('Backing up save file: %s' % src)
						if not os.path.exists(os.path.dirname(dst)):
							os.makedirs(os.path.dirname(dst))
						shutil.copy(src, dst)
					else:
						print('Backing up save directory: %s' % src)
						if not os.path.exists(dst):
							os.makedirs(dst)
						shutil.copytree(src, dst, dirs_exist_ok=True)
				else:
					print('Save file %s does not exist, skipping...' % src, file=sys.stderr)

		return temp_store

	def complete_backup(self, max_backups: int = 0) -> str:
		"""
		Complete the backup process by creating the final archive and cleaning up temporary files

		:return:
		"""
		here = os.path.dirname(os.path.realpath(__file__))
		target_dir = os.path.join(here, 'backups')
		temp_store = os.path.join(here, '.save')
		base_name = self.name
		# Ensure no weird characters in the name
		replacements = {
			'/': '_',
			'\\': '_',
			':': '',
			'*': '',
			'?': '',
			'"': '',
			"'": '',
			' ': '_'
		}
		for old, new in replacements.items():
			base_name = base_name.replace(old, new)

		if os.geteuid() == 0:
			stat_info = os.stat(here)
			uid = stat_info.st_uid
			gid = stat_info.st_gid
		else:
			uid = None
			gid = None

		# Ensure target directory exists; this will store the finalized backups
		if not os.path.exists(target_dir):
			os.makedirs(target_dir)
			if uid is not None:
				os.chown(target_dir, uid, gid)

		# Create the final archive
		timestamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
		backup_name = '%s-backup-%s.tar.gz' % (base_name, timestamp)
		backup_path = os.path.join(target_dir, backup_name)
		print('Creating backup archive: %s' % backup_path)
		shutil.make_archive(backup_path[:-7], 'gztar', temp_store)

		# Ensure consistent ownership
		if uid is not None:
			os.chown(backup_path, uid, gid)

		# Cleanup
		shutil.rmtree(temp_store)

		# Remove old backups if necessary
		if max_backups > 0:
			backups = []
			for f in os.listdir(target_dir):
				if f.startswith('%s-backup-' % base_name) and f.endswith('.tar.gz'):
					full_path = os.path.join(target_dir, f)
					backups.append((full_path, os.path.getmtime(full_path)))
			backups.sort(key=lambda x: x[1])  # Sort by modification time
			while len(backups) > max_backups:
				old_backup = backups.pop(0)
				os.remove(old_backup[0])
				print('Removed old backup: %s' % old_backup[0])

		return backup_path

	def restore(self, path: str) -> bool:
		"""
		Restore a backup from the given filename

		:param path:
		:return:
		"""
		temp_store = self.prepare_restore(path)
		if temp_store is False:
			return False
		self.complete_restore()
		return True

	def prepare_restore(self, filename) -> Union[str, bool]:
		"""
		Prepare to restore a backup by extracting it to a temporary location

		:param filename:
		:return:
		"""
		if not os.path.exists(filename):
			print('Backup file %s does not exist, cannot continue!' % filename, file=sys.stderr)
			return False

		if self.is_active():
			print('Game server is currently running, please stop it before restoring a backup!', file=sys.stderr)
			return False

		here = os.path.dirname(os.path.realpath(__file__))
		temp_store = os.path.join(here, '.restore')
		os.makedirs(temp_store, exist_ok=True)
		save_dest = self.get_save_directory()

		if os.geteuid() == 0:
			stat_info = os.stat(here)
			uid = stat_info.st_uid
			gid = stat_info.st_gid
		else:
			uid = None
			gid = None

		# Extract the archive to the temporary location
		print('Extracting backup archive: %s' % filename)
		shutil.unpack_archive(filename, temp_store)

		# Copy the various configuration files used by the game
		for cfg in self.configs.values():
			dst = cfg.path
			if dst:
				src = os.path.join(temp_store, 'config', os.path.basename(dst))
				if os.path.exists(src):
					print('Restoring configuration file: %s' % dst)
					shutil.copy(src, dst)
					if uid is not None:
						os.chown(dst, uid, gid)

		# Include service-specific configuration files too
		for svc in self.get_services():
			p = os.path.join(temp_store, svc.service)
			if os.path.exists(p):
				for cfg in svc.configs.values():
					dst = cfg.path
					if dst:
						src = os.path.join(p, os.path.basename(dst))
						if os.path.exists(src):
							print('Restoring configuration file: %s' % dst)
							shutil.copy(src, dst)
							if uid is not None:
								os.chown(dst, uid, gid)

		# If the save destination is specified, perform those files/directories too.
		if save_dest:
			save_src = os.path.join(temp_store, 'save')
			if os.path.exists(save_src):
				for item in os.listdir(save_src):
					src = os.path.join(save_src, item)
					dst = os.path.join(save_dest, item)
					print('Restoring save file: %s' % dst)
					if os.path.isfile(src):
						shutil.copy(src, dst)
					else:
						shutil.copytree(src, dst, dirs_exist_ok=True)
					if uid is not None:
						if os.path.isfile(dst):
							os.chown(dst, uid, gid)
						else:
							for root, dirs, files in os.walk(dst):
								for momo in dirs:
									os.chown(os.path.join(root, momo), uid, gid)
								for momo in files:
									os.chown(os.path.join(root, momo), uid, gid)

		return temp_store

	def complete_restore(self):
		"""
		Complete the restore process by cleaning up temporary files

		:return:
		"""
		here = os.path.dirname(os.path.realpath(__file__))
		temp_store = os.path.join(here, '.restore')

		# Cleanup
		shutil.rmtree(temp_store)
