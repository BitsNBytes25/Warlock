import sys
import os
here = os.path.dirname(os.path.realpath(__file__))
sys.path.insert(0, os.path.join(here, '..'))

from scriptlets.warlock.unreal_config import UnrealConfig
from scriptlets.warlock.base_config import BaseConfig
import unittest
from pprint import pprint


class TestUnrealConfig(unittest.TestCase):
    def test_init(self):
        cfg = UnrealConfig('test', '/tmp/test.ini')
        # Basic expectations
        self.assertIsInstance(cfg.options, dict)
        self.assertEqual(cfg.path, '/tmp/test.ini')

    def test_get_default_missing(self):
        cfg = UnrealConfig('test', '')
        # Requesting a default for a non-existent option should return an empty string
        val = cfg.get_default('this_option_does_not_exist')
        self.assertEqual(val, '')

    def test_simple_data(self):
        cfg = UnrealConfig('test', os.path.join(here, 'data', 'unreal_simple.ini'))
        # Configs are grouped by named parameters, so let's add some options
        cfg.add_option('Key1', 'SomeSection', 'Key1')
        cfg.add_option('Key2', 'SomeSection', 'Key2', val_type='int')
        cfg.add_option('Key3', 'SomeSection', 'Key3', val_type='bool')
        cfg.load()

        self.assertEqual(cfg.get_value('Key1'), 'Value1')
        self.assertEqual(cfg.get_value('Key2'), 42)
        self.assertEqual(cfg.get_value('Key3'), True)

        # These values should exist
        self.assertTrue(cfg.has_value('Key1'))
        self.assertTrue(cfg.has_value('Key2'))
        self.assertTrue(cfg.has_value('Key3'))

        # This value should not
        self.assertFalse(cfg.has_value('NonExistentKey'))

        # Ensure the generated data matches expectations
        with open(cfg.path, 'r') as f:
            expected = f.read()
        self.assertEqual(expected, cfg.fetch())

        cfg.set_value('Key1', 'NewValue')
        self.assertEqual(cfg.get_value('Key1'), 'NewValue')

        cfg.set_value('Key2', 100)
        self.assertEqual(cfg.get_value('Key2'), 100)

        cfg.set_value('Key3', False)
        self.assertEqual(cfg.get_value('Key3'), False)

        # Ensure the generated data matches expectations
        expected = '''; This is a simple config file for testing purposes.

[SomeSection]
; This key is a string value
Key1=NewValue
; This key is an integer value
Key2=100
; This key is a boolean value
Key3=False
'''
        self.assertEqual(expected, cfg.fetch())

    def test_simple_create(self):
        cfg = UnrealConfig('test', os.path.join(here, 'data', 'unreal_simple.ini'))
        # Configs are grouped by named parameters, so let's add some options
        cfg.add_option('Key1', 'SomeSection', 'Key1')
        cfg.add_option('Key2', 'SomeSection', 'Key2', val_type='int')
        cfg.add_option('Key3', 'SomeSection', 'Key3', val_type='bool')
        cfg.set_value('Key1', 'NewValue')
        cfg.set_value('Key2', 100)
        cfg.set_value('Key3', False)

        # Ensure the generated data matches expectations
        expected = '''[SomeSection]
Key1=NewValue
Key2=100
Key3=False
'''
        self.assertEqual(expected, cfg.fetch())

    def test_duplicate_keys(self):
        cfg = UnrealConfig('test', os.path.join(here, 'data', 'unreal_duplicate_keys.ini'))
        cfg.add_option('LastMapPlayed', 'Player.Info', 'LastMapPlayed')
        cfg.add_option('PlayedMaps', 'Player.Info', 'PlayedMaps', val_type='list')
        cfg.load()

        # The last occurrence of the duplicate key should be the one that is loaded
        self.assertEqual(cfg.get_value('LastMapPlayed'), 'BobsMissions_WP')
        self.assertIsInstance(cfg.get_value('PlayedMaps'), list)
        self.assertEqual(len(cfg.get_value('PlayedMaps')), 6)
        self.assertIn('ScorchedEarth_WP', cfg.get_value('PlayedMaps'))
        self.assertIn('TheIsland_WP', cfg.get_value('PlayedMaps'))
        self.assertIn('Ragnarok_WP', cfg.get_value('PlayedMaps'))
        self.assertIn('Valguero_WP', cfg.get_value('PlayedMaps'))
        self.assertIn('Amissa_WP', cfg.get_value('PlayedMaps'))
        self.assertIn('BobsMissions_WP', cfg.get_value('PlayedMaps'))

        # Ensure the generated data matches expectations
        with open(cfg.path, 'r') as f:
            expected = f.read()
        self.assertEqual(expected, cfg.fetch())

        # Update the played maps key with a new list.
        new_maps = ['NewMap1_WP', 'NewMap2_WP']
        cfg.set_value('PlayedMaps', new_maps)
        self.assertEqual(len(cfg.get_value('PlayedMaps')), 2)
        self.assertIn('NewMap1_WP', cfg.get_value('PlayedMaps'))
        self.assertIn('NewMap2_WP', cfg.get_value('PlayedMaps'))

        # Ensure the generated data matches expectations
        expected = '''[Player.Info]
LastMapPlayed=BobsMissions_WP
PlayedMaps=NewMap1_WP
PlayedMaps=NewMap2_WP
'''
        self.assertEqual(expected, cfg.fetch())

    def test_array_ops(self):
        cfg = UnrealConfig('test', os.path.join(here, 'data', 'unreal_array_ops.ini'))
        cfg.add_option('NotAnArray', 'Operator Test', 'NotAnArray')
        cfg.add_option('SomeValue', 'Operator Test', 'SomeValue', val_type='list')
        cfg.load()

        self.assertEqual(cfg.get_value('NotAnArray'), 'Hello')
        self.assertEqual(len(cfg.get_value('SomeValue')), 3)
        self.assertEqual(cfg.get_value('SomeValue')[0], '42')
        self.assertEqual(cfg.get_value('SomeValue')[1], '8')
        self.assertEqual(cfg.get_value('SomeValue')[2], '15')

        # Ensure the generated data matches expectations
        with open(cfg.path, 'r') as f:
            expected = f.read()
        self.assertEqual(expected, cfg.fetch())

    def test_vein(self):
        cfg = UnrealConfig('test', os.path.join(here, 'data', 'unreal_vein.ini'))
        cfg.add_option('Server Description', '/Script/Vein.VeinGameSession', 'ServerDescription')
        cfg.add_option('Server Name', '/Script/Vein.VeinGameSession', 'ServerName')
        cfg.add_option('API Port', '/Script/Vein.VeinGameSession', 'HTTPPort', val_type='int')
        cfg.load()

        self.assertEqual(cfg.get_value('Server Description'), 'BitsNBytes VEIN Desc')
        self.assertEqual(cfg.get_value('Server Name'), 'BitsNBytes VEIN Test!')
        self.assertEqual(cfg.get_value('API Port'), 8080)

        # Ensure the generated data matches expectations
        with open(cfg.path, 'r') as f:
            expected = f.read()
        self.assertEqual(expected, cfg.fetch())

    def test_palworld(self):
        cfg = UnrealConfig('test', os.path.join(here, 'data', 'unreal_palworld.ini'))
        cfg.add_option('Difficulty', '/Script/Pal.PalGameWorldSettings', 'OptionSettings/Difficulty', val_type='str')
        cfg.add_option('Randomizer Seed', '/Script/Pal.PalGameWorldSettings', 'OptionSettings/RandomizerSeed', val_type='str')
        cfg.add_option('Randomizer Pal Level Random', '/Script/Pal.PalGameWorldSettings', 'OptionSettings/bIsRandomizerPalLevelRandom', val_type='bool')
        cfg.add_option('Day Time Speed Rate', '/Script/Pal.PalGameWorldSettings', 'OptionSettings/DayTimeSpeedRate', val_type='float')
        cfg.add_option('Crossplay Platforms', '/Script/Pal.PalGameWorldSettings', 'OptionSettings/CrossplayPlatforms', val_type='list')
        cfg.load()

        self.assertEqual(cfg.get_value('Difficulty'), 'None')
        self.assertEqual(cfg.get_value('Randomizer Seed'), '')
        self.assertEqual(cfg.get_value('Randomizer Pal Level Random'), False)

        # Ensure the generated data matches expectations
        with open(cfg.path, 'r') as f:
            expected = f.read()
        self.assertEqual(expected, cfg.fetch())

    def test_ark(self):
        """
        ARK has some complicated datatypes we need to support.
        :return:
        """
        cfg = UnrealConfig('test', os.path.join(here, 'data', 'unreal_ark.ini'))
        cfg.load()

        # Ensure the generated data matches expectations
        with open(cfg.path, 'r') as f:
            expected = f.read()
        self.assertEqual(expected, cfg.fetch())


if __name__ == '__main__':
    unittest.main()
