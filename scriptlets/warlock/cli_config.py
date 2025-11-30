import os
import sys
from typing import Union
import yaml
from scriptlets.warlock.base_config import *


class CLIConfig(BaseConfig):
	def __init__(self, group_name: str, path: str = None):
		super().__init__(group_name)

		self.values = {}
		"""
		:type dict<str, str>
		Dictionary of current values for options set in the CLI
		"""

		self.path = path
		"""
		:type str:
		Optional path to file that contains the CLI arguments and executable.
		"""

		self.format = None
		"""
		:type str:
		Optional format of the line in the file that contains the arguments.
		If set will be used to automatically extract and parse the command flags.
		
		Use %OPTIONS% to denote where options should be injected.
		"""

		self.flag_sep = '='
		"""
		:type str:
		Some applications expect flag key/values to be separated by a space or by an '=' character.
		If set, this will be used when saving the configuration back to file.
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
		if default is None:
			default = ''
		val_type = self.options[name][3]
		val = self.values.get(name, default)

		if val_type == 'bool':
			# CLI arguments treat booleans differently; they are true if they are present in general.
			return val == '' or val.lower() == 'true'
		else:
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
		return self.path is not None and os.path.exists(self.path)

	def load(self, arguments: str = ''):
		"""
		Load the configuration file from disk
		:return:
		"""
		if self.path is not None and os.path.exists(self.path) and self.format is not None:
			# Load the file and extract the arguments line
			if '%OPTIONS%' in self.format:
				match = self.format[:self.format.index('%OPTIONS%')].strip()
			else:
				match = self.format.strip()

			with open(self.path, 'r') as f:
				for line in f:
					line = line.strip()
					if line.startswith(match):
						# Extract the arguments
						arguments = line[len(match):].strip()
						break

		# Use a tokenizer to parse options and flags
		buffer = ''
		args = []
		quote = None
		# Add a space at the end to flush the last param
		arguments += ' '
		for c in arguments:
			if quote is None and c in ['"', "'"]:
				quote = c
				continue
			if quote is not None and c == quote:
				quote = None
				continue

			if quote is not None:
				# Quoted strings always just get appended to the buffer
				buffer += c
				continue

			if c in [' ', '?', '-']:
				# These denote separators
				# Flush the buffer first
				if buffer.strip() != '':
					args.append(buffer.strip())
				buffer = c
			else:
				# Normal character, just append to buffer
				buffer += c

		options_done = False
		values = []
		# Split args into options and flags as they behave differently.
		for arg in args:
			if not options_done:
				if arg.startswith('-'):
					# Flags start here
					options_done = True

				else:
					# Option
					if arg.startswith('?'):
						arg = arg[1:]
					if '=' in arg:
						opt_key, opt_val = arg.split('=', 1)
						values.append([opt_key, opt_val, 'option'])
					else:
						values.append([arg, '', 'option'])
					continue

			# Flag
			if arg.startswith('-'):
				arg = arg[1:]
				if '=' in arg:
					opt_key, opt_val = arg.split('=', 1)
					values.append([opt_key, opt_val, 'flag'])
				else:
					values.append([arg, '', 'flag'])
			else:
				# Continuation of a previous argument probably.
				idx = len(values) - 1
				if idx >= 0:
					if values[idx][1] == '':
						values[idx][1] = arg
					elif isinstance(values[idx][1], list):
						values[idx][1].append(arg)
					else:
						values[idx][1] = [values[idx][1], arg]

		# Build a simple list of known options by their key
		opts = {}
		for o in self.options:
			opts[self.options[o][1]] = o

		# Compare against known options and set values
		for val in values:
			opt_key, opt_val, opt_group = val
			option = None
			if opt_key in opts:
				option = opts[opt_key]
			elif isinstance(opt_val, list):
				# Some values can be complicated, ie: with Valheim "modifier portals casual"
				# This may be mapped to "modifier portals" with the value of "casual"
				check = opt_key
				i = 0
				while i < len(opt_val):
					val = opt_val[i]
					i += 1
					check += ' ' + val
					if check in opts:
						option = opts[check]
						opt_val = opt_val[i:]
						if len(opt_val) == 1:
							opt_val = opt_val[0]
						elif len(opt_val) == 0:
							opt_val = ''
						break

			if option is None:
				print('Could not find option for key: %s' % (opt_key, ), file=sys.stderr)
				continue

			self.values[option] = opt_val

	def save(self):
		if self.path is not None and os.path.exists(self.path) and self.format is not None:
			# Load the file and extract the arguments line
			if '%OPTIONS%' in self.format:
				match = self.format[:self.format.index('%OPTIONS%')].strip()
			else:
				match = self.format.strip()

			new_cmd = str(self)
			if new_cmd.startswith('?'):
				if '?' in match:
					# Run them together
					new_cmd = match + new_cmd
				else:
					# Remove leading '?' if the match includes it
					new_cmd = match + new_cmd[1:]
			else:
				new_cmd = match + ' ' + new_cmd
			new_contents = []
			with open(self.path, 'r') as f:
				for line in f:
					line = line.strip()
					if line.startswith(match):
						# Replace this line with the new rendered options
						line = new_cmd
					new_contents.append(line)

			with open(self.path, 'w') as f:
				f.write('\n'.join(new_contents) + '\n')

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

			if val_type == 'bool':
				if raw_val.lower() in ('true', '1', 'yes', ''):
					if section == 'flag':
						flags.append('-%s' % key)
					else:
						opts.append('%s' % key)
			else:
				if '"' in raw_val:
					raw_val = "'%s'" % raw_val
				elif "'" in raw_val or ' ' in raw_val or '?' in raw_val or '=' in raw_val or '-' in raw_val:
					raw_val = '"%s"' % raw_val

				if raw_val != '':
					# Only append keys that have values.
					if section == 'flag':
						flags.append('-%s%s%s' % (key, self.flag_sep, raw_val))
					else:
						opts.append('%s=%s' % (key, raw_val))

		ret = []
		if len(opts) > 0:
			ret.append('?' + '?'.join(opts))
		if len(flags) > 0:
			ret.append(' '.join(flags))
		return ' '.join(ret)
