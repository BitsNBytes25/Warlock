# Warlock 1.2.0

## Upgrade Notice

Recommended Node.js version increased from v20 to v24.
If manually installed, please re-run `install-warlock.sh`,
(optionally with `--skip-nginx` and/or `--skip-systemd` if you wish to skip those integrations),
to update Node.js and all dependencies.

## New Features

* New default theme courtesy of Karutoil
* Simplify UI by combining games and game instances
* New details page for game instances
* New card view for games and instances
* Docker support for Warlock to be installed in a container
* Graphs and metrics for servers
* Add updater script to update Warlock to the latest git version
* Add support for v2 of the Warlock API to support Typer as the argument parser
* Add support for running custom commands against game instances
* Commands support auto-complete based off game instance, (when supported)

## Fixes

* Responsive design improvements for mobile devices
* Fix on startup for sequelize when database contains backup tables
* Fix OS discovery for new hosts
* Fix SKIP_AUTHENTICATION trying to create a user on first run
* Bump version of Node to v24 and a number of dependencies to address security vulnerabilities


(to sort)
More work for APIv2 support

* Add jar mimetype support
* Return all keys when looking up service data
* Cleanup modals by moving them into their own utility files
* Add support for V2 backups
* Add support for V2 restores
* Add support for V2 file browsing
* New getAPIVersion helper function on frontend
* Remember the page when viewing detail tabs
* Add support for chunked uploads - useful for uploading large files