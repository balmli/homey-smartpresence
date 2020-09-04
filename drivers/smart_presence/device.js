'use strict';

const Homey = require('homey');
const Network = require('../../lib/network');

module.exports = class SmartPresenceDevice extends Homey.Device {

  async onInit() {
    await this._migrate();
    this._client = new Network({ log: this.log });
    this.scan();
  }

  async _migrate() {
    try {
      if (!this.hasCapability('onoff')) {
        await this.addCapability('onoff');
      }
      const ver = this.getStoreValue('ver');
      if (ver === null) {
        if (this.getNormalModeInterval() < 3000) {
          await this.setSettings({ normal_mode_interval: 3000 });
          this.log('_migrate: normal_mode_interval set to', this.getNormalModeInterval());
        }
        if (this.getStressModeInterval() < 1500) {
          await this.setSettings({ stress_mode_interval: 1500 });
          this.log('_migrate: stress_mode_interval set to', this.getStressModeInterval());
        }
        await this.setStoreValue('ver', 1);
        this.log('_migrate: set ver to', this.getStoreValue('ver'));
      }
    } catch (err) {
      this.log('Migration failed', err);
    }
  }

  onDeleted() {
    this._deleted = true;
    this.clearScanTimer();
    this.log('device deleted');
  }

  getHost() {
    return this.getSetting('host');
  }

  getPort() {
    const port = this.getSetting('port');
    if (port !== 32000) {
      return port;
    }
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

  clearScanTimer() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = undefined;
    }
  }

  scheduleScans(interval) {
    if (this._deleted) {
      return;
    }
    this.clearScanTimer();
    this.scanTimer = setTimeout(this.scan.bind(this), interval);
  }

  async scan() {
    const host = this.getHost();
    const port = this.getPort();
    const stressTest = this.shouldStressCheck();
    const interval = stressTest ? this.getStressModeInterval() : this.getNormalModeInterval();
    const timeout = stressTest ? this.getStressModeTimeout() : this.getNormalModeTimeout();
    try {
      //this.log(`${host}:${port}: scanning, timeout: ${timeout}, interval: ${interval}`);
      await this._client.scan(host, port, timeout);
      await this.updateLastSeen();
      //this.log(`${host}:${port}: timeout: ${timeout}, interval: ${interval} -> online`);
      await this.setPresent(true);
    } catch (err) {
      //this.log(`${host}:${port}: timeout: ${timeout}, interval: ${interval} -> offline:`, err.message);
      await this.setPresent(false);
    } finally {
      this.scheduleScans(interval);
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
