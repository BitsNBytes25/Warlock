import argparse
import json
import sys
from scriptlets._common.get_wan_ip import *


def menu_get_services(game):
	services = game.get_services()
	stats = {}
	for svc in services:
		if svc.is_starting():
			status = 'starting'
		elif svc.is_stopping():
			status = 'stopping'
		elif svc.is_running():
			status = 'running'
		else:
			status = 'stopped'

		pre_exec = svc.get_exec_start_pre_status()
		start_exec = svc.get_exec_start_status()
		if pre_exec and pre_exec['start_time']:
			pre_exec['start_time'] = int(pre_exec['start_time'].timestamp())
		if pre_exec and pre_exec['stop_time']:
			pre_exec['stop_time'] = int(pre_exec['stop_time'].timestamp())
		if start_exec and start_exec['start_time']:
			start_exec['start_time'] = int(start_exec['start_time'].timestamp())
		if start_exec and start_exec['stop_time']:
			start_exec['stop_time'] = int(start_exec['stop_time'].timestamp())

		svc_stats = {
			'service': svc.service,
			'name': svc.get_name(),
			'ip': get_wan_ip(),
			'port': svc.get_port(),
			'status': status,
			'enabled': svc.is_enabled(),
			'player_count': svc.get_player_count(),
			'max_players': svc.get_player_max(),
			'memory_usage': svc.get_memory_usage(),
			'cpu_usage': svc.get_cpu_usage(),
			'game_pid': svc.get_game_pid(),
			'service_pid': svc.get_pid(),
			'pre_exec': pre_exec,
			'start_exec': start_exec,
		}
		stats[svc.service] = svc_stats
	print(json.dumps(stats))


def run_manager(game):
	parser = argparse.ArgumentParser('manage.py')

	# Service specification - some options can only be performed on a given service
	parser.add_argument(
		'--service',
		help='Specify the service instance to manage (default: ALL)',
		type=str,
		default='ALL'
	)

	# Basic start/stop operations
	parser.add_argument(
		'--pre-stop',
		help='Send notifications to game players and Discord and save the world',
		action='store_true'
	)
	parser.add_argument(
		'--post-start',
		help='Send notifications to game players and Discord after starting the server',
		action='store_true'
	)
	parser.add_argument(
		'--stop',
		help='Stop the game server',
		action='store_true'
	)
	parser.add_argument(
		'--start',
		help='Start the game server',
		action='store_true'
	)
	parser.add_argument(
		'--restart',
		help='Restart the game server',
		action='store_true'
	)
	parser.add_argument(
		'--is-running',
		help='Check if any game service is currently running (exit code 0 = yes, 1 = no)',
		action='store_true'
	)

	# Backup/restore operations
	parser.add_argument(
		'--backup',
		help='Backup the game server files',
		action='store_true'
	)
	parser.add_argument(
		'--max-backups',
		help='Maximum number of backups to keep when creating a new backup (default: 0 = unlimited)',
		type=int,
		default=0
	)
	parser.add_argument(
		'--restore',
		help='Restore the game server files from a backup archive',
		type=str,
		default=''
	)

	parser.add_argument(
		'--check-update',
		help='Check for game updates and report the status',
		action='store_true'
	)
	parser.add_argument(
		'--update',
		help='Update the game server to the latest version',
		action='store_true'
	)
	parser.add_argument(
		'--get-services',
		help='List the available service instances for this game (JSON encoded)',
		action='store_true'
	)
	parser.add_argument(
		'--get-configs',
		help='List the available configuration files for this game (JSON encoded)',
		action='store_true'
	)
	parser.add_argument(
		'--set-config',
		help='Set a configuration option for the game',
		type=str,
		nargs=2
	)
	parser.add_argument(
		'--logs',
		help='Print the latest logs from the game service',
		action='store_true'
	)
	parser.add_argument(
		'--first-run',
		help='Perform first-run configuration for setting up the game server initially',
		action='store_true'
	)
	args = parser.parse_args()

	services = game.get_services()

	if args.service != 'ALL':
		# User opted to manage only a single game instance
		svc = None
		for service in services:
			if service.service == args.service:
				svc = service
				break
		if svc is None:
			print('Service instance %s not found!' % args.service, file=sys.stderr)
			sys.exit(1)
		services = [svc]

	if args.pre_stop:
		if len(services) > 1:
			print('ERROR: --pre-stop can only be used with a single service instance at a time.', file=sys.stderr)
			sys.exit(1)
		svc = services[0]
		sys.exit(0 if svc.pre_stop() else 1)
	elif args.post_start:
		if len(services) > 1:
			print('ERROR: --post-start can only be used with a single service instance at a time.', file=sys.stderr)
			sys.exit(1)
		svc = services[0]
		sys.exit(0 if svc.post_start() else 1)
	elif args.stop:
		for svc in services:
			svc.stop()
		sys.exit(0)
	elif args.start:
		if len(services) > 1:
			# Start any enabled instance
			for svc in services:
				if svc.is_enabled():
					svc.start()
				else:
					print('Skipping %s as it is not enabled for auto-start.' % svc.service)
		else:
			for svc in services:
				svc.start()
	elif args.restart:
		for svc in services:
			svc.restart()
	elif args.backup:
		sys.exit(0 if game.backup(args.max_backups) else 1)
	elif args.restore != '':
		sys.exit(0 if game.restore(args.restore) else 1)
	elif args.check_update:
		sys.exit(0 if game.check_update_available() else 1)
	elif args.update:
		sys.exit(0 if game.update() else 1)
	elif args.get_services:
		menu_get_services(game)
	elif args.get_configs:
		opts = []
		if args.service == 'ALL':
			source = game
		else:
			svc = services[0]
			source = svc
		for opt in source.get_options():
			opts.append({
				'option': opt,
				'default': source.get_option_default(opt),
				'value': source.get_option_value(opt),
				'type': source.get_option_type(opt),
				'help': source.get_option_help(opt),
				'options': source.get_option_options(opt),
			})
		print(json.dumps(opts))
		sys.exit(0)
	elif args.set_config != None:
		option, value = args.set_config
		if args.service == 'ALL':
			game.set_option(option, value)
		else:
			svc = services[0]
			svc.set_option(option, value)
	elif args.first_run:
		if not callable(getattr(sys.modules[__name__], 'menu_first_run', None)):
			print('First-run configuration is not supported for this game.', file=sys.stderr)
			sys.exit(1)
		menu_first_run(game)
	else:
		if len(services) > 1:
			if not callable(getattr(sys.modules[__name__], 'menu_main', None)):
				print('This game does not have any manageable interface, please use Warlock.', file=sys.stderr)
				sys.exit(1)
			menu_main(game)
		else:
			if not callable(getattr(sys.modules[__name__], 'menu_service', None)):
				print('This game does not have any manageable interface, please use Warlock.', file=sys.stderr)
				sys.exit(1)
			svc = services[0]
			menu_service(svc)
