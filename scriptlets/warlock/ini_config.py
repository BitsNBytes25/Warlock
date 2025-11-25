import sys
from typing import Union
import configparser
from scriptlets.warlock.base_config import *


class INIConfig(BaseConfig):
	def __init__(self, group_name: str, path: str):
		super().__init__(group_name)
		self.path = path
		self.parser = configparser.ConfigParser()

	def get_value(self, name: str) -> Union[str, int, bool]:
		"""
		Get a configuration option from the config

		:param name: Name of the option
		:return:
		"""
		if name not in self.options:
			print('Invalid option: %s, not present in %s configuration!' % (name, os.path.basename(self.path)), file=sys.stderr)
			return ''

		section = self.options[name][0]
		key = self.options[name][1]
		default = self.options[name][2]
		val_type = self.options[name][3]
		if section not in self.parser:
			val = default
		else:
			val = self.parser[section].get(key, default)
		return BaseConfig.convert_to_system_type(val, val_type)

	def set_value(self, name: str, value: Union[str, int, bool]):
		"""
		Set a configuration option in the config

		:param name: Name of the option
		:param value: Value to save
		:return:
		"""
		if name not in self.options:
			print('Invalid option: %s, not present in %s configuration!' % (name, os.path.basename(self.path)), file=sys.stderr)
			return

		# Escape '%' characters that may be present
		value = value.replace('%', '%%')

		section = self.options[name][0]
		key = self.options[name][1]
		val_type = self.options[name][3]
		str_value = BaseConfig.convert_from_system_type(value, val_type)
		if section not in self.parser:
			self.parser[section] = {}
		self.parser[section][key] = str_value

	def has_value(self, name: str) -> bool:
		"""
		Check if a configuration option has been set

		:param name: Name of the option
		:return:
		"""
		if name not in self.options:
			return False

		section = self.options[name][0]
		key = self.options[name][1]
		if section not in self.parser:
			return False
		else:
			return self.parser[section].get(key, '') != ''

	def exists(self) -> bool:
		"""
		Check if the config file exists on disk
		:return:
		"""
		return os.path.exists(self.path)

	def load(self):
		"""
		Load the configuration file from disk
		:return:
		"""
		if os.path.exists(self.path):
			self.parser.read(self.path)

	def save(self):
		"""
		Save the configuration file back to disk
		:return:
		"""
		with open(self.path, 'w') as cfgfile:
			self.parser.write(cfgfile)

		# Change ownership to game user if running as root
		if os.geteuid() == 0:
			# Determine game user based on parent directories
			check_path = os.path.dirname(self.path)
			while check_path != '/' and check_path != '':
				if os.path.exists(check_path):
					stat_info = os.stat(check_path)
					uid = stat_info.st_uid
					gid = stat_info.st_gid
					os.chown(self.path, uid, gid)
					break
				check_path = os.path.dirname(check_path)
