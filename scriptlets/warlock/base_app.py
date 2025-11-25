import sys
from typing import Union
from scriptlets.bz_eval_tui.prompt_yn import *
from scriptlets.bz_eval_tui.prompt_text import *


class BaseApp:
	"""
	Game application manager
	"""

	def __init__(self):
		self.name = ''
		self.desc = ''
		self.steam_id = ''

		self.services = []
		"""
		:type list<BaseService>:
		List of available services (instances) for this game
		"""

		self._svcs = None

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

	def set_option(self, option: str, value: str):
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
			val = prompt_yn(option, default)
		else:
			val = prompt_text(option, default=val, prefill=True)

		self.set_option(option, val)

	def get_services(self) -> dict:
		"""
		Get a dictionary of available services (instances) for this game

		:return:
		"""
		if self._svcs is None:
			self._svcs = {}
			for svc in self.services:
				self._svcs[svc] = GameService(svc, self)
		return self._svcs

	def is_active(self) -> bool:
		"""
		Check if any service instance is currently running or starting
		:return:
		"""
		for svc in self.get_services().values():
			if svc.is_running() or svc.is_starting() or svc.is_stopping():
				return True
		return False

	def check_update_available(self) -> bool:
		"""
		Check if there's an update available for this game

		:return:
		"""
		return False
