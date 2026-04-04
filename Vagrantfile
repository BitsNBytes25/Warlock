Vagrant.configure("2") do |config|
  config.vm.box = "bento/ubuntu-24.04"

  # Expose Warlock UI to Windows host browser
  config.vm.network "forwarded_port", guest: 3077, host: 3077

  config.vm.provider "vmware_desktop" do |v|
    v.memory = 1024
    v.cpus = 2
  end

  # VMware shared folders don't support symlinks, which npm requires for node_modules/.bin/.
  # Bind-mount a native VM directory over node_modules so symlinks land on the real filesystem.
  # run: "always" ensures this mount is restored on every `vagrant up`.
  config.vm.provision "shell", name: "mount", run: "always", inline: <<-SHELL
    mkdir -p /home/vagrant/node_modules_cache /vagrant/node_modules
    mountpoint -q /vagrant/node_modules || mount --bind /home/vagrant/node_modules_cache /vagrant/node_modules
  SHELL

  config.vm.provision "shell", name: "install", inline: <<-SHELL
    set -e
    curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
    apt-get install -y nodejs
    cd /vagrant
    npm install
    if [ ! -f /vagrant/.env ]; then
      printf 'IP=0.0.0.0\nPORT=3077\nNODE_ENV=development\nSESSION_SECRET=%s\n' \
        "$(tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 32)" > /vagrant/.env
    fi
  SHELL
end
