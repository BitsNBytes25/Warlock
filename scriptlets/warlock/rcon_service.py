from typing import Union
from rcon.source import Client
from rcon import SessionTimeout
from rcon.exceptions import WrongPassword
from scriptlets.warlock.base_service import *


class RCONService(BaseService):
	#def __init__(self, service: str, game: BaseGameApp):
	#	super().__init__(service, game)

	def _rcon_cmd(self, cmd) -> Union[None,str]:
		"""
		Execute a raw command with RCON and return the result

		:param cmd:
		:return: None if RCON not available, or the result of the command
		"""
		if not self.is_running():
			# If service is not running, don't even try to connect.
			return None

		if not self.is_api_enabled():
			# RCON is not available due to settings
			return None

		try:
			with Client('127.0.0.1', self.get_api_port(), passwd=self.get_api_password(), timeout=2) as client:
				return client.run(cmd).strip()
		except:
			return None

	def is_api_enabled(self) -> bool:
		"""
		Check if RCON is enabled for this service
		:return:
		"""
		pass

	def get_api_port(self) -> int:
		"""
		Get the RCON port from the service configuration
		:return:
		"""
		pass

	def get_api_password(self) -> str:
		"""
		Get the RCON password from the service configuration
		:return:
		"""
		pass