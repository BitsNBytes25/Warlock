import os
import sys
from typing import Union
import yaml
from scriptlets.warlock.base_config import *


class CLIConfig(BaseConfig):
	def __init__(self, group_name: str):
		super().__init__(group_name)

		self.values = {}
		"""
		:type dict<str, str>
		Dictionary of current values for options set in the CLI
		"""

	def get_value(self, name: str) -> Union[str, int, bool]:
		"""
		Get a configuration option from the config

		:param name: Name of the option
		:return:
		"""
		if name not in self.options:
			print('Invalid option: %s, not available in configuration!' % (name, ), file=sys.stderr)
			return ''

		default = self.options[name][2]
		val_type = self.options[name][3]
		val = self.values.get(name, default)

		return BaseConfig.convert_to_system_type(val, val_type)

	def set_value(self, name: str, value: Union[str, int, bool]):
		"""
		Set a configuration option in the config

		:param name: Name of the option
		:param value: Value to save
		:return:
		"""
		if name not in self.options:
			print('Invalid option: %s, not available in configuration!' % (name, ), file=sys.stderr)
			return

		val_type = self.options[name][3]
		str_value = BaseConfig.convert_from_system_type(value, val_type)
		self.values[name] = str_value

	def has_value(self, name: str) -> bool:
		"""
		Check if a configuration option has been set

		:param name: Name of the option
		:return:
		"""
		if name not in self.options:
			return False

		return name in self.values and self.values[name] != ''

	def exists(self) -> bool:
		"""
		Check if the config file exists on disk
		:return:
		"""
		return False

	def load(self, arguments: str):
		"""
		Load the configuration file from disk
		:return:
		"""
		# Use a tokenizer to parse options and flags
		options_done = False
		quote = None
		param = ''
		values = []
		# Add a space at the end to flush the last param
		arguments += ' '
		for c in arguments:
			if quote is None and c in ['"', "'"]:
				quote = c
				continue
			if quote is not None and c == quote:
				quote = None
				continue

			if not options_done and quote is None and c in ['?', ' ']:
				# '?' separates options
				if param == '':
					continue

				if '=' in param:
					opt_key, opt_val = param.split('=', 1)
					values.append((opt_key, opt_val, 'option'))
				else:
					values.append((param, '', 'option'))

				# Reset for next param
				param = ''
				if c == ' ':
					options_done = True
				continue

			if options_done and quote is None and c == '-':
				# Tack can be safely ignored
				continue

			if options_done and quote is None and c == ' ':
				# ' ' separates flags
				if param == '':
					continue

				if '=' in param:
					opt_key, opt_val = param.split('=', 1)
					values.append((opt_key, opt_val, 'flag'))
				else:
					opt_key = param
					values.append((opt_key, '', 'flag'))

				param = ''
				continue

			# Default behaviour; just append the character
			param += c

		# Arguments have been pulled from the command line, now set the values based on the options available
		for val in values:
			opt_key, opt_val, opt_group = val
			lower_key = opt_key.lower()
			if lower_key in self._keys:
				actual_key = self._keys[lower_key]
				section = self.options[actual_key][0]
				val_type = self.options[actual_key][3]
				if section != opt_group:
					print('Option type mismatch for %s: expected %s, got %s' % (opt_key, section, opt_group), file=sys.stderr)
					continue

				if opt_val == '' and val_type == 'bool':
					# Allow boolean flags to be set without a value
					self.values[actual_key] = 'True'
				else:
					self.values[actual_key] = opt_val
			else:
				print('Unknown option: %s, not present in configuration!' % opt_key, file=sys.stderr)

	def save(self):
		pass

	def __str__(self) -> str:
		opts = []
		flags = []

		for name in self.options.keys():
			if name not in self.values:
				# Skip any options not set
				continue

			section = self.options[name][0]
			key = self.options[name][1]
			val_type = self.options[name][3]
			raw_val = self.values[name]

			if val_type == 'bool' and raw_val.lower() in ('true', '1', 'yes'):
				# Booleans in command lines are simply present if True or absent if False.
				if section == 'flag':
					flags.append('-%s' % key)
				else:
					opts.append(key)
			else:
				if '"' in raw_val:
					raw_val = "'%s'" % raw_val
				elif "'" in raw_val or ' ' in raw_val or '?' in raw_val or '=' in raw_val:
					raw_val = '"%s"' % raw_val

				if section == 'flag':
					flags.append('-%s=%s' % (key, raw_val))
				else:
					opts.append('%s=%s' % (key, raw_val))

		return '%s %s' % ('?'.join(opts), ' '.join(flags))
