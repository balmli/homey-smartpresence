'use strict';

const Homey = require('homey');
const Network = require('../../lib/network');

module.exports = class SmartPresenceDevice extends Homey.Device {

  async onInit() {
    await this._migrate();
    this._client = new Network({ log: this.log });
  }

  async _migrate() {
    try {
      if (!this.hasCapability('onoff')) {
        await this.addCapability('onoff');
      }
    } catch (err) {
      this.log('Migration failed', err);
    }
  }

  getHost() {
    return this.getSetting('host');
  }

  getPort() {
    const numbers = ['1', '32000'];
    return numbers[Math.floor(Math.random() * numbers.length)];
  }

  getNormalModeInterval() {
    return this.getSetting('normal_mode_interval');
  }

  getNormalModeTimeout() {
    return this.getSetting('host_timeout') * 1000;
  }

  getAwayDelayInMillis() {
    return this.getSetting('away_delay') * 1000;
  }

  getStressModeInterval() {
    return this.getSetting('stress_mode_interval');
  }

  getStressModeTimeout() {
    return this.getSetting('stress_host_timeout') * 1000;
  }

  getStressAtInMillis() {
    return this.getSetting('start_stressing_at') * 1000;
  }

  isHouseHoldMember() {
    return !this.isGuest();
  }

  isGuest() {
    return this.getSetting('is_guest');
  }

  getLastSeen() {
    return this.getStoreValue('lastSeen') || 0;
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

  shouldStressCheck() {
    return !!this.getCapabilityValue('onoff') &&
      ((this.getAwayDelayInMillis() - this.getSeenMillisAgo()) < this.getStressAtInMillis());
  }

  async scan() {
    try {
      const now = Date.now();
      const stressTest = this.shouldStressCheck();
      const shouldScan = !this._lastScan ||
        stressTest && (now - this._lastScan > this.getStressModeInterval()) ||
        !stressTest && (now - this._lastScan > this.getNormalModeInterval());

      if (shouldScan && !this._scanning) {
        this._scanning = true;
        this._lastScan = Date.now();
        const host = this.getHost();
        const port = this.getPort();
        const timeout = stressTest ? this.getStressModeTimeout() : this.getNormalModeTimeout();
        //this.log(`${host}:${port}: scanning, stress: ${stressTest}`);
        this._client.scan(host, port, timeout)
          .then(result => {
            this.updateLastSeen();
            this.setPresent(true);
            //this.log(`${host}:${port}: online`);
            this._scanning = false;
          })
          .catch(err => {
            this.setPresent(false);
            //this.log(`${host}:${port}: offline:`, err.message);
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
    } else if (!present && (currentPresent || currentPresent === null)) {
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
    return !!this.getCapabilityValue('onoff');
  }

};
