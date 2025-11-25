import json
from typing import Union
from urllib import request
from scriptlets.warlock.base_service import *


class HTTPService(BaseService):

	def __init__(self, service: str, game: BaseApp):
		super().__init__(service, game)

	def _http_cmd(self, cmd: str, method: str = 'GET', data: dict = None):
		method = method.upper()

		if not (self.is_running() or self.is_stopping):
			# If service is not running, don't even try to connect.
			return None

		if not self.is_api_enabled():
			# No REST API enabled, unable to retrieve any data
			return None

		req = request.Request(
			'http://127.0.0.1:%s%s' % (str(self.get_api_port()), cmd),
			headers={
				'Content-Type': 'application/json; charset=utf-8',
				'Accept': 'application/json',
			},
			method=method
		)
		try:
			if method == 'POST' and data is not None:
				data = bytearray(json.dumps(data), 'utf-8')
				req.add_header('Content-Length', str(len(data)))
				with request.urlopen(req, data) as resp:
					ret = resp.read().decode('utf-8')
					if ret == '':
						return None
					else:
						return json.loads(ret)
			else:
				with request.urlopen(req) as resp:
					ret = resp.read().decode('utf-8')
					if ret == '':
						return None
					else:
						return json.loads(ret)
		except:
			return None

	def is_api_enabled(self) -> bool:
		"""
		Check if HTTP API is enabled for this service
		:return:
		"""
		pass

	def get_api_port(self) -> int:
		"""
		Get the HTTP API port from the service configuration
		:return:
		"""
		pass
