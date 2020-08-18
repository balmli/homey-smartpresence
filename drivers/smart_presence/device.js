'use strict';

const Homey = require('homey');
const Network = require('../../lib/network');


module.exports = class SmartPresenceDevice extends Homey.Device {

  async onInit() {
  }

  getHost() {
    return this.getSetting('host');
  }

  getPort() {
    const numbers = ['1', '32000'];
    return numbers[Math.floor(Math.random() * numbers.length)];
  }

  getTimeout() {
    return this.getSetting('host_timeout') * 1000;
  }

  getAwayDelayInMillis() {
    return this.getSetting('away_delay') * 1000;
  }

  isHouseHoldMember() {
    return !this.isGuest();
  }

  isGuest() {
    return this.getSetting('is_guest');
  }

  getLastSeen() {
    return this.getStoreValue('lastSeen');
  }

  async updateLastSeen() {
    await this.setStoreValue('lastSeen', Date.now());
  }

  getSeenMillisAgo() {
    return Date.now() - this.getLastSeen();
  }

  shouldDelayAwayStateSwitch() {
    return this.getSeenMillisAgo() < this.getAwayDelayInMillis();
  }

  async scan() {
    try {
      if (!this._scanning) {
        this._scanning = true;
        const port = this.getPort();
        //this.log(`${this.getHost()}:${port}: scanning...`);
        const client = new Network({ log: this.log });
        client.scan(this.getHost(), port, this.getTimeout())
          .then(result => {
            this.updateLastSeen();
            this.setPresent(true);
            //this.log(`${this.getHost()}:${port}: online`);
            this._scanning = false;
          })
          .catch(err => {
            this.setPresent(false);
            //this.log(`${this.getHost()}:${port}: offline:`, err.message);
            this._scanning = false;
          });
      }
    } catch (err) {
      this._scanning = false;
    }
  }

  async setPresent(present) {
    const currentPresent = this.getCapabilityValue('onoff');

    if (present && !currentPresent) {
      this.log(`${this.getHost()} - ${this.getDeviceName()}: is online`);
      await this.setCapabilityValue('onoff', present);
      Homey.app.deviceArrived(this);
      Homey.app.userEnteredTrigger.trigger(this, this.getFlowCardTokens(), {});
      Homey.app.someoneEnteredTrigger.trigger(this.getFlowCardTokens(), {});
      if (this.isHouseHoldMember()) {
        Homey.app.householdMemberArrivedTrigger.trigger(this.getFlowCardTokens(), {});
      }
      if (this.isGuest()) {
        Homey.app.guestArrivedTrigger.trigger(this.getFlowCardTokens(), {});
      }
    } else if (!present && currentPresent) {
      if (!this.shouldDelayAwayStateSwitch()) {
        this.log(`${this.getHost()} - ${this.getDeviceName()}: is marked as offline`);
        await this.setCapabilityValue('onoff', present);
        Homey.app.deviceLeft(this);
        Homey.app.userLeftTrigger.trigger(this, this.getFlowCardTokens(), {});
        Homey.app.someoneLeftTrigger.trigger(this.getFlowCardTokens(), {});
        if (this.isHouseHoldMember()) {
          Homey.app.householdMemberLeftTrigger.trigger(this.getFlowCardTokens(), {});
        }
        if (this.isGuest()) {
          Homey.app.guestLeftTrigger.trigger(this.getFlowCardTokens(), {});
        }
      } else {
        this.log(`${this.getHost()} - ${this.getDeviceName()}: is offline`);
      }
    }
  }

  getDeviceName() {
    return this.getSetting('name') || this.getName();
  }

  getFlowCardTokens() {
    return { who: this.getDeviceName() };
  }

  async userAtHome() {
    return this.getCapabilityValue('onoff');
  }

  clearTimers() {
  }

};
