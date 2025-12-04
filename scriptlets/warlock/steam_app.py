import os
import time
import subprocess
from scriptlets.warlock.base_app import *
from scriptlets.steam.steamcmd_check_app_update import *

class SteamApp(BaseApp):
	"""
	Game application manager
	"""

	def __init__(self):
		super().__init__()
		self.steam_id = ''
		self.steam_branch = 'public'
		self.steam_branch_password = ''

	def check_update_available(self) -> bool:
		"""
		Check if a SteamCMD update is available for this game

		:return:
		"""
		here = os.path.dirname(os.path.realpath(__file__))
		return steamcmd_check_app_update(os.path.join(here, 'AppFiles', 'steamapps', 'appmanifest_%s.acf' % self.steam_id))

	def update(self):
		"""
		Update the game server via SteamCMD

		:return:
		"""
		# Stop any running services before updating
		services = []
		for service in self.get_services():
			if service.is_running() or service.is_starting():
				print('Stopping service %s for update...' % service.service)
				services.append(service.service)
				subprocess.Popen(['systemctl', 'stop', service.service])

		if len(services) > 0:
			# Wait for all services to stop, may take 5 minutes if players are online.
			print('Waiting up to 5 minutes for all services to stop...')
			counter = 0
			while counter < 30:
				all_stopped = True
				counter += 1
				for service in self.get_services():
					if service.is_running() or service.is_starting() or service.is_stopping():
						all_stopped = False
						break
				if all_stopped:
					break
				time.sleep(10)
		else:
			print('No running services found, proceeding with update...')

		here = os.path.dirname(os.path.realpath(__file__))
		cmd = [
			'/usr/games/steamcmd',
			'+force_install_dir',
			os.path.join(here, 'AppFiles'),
			'+login',
			'anonymous',
			'+app_update',
			self.steam_id,
		]

		if self.steam_branch != 'public':
			cmd.append('-beta')
			cmd.append(self.steam_branch)
			if self.steam_branch_password != '':
				cmd.append('-betapassword')
				cmd.append(self.steam_branch_password)

		cmd.append('validate')
		cmd.append('+quit')

		if os.geteuid() == 0:
			stat_info = os.stat(here)
			uid = stat_info.st_uid
			cmd = [
				'sudo',
				'-u',
				'#%s' % uid
			] + cmd

		res = subprocess.run(cmd)

		# Allow the game to perform any post-update tasks
		self.post_update()

		if len(services) > 0:
			print('Update completed, restarting previously running services...')
			for service in services:
				subprocess.Popen(['systemctl', 'start', service])
				time.sleep(10)

		return res.returncode == 0
