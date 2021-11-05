'use strict';

const Homey = require('homey');
const net = require("net");

module.exports = class SmartPresenceDriver extends Homey.Driver {

  onInit() {
    this.log('SmartPresence driver has been initialized');
  }

  async onPair(session) {
    session.setHandler('device_input', async (data) => {
      //this.log('device_input', data);
      if (!data.devicename) {
        throw new Error(this.homey.__('pair.configuration.invalid_device_name'));
      } else if (!data.ip_address) {
        throw new Error(this.homey.__('pair.configuration.missing_ip_address'));
      } else if (!net.isIP(data.ip_address)) {
        throw new Error(this.homey.__('pair.configuration.invalid_ip_address'));
      }
    });
  }

};


