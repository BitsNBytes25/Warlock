import sys
import os
import shutil
import tempfile
here = os.path.dirname(os.path.realpath(__file__))

from scriptlets.warlock.cli_config import CLIConfig
from scriptlets.warlock.base_config import BaseConfig
import unittest
from pprint import pprint

class TestCLIConfig(unittest.TestCase):
	def test_ark(self):
		cfg = CLIConfig('test', os.path.join(here, 'data', 'cli_ark.service'))
		cfg.format = 'ExecStart=/path/to/proton run ArkAscendedServer.exe Ark?listen%OPTIONS%'
		cfg.add_option('Session Name', 'option', 'SessionName')
		cfg.add_option('RCON Port', 'option', 'RCONPort', 0, 'int')
		cfg.add_option('Flag1', 'flag', 'Flag1', '', 'str')
		cfg.add_option('Flag2', 'flag', 'Flag2', '', 'str')
		cfg.load()

		# SessionName="My Ark Server"?RCONPort=32330 -Flag1=Value1 -Flag2="Some value 2"

		with tempfile.TemporaryDirectory() as td:
			path = os.path.join(td, 'test.service')
			shutil.copyfile(cfg.path, path)
			orig_path = cfg.path
			cfg.path = path

			cfg.save()

			with open(path, 'r') as f:
				data_new = f.read()
			with open(orig_path, 'r') as f:
				data_orig = f.read()
			self.assertEqual(data_orig, data_new)

	def test_similar_arguments(self):
		cfg = CLIConfig('test')
		cfg.add_option('Modifier - Player Events', 'flag', 'setkey playerevents', False, 'bool')
		cfg.add_option('Modifier - Passive Mobs', 'flag', 'setkey passivemobs', False, 'bool')
		cfg.add_option('Modifier - No Map', 'flag', 'setkey nomap', False, 'bool')
		cfg.load('-setkey passivemobs')

		self.assertFalse(cfg.get_value('Modifier - Player Events'))
		self.assertTrue(cfg.get_value('Modifier - Passive Mobs'))
		self.assertFalse(cfg.get_value('Modifier - No Map'))

		cfg.set_value('Modifier - Player Events', True)
		cfg.set_value('Modifier - No Map', True)

		self.assertTrue(cfg.get_value('Modifier - Player Events'))
		self.assertTrue(cfg.get_value('Modifier - Passive Mobs'))
		self.assertTrue(cfg.get_value('Modifier - No Map'))

		self.assertEqual('-setkey playerevents -setkey passivemobs -setkey nomap', str(cfg))

	def test_valheim(self):
		cfg = CLIConfig('test', os.path.join(here, 'data', 'cli_valheim.service'))
		cfg.format = 'ExecStart=/home/steam/Valheim/AppFiles/valheim_server.x86_64 %OPTIONS%'
		cfg.flag_sep = ' '
		cfg.add_option('Name', 'flag', 'name', '', 'str')
		cfg.add_option('port', 'flag', 'port', 0, 'int')
		cfg.add_option('world', 'flag', 'world', '', 'str')
		cfg.add_option('password', 'flag', 'password', '', 'str')
		cfg.add_option('crossplay', 'flag', 'crossplay', False, 'bool')
		cfg.add_option('modifier raids', 'flag', 'modifier raids', '', 'str')
		cfg.load()

		self.assertEqual('My server', cfg.get_value('Name'))
		self.assertEqual(2456, cfg.get_value('port'))
		self.assertEqual('Dedicated', cfg.get_value('world'))
		self.assertEqual('secret', cfg.get_value('password'))
		self.assertEqual(True, cfg.get_value('crossplay'))
		self.assertEqual('none', cfg.get_value('modifier raids'))

		self.assertEqual('-name "My server" -port 2456 -world Dedicated -password secret -crossplay -modifier raids none', str(cfg))

		cfg.set_value('crossplay', False)
		self.assertEqual(False, cfg.get_value('crossplay'))
		self.assertEqual('-name "My server" -port 2456 -world Dedicated -password secret -modifier raids none', str(cfg))

		cfg.set_value('crossplay', True)
		self.assertEqual(True, cfg.get_value('crossplay'))

		with tempfile.TemporaryDirectory() as td:
			path = os.path.join(td, 'test.service')
			shutil.copyfile(cfg.path, path)
			orig_path = cfg.path
			cfg.path = path

			cfg.save()

			with open(path, 'r') as f:
				data_new = f.read()
			with open(orig_path, 'r') as f:
				data_orig = f.read()
			self.assertEqual(data_orig, data_new)