#!/usr/bin/env sh

# constants
UPDATE_STAMP_PATH=/var/lib/apt/periodic/update-success-stamp

cleanup() {
	if test $? -eq 0; then
		log_info "Provisioning completed sucesfully"
		exit 0
	fi
	log_error "Provisioning failed."
	exit 1
}

# helpers
log_info() {
	echo "\033[34m[INFO] $1\033[0m"
}
log_error() {
	echo "\033[31m[ERROR] $1\033[0m"
}
# install package via apt, params:
# $1: package name
apt_install() {
	sudo apt-get -y install $1
}
# ensure package is install via apt, params:
# $1: package name
apt_ensure_installed() {
	if ! hash $1 >/dev/null; then
		apt_install "$1"
	fi
}

# exit on exception
set -e
# cleanup on exit
trap "cleanup" EXIT
log_info "Provisioning..."
# if apt-get update has not been run in the last 10 minutes
if test $(find $UPDATE_STAMP_PATH -mmin -10 | wc -l) -eq 0; then
	sudo apt-get update
fi
# install package dependencies
apt_ensure_installed "npm"
apt_ensure_installed "nodejs"
apt_ensure_installed "redis-server"

