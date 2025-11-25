import sys
from typing import Union
from scriptlets.com_unrealengine.config_parser import *
from scriptlets.warlock.base_config import *


class UnrealConfig(BaseConfig):
	def __init__(self, group_name: str, path: str):
		super().__init__(group_name)
		self.path = path
		self.parser = UnrealConfigParser()

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
		type = self.options[name][3]
		val = self.parser.get_key(section, key, default)

		return BaseConfig.convert_to_system_type(val, type)

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

		section = self.options[name][0]
		key = self.options[name][1]
		val_type = self.options[name][3]
		str_value = BaseConfig.convert_from_system_type(value, val_type)
		self.parser.set_key(section, key, str_value)

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
		return self.parser.get_key(section, key, '') != ''

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
			self.parser.read_file(self.path)

	def save(self):
		"""
		Save the configuration file back to disk
		:return:
		"""
		if self.parser.is_changed():
			gid = None
			uid = None
			chown = False

			if os.geteuid() == 0:
				# Determine game user based on parent directories
				check_path = os.path.dirname(self.path)
				while check_path != '/' and check_path != '':
					if os.path.exists(check_path):
						stat_info = os.stat(check_path)
						uid = stat_info.st_uid
						gid = stat_info.st_gid
						chown = True
						break
					check_path = os.path.dirname(check_path)

			self.parser.write_file(self.path)
			if chown:
				os.chown(self.path, uid, gid)
