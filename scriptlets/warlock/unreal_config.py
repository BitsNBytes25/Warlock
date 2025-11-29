import sys
import os
from typing import Union
from scriptlets.warlock.base_config import *


class UnrealConfig(BaseConfig):
	def __init__(self, group_name: str, path: str):
		super().__init__(group_name)
		self.path = path
		self._data = []
		self._values = {}
		self._use_array_operators = False
		self._is_changed = False

	def get_value(self, name: str) -> Union[str, int, bool, list]:
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
		if section not in self._values:
			val = default
		else:
			if '/' in key:
				# Struct key
				parts = key.split('/')
				current = self._values[section]
				for part in parts:
					if part in current:
						current = current[part]
					else:
						current = default
						break
				val = current
			elif key not in self._values[section]:
				val = default
			else:
				val = self._values[section][key]

		return BaseConfig.convert_to_system_type(val, type)

	def set_value(self, name: str, value: Union[str, int, bool, list]):
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

		if section not in self._values:
			# Create the section
			self._values[section] = {}
			self._data.append([{'type': 'section', 'value': section}])

		# Ensure the updated value is in the data structure
		# First, find the section in the data
		new_data = []
		for sec in self._data:
			if sec[0]['type'] == 'section' and sec[0]['value'] == section:
				# Found it, add the keyvalue or update existing
				found = False
				new_section = []
				for item in sec:
					if item['type'] == 'keyvalue' and item['key'] == key:
						if found:
							# This key has already been handled, so skip any more of them.
							continue
						if isinstance(str_value, list):
							# Multiple values, need to handle duplicates
							c = 0
							for val in str_value:
								if c > 0 and self._use_array_operators:
									new_section.append({'type': 'keyvalue', 'key': key, 'value': val, 'op': '+'})
								else:
									new_section.append({'type': 'keyvalue', 'key': key, 'value': val})
								c += 1
						else:
							# Simple value
							new_section.append({'type': 'keyvalue', 'key': key, 'value': str_value})
						found = True
					else:
						new_section.append(item)
				if not found:
					new_section.append({'type': 'keyvalue', 'key': key, 'value': str_value})
				new_data.append(new_section)
			else:
				# Not matched, but keep the data
				new_data.append(sec)

		self._data = new_data
		self._values[section][key] = str_value
		self._is_changed = True

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
		if section not in self._values:
			return False
		else:
			if key not in self._values[section]:
				return False
			else:
				return self._values[section][key] != ''

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
			with open(self.path, 'r') as f:
				section = []
				last_section = ''
				for line in f.readlines():
					data = None
					stripped = line.strip()
					if stripped == '':
						continue
					elif stripped.startswith(';'):
						# Comment line
						data = {'type': 'comment', 'value': stripped[1:].strip()}
					elif stripped.startswith('[') and stripped.endswith(']'):
						# Section header
						data = {'type': 'section', 'value': stripped[1:-1].strip()}
					elif '=' in stripped:
						# Key-value pair
						parts = stripped.split('=', 1)
						key = parts[0].strip()
						value = parts[1].strip()
						if key.startswith('+'):
							# Array operator detected
							self._use_array_operators = True
							op = key[0]
							key = key[1:].strip()
							data = {'type': 'keyvalue', 'key': key, 'value': value, 'op': op}
						elif value.startswith('(') and value.endswith(')'):
							# Struct detected
							struct_str = value[1:-1].strip()
							struct_data = self._parse_struct(struct_str)
							data = {'type': 'keystruct', 'key': key, 'value': struct_data}
						else:
							data = {'type': 'keyvalue', 'key': key, 'value': value}

					if data is not None:
						if data['type'] == 'section':
							# New section!
							if len(section) > 0:
								self._data.append(section)
							section = []
							section.append(data)
							last_section = data['value']
						elif data['type'] == 'keystruct':
							section.append(data)
							if last_section not in self._values:
								self._values[last_section] = {}
							self._values[last_section][data['key']] = data['value']
						elif data['type'] == 'keyvalue':
							section.append(data)
							if last_section not in self._values:
								self._values[last_section] = {}
							# Auto-handle duplicate keys by converting them to a list.
							# UE is weird.
							if data['key'] in self._values[last_section]:
								# Existing key, convert to list
								existing_value = self._values[last_section][data['key']]
								if not isinstance(existing_value, list):
									existing_value = [existing_value]
								existing_value.append(data['value'])
								self._values[last_section][data['key']] = existing_value
							else:
								self._values[last_section][data['key']] = data['value']
						else:
							section.append(data)
				if len(section) > 0:
					self._data.append(section)
		self._is_changed = False

	def _parse_struct(self, struct_str: str) -> dict:
		"""
		Parse a UE struct string into a dictionary

		:param struct_str:
		:return:
		"""
		result = {}
		key = ''
		sub_key = ''
		buffer = ''
		quote = None
		group = None
		vals = []
		for c in struct_str:
			if c in ('"', "'") and quote is None:
				# Quote start
				quote = c
				continue
			elif quote is not None and c == quote:
				# Quote end
				quote = None
				continue
			elif quote is not None:
				# Quoted text, (skip parsing)
				buffer += c
				continue

			if c == '(':
				group = c
				continue
			elif c == ')' and group is not None:
				group = None
				#if buffer != '':
				if sub_key != '':
					if isinstance(vals, list):
						# This needs to be a dictionary in this case.
						vals = {}
					vals[sub_key] = buffer
					sub_key = ''
				else:
					vals.append(buffer)

				if key == '':
					# This is a list of values, not a dictionary.
					if isinstance(result, dict):
						result = []
					result.append(vals)
				else:
					result[key] = vals
				vals = []
				buffer = ''
				key = ''
				continue

			if c == '=' and buffer != '':
				if group is not None:
					# When inside a group, this indicates it's a dict.
					sub_key = buffer
				else:
					key = buffer
				buffer = ''
			elif c == ',':
				if sub_key != '':
					if isinstance(vals, list):
						# This needs to be a dictionary in this case.
						vals = {}
					vals[sub_key] = buffer
					sub_key = ''
				elif key != '':
					if group is not None:
						# Inside a group, usually a list
						vals.append(buffer)
					else:
						result[key] = buffer
						key = ''
				buffer = ''
			else:
				buffer += c
		if key != '':
			result[key] = buffer
		return result

	def _pack_struct(self, struct_data: dict) -> str:
		"""
		Pack a dictionary into a UE struct string

		:param struct_data:
		:return:
		"""
		parts = []
		if isinstance(struct_data, list):
			# List of values
			for value in struct_data:
				if isinstance(value, dict):
					val_str = self._pack_struct(value)
				elif value == '' or ':' in value or ',' in value:
					# Needs quoting
					val_str = '"%s"' % value.replace('"', '\\"')
				else:
					val_str = value
				parts.append(val_str)
			return '(' + ','.join(parts) + ')'
		else:
			for key in struct_data:
				value = struct_data[key]
				if isinstance(value, list):
					val_str = '(' + ','.join(value) + ')'
				elif value == '' or ':' in value or ',' in value or '_' in value:
					# Needs quoting
					val_str = '"%s"' % value.replace('"', '\\"')
				else:
					val_str = value
				parts.append('%s=%s' % (key, val_str))
			return '(' + ','.join(parts) + ')'

	def fetch(self) -> str:
		"""
		Render the configuration file to a string, used in saving back to the disk.

		:return:
		"""
		output_lines = []
		for section in self._data:
			for item in section:
				if item['type'] == 'comment':
					output_lines.append('; %s' % item['value'])
				elif item['type'] == 'section':
					if len(output_lines) > 0:
						output_lines.append('')  # Blank line before new section
					output_lines.append('[%s]' % item['value'])
				elif item['type'] == 'keyvalue':
					if 'op' in item:
						output_lines.append('%s%s=%s' % (item['op'], item['key'], item['value']))
					else:
						output_lines.append('%s=%s' % (item['key'], item['value']))
				elif item['type'] == 'keystruct':
					struct_str = self._pack_struct(item['value'])
					output_lines.append('%s=%s' % (item['key'], struct_str))
		return '\n'.join(output_lines).strip() + '\n'

	def save(self):
		"""
		Save the configuration file back to disk
		:return:
		"""
		if not self._is_changed:
			# No changes, skip save
			return

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

		with open(self.path, 'w') as f:
			f.write(self.fetch())
		if chown:
			os.chown(self.path, uid, gid)
