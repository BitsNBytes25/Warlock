import sys
from typing import Union
import configparser
import tempfile
from scriptlets.warlock.base_config import *


class INIConfig(BaseConfig):
	def __init__(self, group_name: str, path: str):
		super().__init__(group_name)
		self.path = path
		self.parser = configparser.ConfigParser()
		self.group = group_name
		self.spoof_group = False
		"""
		:type self.spoof_group: bool
		Set to True to spoof a fake group from the ini.  Useful for games which ship with non-standard ini files.
		"""

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

		if section is None and self.spoof_group:
			section = self.group

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

		section = self.options[name][0]
		key = self.options[name][1]
		val_type = self.options[name][3]
		str_value = BaseConfig.convert_from_system_type(value, val_type)

		if section is None and self.spoof_group:
			section = self.group

		# Escape '%' characters that may be present
		str_value = str_value.replace('%', '%%')

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

		if section is None and self.spoof_group:
			section = self.group

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
			if self.spoof_group:
				with open(self.path, 'r') as f:
					self.parser.read_string('[%s]\n' % self.group + f.read())
			else:
				self.parser.read(self.path)

	def save(self):
		"""
		Save the configuration file back to disk
		:return:
		"""
		if self.spoof_group:
			# Write parser output to a temporary file, then strip out the fake
			# section header that was inserted when loading (we spoofed a group).
			tf = tempfile.NamedTemporaryFile(mode='w+', delete=False)
			try:
				# Write the parser to the temp file
				self.parser.write(tf)
				# Ensure content is flushed before reading
				tf.flush()
				tf.close()
				with open(tf.name, 'r') as f:
					lines = f.readlines()
				# Remove the first line if it's the fake section header like: [GroupName]
				if lines and lines[0].strip().startswith('[') and lines[0].strip().endswith(']'):
					lines = lines[1:]
					# If there's an empty line after the header, remove it as well
					if lines and lines[0].strip() == '':
						lines = lines[1:]
				# Write the cleaned lines to the target path
				with open(self.path, 'w') as cfgfile:
					cfgfile.writelines(lines)
			finally:
				# Attempt to remove the temp file; ignore errors
				try:
					os.unlink(tf.name)
				except Exception:
					pass
		else:
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

