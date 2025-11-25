import os
import sys
from typing import Union
import yaml


class BaseConfig:
	def __init__(self, group_name: str, *args, **kwargs):
		self.options = {}
		"""
		:type dict<str, tuple<str, str, str, str, str>>
		Primary dictionary of all options on this config
		
		* Item 0: Section
		* Item 1: Key
		* Item 2: Default Value
		* Item 3: Type (str, int, bool)
		* Item 4: Help Text
		"""

		self._keys = {}
		"""
		:type dict<str, str>
		Map of lowercase option keys to name for quick lookup
		"""

		# Load the configuration definitions from configs.yaml
		here = os.path.dirname(os.path.realpath(__file__))

		if os.path.exists(os.path.join(here, 'configs.yaml')):
			with open(os.path.join(here, 'configs.yaml'), 'r') as cfgfile:
				cfgdata = yaml.safe_load(cfgfile)
				for cfgname, cfgoptions in cfgdata.items():
					if cfgname == group_name:
						for option in cfgoptions:
							self.add_option(
								option.get('name'),
								option.get('section'),
								option.get('key'),
								option.get('default'),
								option.get('type', 'str'),
								option.get('help', '')
							)

	def add_option(self, name, section, key, default, val_type, help_text):
		"""
		Add a configuration option to the available list

		:param name:
		:param section:
		:param key:
		:param default:
		:param val_type:
		:param help_text:
		:return:
		"""
		self.options[name] = (section, key, default, val_type, help_text)
		# Primary dictionary of all options on this config

		self._keys[key.lower()] = name
		# Map of lowercase option names to sections for quick lookup

	@classmethod
	def convert_to_system_type(cls, value: str, val_type: str) -> Union[str, int, bool]:
		"""
		Convert a string value to the appropriate system type
		:param value:
		:param val_type:
		:return:
		"""
		# Auto convert
		if value == '':
			return ''
		elif val_type == 'int':
			return int(value)
		elif val_type == 'bool':
			return value.lower() in ('1', 'true', 'yes', 'on')
		else:
			return value

	@classmethod
	def convert_from_system_type(cls, value: Union[str, int, bool], val_type: str) -> str:
		"""
		Convert a system type value to a string for storage
		:param value:
		:param val_type:
		:return:
		"""
		if val_type == 'bool':
			if value == '':
				# Allow empty values to defer to default
				return ''
			elif value:
				return 'True'
			else:
				return 'False'
		else:
			return str(value)

	def get_value(self, name: str) -> Union[str, int, bool]:
		"""
		Get a configuration option from the config

		:param name: Name of the option
		:return:
		"""
		pass

	def set_value(self, name: str, value: Union[str, int, bool]):
		"""
		Set a configuration option in the config

		:param name: Name of the option
		:param value: Value to save
		:return:
		"""
		pass

	def has_value(self, name: str) -> bool:
		"""
		Check if a configuration option has been set

		:param name: Name of the option
		:return:
		"""
		pass

	def get_default(self, name: str) -> Union[str, int, bool]:
		"""
		Get the default value of a configuration option
		:param name:
		:return:
		"""
		if name not in self.options:
			print('Invalid option: %s, not available in configuration!' % (name, ), file=sys.stderr)
			return ''

		default = self.options[name][2]
		val_type = self.options[name][3]

		return BaseConfig.convert_to_system_type(default, val_type)

	def get_type(self, name: str) -> str:
		"""
		Get the type of a configuration option from the config

		:param name:
		:return:
		"""
		if name not in self.options:
			print('Invalid option: %s, not available in configuration!' % (name, ), file=sys.stderr)
			return ''

		return self.options[name][3]

	def exists(self) -> bool:
		"""
		Check if the config file exists on disk
		:return:
		"""
		pass

	def load(self, *args, **kwargs):
		"""
		Load the configuration file from disk
		:return:
		"""
		pass

	def save(self, *args, **kwargs):
		"""
		Save the configuration file back to disk
		:return:
		"""
		pass
