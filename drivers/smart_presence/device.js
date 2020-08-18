'use strict';

const Homey = require('homey');
const Network = require('../../lib/network');


module.exports = class SmartPresenceDevice extends Homey.Device {

  async onInit() {
    this.log('device initialized');
  }

  getHost() {
    return this.getSetting('host');
  }

  getPort() {
    return '443'
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
        this.log(`${this.toString()}: scanning...`);
        const client = new Network({ log: this.log });
        client.scan(this.getHost(), this.getPort(), this.getTimeout())
          .then(result => {
            this.updateLastSeen();
            this.setPresent(true);
            this.log(`${this.toString()}: online`);
            this._scanning = false;
          })
          .catch(err => {
            this.setPresent(false);
            this.log(`${this.toString()}: offline:`, err.message);
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
    } else if (!present && currentPresent && !this.shouldDelayAwayStateSwitch()) {
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
    }
  }

  getFlowCardTokens() {
    return { who: this.getSetting('name') || this.getName() };
  }

  async userAtHome() {
    return this.getCapabilityValue('onoff');
  }

  clearTimers() {
  }

  toString() {
    return `${this.getHost()}:${this.getPort()}`;
  }

};
