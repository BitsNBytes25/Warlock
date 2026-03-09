# Local Development

This guide covers setting up a local development environment on Windows using Vagrant.

## Prerequisites

- [Vagrant](https://www.vagrantup.com/)
- [VMware Desktop](https://www.vmware.com/products/fusion.html) (Workstation on Windows/Linux, Fusion on Mac)
- [vagrant-vmware-desktop plugin](https://developer.hashicorp.com/vagrant/docs/providers/vmware/installation)

## First-Time Setup

```bash
vagrant up
```

This will download the Ubuntu 24.04 base box, provision the VM, install Node.js, and run `npm install`. A `.env` file with development defaults is created automatically if one does not exist.

## Starting the Dev Server

```bash
vagrant ssh
cd /vagrant && npm run dev
```

Browse to `http://localhost:3077`. On first run you will be prompted to create an admin user.

## Daily Workflow

The project directory is mounted inside the VM at `/vagrant`. Edit files on your host machine as normal — changes are reflected immediately and nodemon restarts the server automatically.

To stop the server: `Ctrl+C`. To suspend the VM when done: `vagrant halt`.

## After Pulling Changes

If `package.json` has changed, re-run npm install inside the VM:

```bash
vagrant provision --provision-with install
```

If only source files changed, nodemon handles it automatically.

## Resetting the Database

The SQLite database persists across `vagrant halt`/`up` but is wiped by `vagrant destroy`. To reset to a clean state without destroying the VM:

```bash
rm /vagrant/warlock.sqlite
```

The next server start recreates the schema and redirects to `/install`.

## Troubleshooting

**nodemon not restarting on file changes** — some hypervisor configurations do not propagate file-change events across shared folders. Start nodemon with legacy polling mode as a workaround:

```bash
nodemon -L app.js
```
