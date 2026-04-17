# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security


## [1.2.0] - (unreleased)

### Added

- Add support for Vagrant for local development - Thanks [JGillam](https://github.com/JGillam)
- Add mod management support in games
- Add support for Warlock.Nexus integration
- Add support for managing public community profile
- New details page for game instances
- New card view for games and instances
- Docker support for Warlock to be installed in a container
- Graphs and metrics for servers
- Add updater script to update Warlock to the latest git version
- Add support for running custom commands against game instances
- Commands support auto-complete based off game instance, (when supported)
- Add support for installing a new service instance for a game
- Add licensing and included library information on settings page

### Changed

- Change to new modern theme - Thanks [karutoil](https://github.com/karutoil)
- Simplify UI by combining games and game instances
- Add support for v2 of the Warlock API to support Typer as the argument parser
- Notification popups now persist for some errors to allow user to view message
- Adjust server-side caching to provide better performance
- Reduce SSH timeout to 3 seconds for faster responses
- Hidden files are now hidden, but can be displayed by clicking the eye icon
- Move default installation from /var/www/Warlock to /var/www/warlock
- Clear files cache for a variety of actions and increase cache for listing files
- Warlock.Manager now can provide full version strings

### Deprecated

### Removed

### Fixed

- Responsive design improvements for mobile devices
- Fix on startup for sequelize when database contains backup tables
- Fix OS discovery for new hosts
- Fix SKIP_AUTHENTICATION trying to create a user on first run
- Too many more fixes to list...

### Security

- Bump version of Node to v24 and a number of dependencies to address security vulnerabilities


## [1.0.1] - 2026-03-22

### Security

- Fix security issue related to user authentication, potentially allowing unauthorized access to the system.


## [1.0.0] - 2025-11-09

Initial build of Warlock.


---

## Development Notes

This project is under active development. For the latest features and bug fixes, please refer to the [main branch](https://github.com/BitsNBytes25/Warlock).

### Version History Summary

- **v1.0.1**: Initial release with core functionality

[1.2.0]: https://github.com/BitsNBytes25/Warlock/tree/v1.2.0
[1.0.1]: https://github.com/BitsNBytes25/Warlock/tree/v1.0.1
[1.0.0]: https://github.com/BitsNBytes25/Warlock/tree/v1.0.0