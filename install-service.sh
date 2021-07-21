#!/bin/bash

set -ex

if [ "`lsb_release -is`" != "Ubuntu" ]
then
    echo "Unsupported OS. Only Ubuntu is supported.";
    exit 1
fi

if [ "$(id -u)" == "0" ]; then
   echo "This script must not be run as root."
   exit 1
fi

# Get the path to the repo
SCRIPT=`realpath $0`
SCRIPTPATH=`dirname $SCRIPT`

# Write service definition
sudo tee /etc/systemd/system/hexdailystats.service > /dev/null << FILE
[Unit]
Description=HEXDailyStats
After=network-online.target
Wants=network-online.target

[Service]
User=${USER}
Type=simple
ExecStart=/usr/bin/node index.js
WorkingDirectory=${SCRIPTPATH}
Restart=always
RestartSec=15

[Install]
WantedBy=multi-user.target
FILE

# Reload the changes
sudo systemctl daemon-reload

# Start automatically on boot
sudo systemctl enable hexdailystats

# Start now
sudo systemctl start hexdailystats
