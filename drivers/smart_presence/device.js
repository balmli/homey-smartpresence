'use strict';

const Homey = require('homey');
const Network = require('../../lib/network');

module.exports = class SmartPresenceDevice extends Homey.Device {

  async onInit() {
    this._settings = this.getSettings();
    await this._migrate();
    this._client = new Network({ homey: this.homey, log: this.log });
    this._present = this.getCapabilityValue('onoff');
    this._lastSeen = this.getStoreValue('lastSeen') || 0;
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
        }
        if (this.getStressModeInterval() < 1500) {
          await this.setSettings({ stress_mode_interval: 1500 });
        }
        await this.setStoreValue('ver', 1);
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

  async onSettings({ oldSettingsObj, newSettingsObj, changedKeysArr }) {
    this._settings = newSettingsObj;
  }

  getHost() {
    return this._settings.host;
  }

  getPort() {
    const port = this._settings.port;
    if (port !== 32000) {
      return port;
    }
    const numbers = ['1', '32000'];
    return numbers[Math.floor(Math.random() * numbers.length)];
  }

  getNormalModeInterval() {
    return this._settings.normal_mode_interval;
  }

  getNormalModeTimeout() {
    return this._settings.host_timeout * 1000;
  }

  getAwayDelayInMillis() {
    return this._settings.away_delay * 1000;
  }

  getStressModeInterval() {
    return this._settings.stress_mode_interval;
  }

  getStressModeTimeout() {
    return this._settings.stress_host_timeout * 1000;
  }

  getStressAtInMillis() {
    return this._settings.start_stressing_at * 1000;
  }

  isHouseHoldMember() {
    return !this.isGuest();
  }

  isKid() {
    return this._settings.is_kid;
  }

  isGuest() {
    return this._settings.is_guest;
  }

  getLastSeen() {
    return this._lastSeen;
  }

  async updateLastSeen() {
    this._lastSeen = Date.now();
    if (!this._lastSeenStored || this._lastSeen - this._lastSeenStored > 60000) {
      await this.setStoreValue('lastSeen', this._lastSeen);
      this._lastSeenStored = this._lastSeen;
    }
  }

  getSeenMillisAgo() {
    return Date.now() - this.getLastSeen();
  }

  shouldDelayAwayStateSwitch() {
    return this.getSeenMillisAgo() < this.getAwayDelayInMillis();
  }

  shouldStressCheck() {
    return !!this.getPresenceStatus() &&
      ((this.getAwayDelayInMillis() - this.getSeenMillisAgo()) < this.getStressAtInMillis());
  }

  clearScanTimer() {
    if (this.scanTimer) {
      this.homey.clearTimeout(this.scanTimer);
      this.scanTimer = undefined;
    }
  }

  scheduleScans(interval) {
    if (this._deleted) {
      return;
    }
    this.clearScanTimer();
    this.scanTimer = this.homey.setTimeout(this.scan.bind(this), interval);
  }

  async scan() {
    const host = this.getHost();
    const port = this.getPort();
    const stressTest = this.shouldStressCheck();
    const interval = stressTest ? this.getStressModeInterval() : this.getNormalModeInterval();
    const timeout = stressTest ? this.getStressModeTimeout() : this.getNormalModeTimeout();
    const start = Date.now();
    try {
      //this.log(`${host}:${port}: scanning, timeout: ${timeout}, interval: ${interval}`);
      await this._client.scan(host, port, timeout);
      await this.updateLastSeen();
      //this.log(`${host}:${port}: timeout: ${timeout}, interval: ${interval} -> online (${Date.now() - start} ms)`);
      await this.setPresent(true);
    } catch (err) {
      //this.log(`${host}:${port}: timeout: ${timeout}, interval: ${interval} -> offline  (${Date.now() - start} ms):`, err.message);
      await this.setPresent(false);
    } finally {
      this.scheduleScans(interval);
    }
  }

  async setPresent(present) {
    const currentPresent = this.getPresenceStatus();

    if (present && !currentPresent) {
      this.log(`${this.getHost()} - ${this.getDeviceName()}: is online`);
      await this.setPresenceStatus(present);
      this.homey.app.deviceArrived(this);
      this.homey.app.userEnteredTrigger.trigger(this, this.getFlowCardTokens(), {});
      this.homey.app.someoneEnteredTrigger.trigger(this.getFlowCardTokens(), {});
      if (this.isHouseHoldMember()) {
        this.homey.app.householdMemberArrivedTrigger.trigger(this.getFlowCardTokens(), {});
      }
      if (this.isKid()) {
        this.homey.app.kidArrivedTrigger.trigger(this.getFlowCardTokens(), {});
      }
      if (this.isGuest()) {
        this.homey.app.guestArrivedTrigger.trigger(this.getFlowCardTokens(), {});
      }
    } else if (!present && (currentPresent || currentPresent === null)) {
      if (!this.shouldDelayAwayStateSwitch()) {
        this.log(`${this.getHost()} - ${this.getDeviceName()}: is marked as offline`);
        await this.setPresenceStatus(present);
        this.homey.app.deviceLeft(this);
        this.homey.app.userLeftTrigger.trigger(this, this.getFlowCardTokens(), {});
        this.homey.app.someoneLeftTrigger.trigger(this.getFlowCardTokens(), {});
        if (this.isHouseHoldMember()) {
          this.homey.app.householdMemberLeftTrigger.trigger(this.getFlowCardTokens(), {});
        }
        if (this.isKid()) {
          this.homey.app.kidLeftTrigger.trigger(this.getFlowCardTokens(), {});
        }
        if (this.isGuest()) {
          this.homey.app.guestLeftTrigger.trigger(this.getFlowCardTokens(), {});
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

  getPresenceStatus() {
    return this._present;
  }

  async setPresenceStatus(present) {
    this._present = present;
    await this.setCapabilityValue('onoff', present);
  }

  async userAtHome() {
    return !!this.getCapabilityValue('onoff');
  }

};
