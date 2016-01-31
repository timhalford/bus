# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/trusty64"
  config.vm.synced_folder "./", "/opt/bus"
  config.vm.provision :shell, path: "provision.sh"
  config.vm.network "forwarded_port", guest: 80, host: 8080
end
