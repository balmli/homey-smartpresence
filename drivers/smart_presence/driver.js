'use strict';

const Homey = require('homey');
const net = require("net");

module.exports = class SmartPresenceDriver extends Homey.Driver {

  onInit() {
    this.log('SmartPresence driver has been initialized');
  }

  onPair(socket) {
    socket.on('device_input', (data, callback) => {
      //this.log('device_input', data);
      if (!data.devicename) {
        callback(new Error(Homey.__('pair.configuration.invalid_device_name')));
      } else if (!data.ip_address) {
        callback(new Error(Homey.__('pair.configuration.missing_ip_address')));
      } else if (!net.isIP(data.ip_address)) {
        callback(new Error(Homey.__('pair.configuration.invalid_ip_address')));
      } else {
        callback(null, true);
      }
    });
  }

};


