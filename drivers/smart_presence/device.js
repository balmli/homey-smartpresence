'use strict';

const Homey = require('homey');
const net = require('net');

module.exports = class SmartPresenceDevice extends Homey.Device {

  async onInit() {
    this._settings = this.getSettings();
    await this._migrate();
    this._present = this.getCapabilityValue('presence');
    this._lastSeen = this.getStoreValue('lastSeen') || 0;
    this.scan();
  }

  async _migrate() {
    try {
      const ver = this.getStoreValue('ver');
      if (ver === null) {
        if (this.getNormalModeInterval() < 3000) {
          await this.setSettings({ normal_mode_interval: 3000 });
        }
        if (this.getStressModeInterval() < 1500) {
          await this.setSettings({ stress_mode_interval: 1500 });
        }
      }
      if (ver < 2) {
        if (this.hasCapability('onoff')) {
          const presence = this.getCapabilityValue('onoff');
          await this.removeCapability('onoff');
          await this.addCapability('presence');
          await this.setCapabilityValue('presence', presence).catch(this.error);
        }
        await this.setStoreValue('ver', 2);
      }
    } catch (err) {
      this.log('Migration failed', err);
    }
  }

  onDeleted() {
    this._deleted = true;
    this.destroyClient();
    this.clearScanTimer();
    this.log('device deleted');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this._settings = newSettings;
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
    try {
      //this.log(`${host}:${port}: scanning, timeout: ${timeout}, interval: ${interval}`);
      this.scanDevice(host, port, timeout);
    } finally {
      this.scheduleScans(interval);
    }
  }

  destroyClient() {
    if (this.client) {
      this.client.destroy();
      this.client = undefined;
    }
    if (this.cancelCheck) {
      this.homey.clearTimeout(this.cancelCheck);
      this.cancelCheck = undefined;
    }
  }

  scanDevice(host, port, timeout) {
    this.destroyClient();
    this.client = new net.Socket();

    this.cancelCheck = this.homey.setTimeout(() => {
      this.destroyClient();
      //this.log(`${host}:${port}: Timeout -> Offline`);
      this.setPresent(false);
    }, timeout);

    this.client.on('error', (err) => {
      this.destroyClient();
      if (err && err.errno === "ECONNREFUSED") {
        //this.log(`${host}:${port}: Connection refused -> Online`);
        this.setPresent(true);
      } else {
        //this.log(`${host}:${port}: Error -> Offline`);
        this.setPresent(false);
      }
    });

    try {
      this.client.connect(port, host, () => {
        this.destroyClient();
        //this.log(`${host}:${port}: Connected -> Online`);
        this.setPresent(true);
      });
    } catch (err) {
      this.destroyClient();
      //this.log(`${host}:${port}: Connection error -> Offline`);
      this.setPresent(false);
    }
  }

  async setPresent(present) {
    const currentPresent = this.getPresenceStatus();
    const tokens = this.getFlowCardTokens();

    if (present) {
      this.updateLastSeen();
    }

    if (present && !currentPresent) {
      this.log(`${this.getHost()} - ${this.getName()}: is online`);
      await this.setPresenceStatus(present);
      await this.homey.app.deviceArrived(this);
      await this.homey.app.userEnteredTrigger.trigger(this, tokens, {}).catch(this.error);
      await this.homey.app.someoneEnteredTrigger.trigger(tokens, {}).catch(this.error);
      if (this.isHouseHoldMember()) {
        await this.homey.app.householdMemberArrivedTrigger.trigger(tokens, {}).catch(this.error);
      }
      if (this.isKid()) {
        await this.homey.app.kidArrivedTrigger.trigger(tokens, {}).catch(this.error);
      }
      if (this.isGuest()) {
        await this.homey.app.guestArrivedTrigger.trigger(tokens, {}).catch(this.error);
      }
    } else if (!present && (currentPresent || currentPresent === null)) {
      if (!this.shouldDelayAwayStateSwitch()) {
        this.log(`${this.getHost()} - ${this.getName()}: is marked as offline`);
        await this.setPresenceStatus(present);
        await this.homey.app.deviceLeft(this);
        await this.homey.app.userLeftTrigger.trigger(this, tokens, {}).catch(this.error);
        await this.homey.app.someoneLeftTrigger.trigger(tokens, {}).catch(this.error);
        if (this.isHouseHoldMember()) {
          await this.homey.app.householdMemberLeftTrigger.trigger(tokens, {}).catch(this.error);
        }
        if (this.isKid()) {
          await this.homey.app.kidLeftTrigger.trigger(tokens, {}).catch(this.error);
        }
        if (this.isGuest()) {
          await this.homey.app.guestLeftTrigger.trigger(tokens, {}).catch(this.error);
        }
      }
    }
  }

  getFlowCardTokens() {
    return { who: this.getName() };
  }

  getPresenceStatus() {
    return this._present;
  }

  async setPresenceStatus(present) {
    this._present = present;
    await this.setCapabilityValue('presence', present).catch(this.error);
  }

  async userAtHome() {
    return !!this.getCapabilityValue('presence');
  }

};
