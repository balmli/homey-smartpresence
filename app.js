'use strict';

const Homey = require('homey');

module.exports = class SmartPresenceApp extends Homey.App {

  async onInit() {
    try {
      Homey.on('unload', () => this._onUninstall());
      await this.initFlows();
      this._presenceStatus = [];
      this.scheduleScans();
      this.log('SmartPresenceApp is running...');
    } catch (err) {
      this.log('onInit error', err);
    }
  }

  async initFlows() {
    this.firstGuestArrivedTrigger = new Homey.FlowCardTrigger('first_guest_arrived');
    await this.firstGuestArrivedTrigger.register();

    this.firstHouseholdMemberArrivedTrigger = new Homey.FlowCardTrigger('first_household_member_arrived');
    await this.firstHouseholdMemberArrivedTrigger.register();

    this.firstPersonEnteredTrigger = new Homey.FlowCardTrigger('first_person_entered');
    await this.firstPersonEnteredTrigger.register();

    this.guestArrivedTrigger = new Homey.FlowCardTrigger('guest_arrived');
    await this.guestArrivedTrigger.register();

    this.guestLeftTrigger = new Homey.FlowCardTrigger('guest_left');
    await this.guestLeftTrigger.register();

    this.householdMemberArrivedTrigger = new Homey.FlowCardTrigger('household_member_arrived');
    await this.householdMemberArrivedTrigger.register();

    this.householdMemberLeftTrigger = new Homey.FlowCardTrigger('household_member_left');
    await this.householdMemberLeftTrigger.register();

    this.lastGuestLeftTrigger = new Homey.FlowCardTrigger('last_guest_left');
    await this.lastGuestLeftTrigger.register();

    this.lastHouseholdMemberLeftTrigger = new Homey.FlowCardTrigger('last_household_member_left');
    await this.lastHouseholdMemberLeftTrigger.register();

    this.lastPersonLeftTrigger = new Homey.FlowCardTrigger('last_person_left');
    await this.lastPersonLeftTrigger.register();

    this.someoneEnteredTrigger = new Homey.FlowCardTrigger('someone_entered');
    await this.someoneEnteredTrigger.register();

    this.someoneLeftTrigger = new Homey.FlowCardTrigger('someone_left');
    await this.someoneLeftTrigger.register();

    this.userEnteredTrigger = new Homey.FlowCardTriggerDevice('user_entered');
    await this.userEnteredTrigger.register();

    this.userLeftTrigger = new Homey.FlowCardTriggerDevice('user_left');
    await this.userLeftTrigger.register();

    new Homey.FlowCardCondition('a_household_member_is_home')
      .register()
      .registerRunListener((args, state) => this.householdMemberIsHome(args, state));

    new Homey.FlowCardCondition('having_guests')
      .register()
      .registerRunListener((args, state) => this.havingGuests(args, state));

    new Homey.FlowCardCondition('someone_at_home')
      .register()
      .registerRunListener((args, state) => this.someoneAtHome(args, state));

    new Homey.FlowCardCondition('user_at_home')
      .register()
      .registerRunListener((args, state) => args.device.userAtHome());
  }

  async householdMemberIsHome(args, state) {
    return this.getPresenceStatus().filter(d => d.present && !d.guest).length > 0;
  }

  async havingGuests(args, state) {
    return this.getPresenceStatus().filter(d => d.present && d.guest).length > 0;
  }

  async someoneAtHome(args, state) {
    return this.getPresenceStatus().filter(d => d.present).length > 0;
  }

  clearScanTimer() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = undefined;
    }
  }

  scheduleScans(interval = 10) {
    if (this._deleted) {
      return;
    }
    this.clearScanTimer();
    this.scanTimer = setTimeout(this.doScan.bind(this), interval * 1000);
  }

  async doScan() {
    if (this._deleted) {
      return;
    }
    try {
      this.clearScanTimer();
      this.scanDevices();
    } catch (err) {
      this.log('doScan error', err);
    } finally {
      this.scheduleScans();
    }
  }

  scanDevices() {
    this._presenceStatus = this.getPresenceStatus();
    const driver = Homey.ManagerDrivers.getDriver('smart_presence');
    const devices = driver.getDevices();
    for (let device of devices) {
      if (device.getHost && device.getPort) {
        device.scan();
      }
    }
  }

  getPresenceStatus() {
    const status = [];
    const driver = Homey.ManagerDrivers.getDriver('smart_presence');
    const devices = driver.getDevices();
    for (let device of devices) {
      status.push({
        present: device.getCapabilityValue('onoff'),
        guest: device.isGuest(),
        lastSeen: device.getLastSeen()
      });
    }
    //this.log('getPresenceStatus', status);
    return status;
  }

  deviceArrived(device) {
    const currentPrecenseStatus = this.getPresenceStatus();
    this.log('deviceArrived', currentPrecenseStatus);
    if (this._presenceStatus.filter(d => d.present).length === 0) {
      Homey.app.firstPersonEnteredTrigger.trigger(device.getFlowCardTokens(), {});
    }
    if (device.isHouseHoldMember() && this._presenceStatus.filter(d => d.present && !d.guest).length === 0) {
      Homey.app.firstHouseholdMemberArrivedTrigger.trigger(device.getFlowCardTokens(), {});
    }
    if (device.isGuest() && this._presenceStatus.filter(d => d.present && d.guest).length === 0) {
      Homey.app.firstGuestArrivedTrigger.trigger(device.getFlowCardTokens(), {});
    }
  }

  deviceLeft(device) {
    const currentPrecenseStatus = this.getPresenceStatus();
    this.log('deviceLeft', currentPrecenseStatus);
    if (currentPrecenseStatus.filter(d => d.present).length === 0) {
      Homey.app.lastPersonLeftTrigger.trigger(device.getFlowCardTokens(), {});
    }
    if (device.isHouseHoldMember() && currentPrecenseStatus.filter(d => d.present && !d.guest).length === 0) {
      Homey.app.lastHouseholdMemberLeftTrigger.trigger(device.getFlowCardTokens(), {});
    }
    if (device.isGuest() && currentPrecenseStatus.filter(d => d.present && d.guest).length === 0) {
      Homey.app.lastGuestLeftTrigger.trigger(device.getFlowCardTokens(), {});
    }
  }

  _onUninstall() {
    this._deleted = true;
    try {
      this._clearTimers();
    } catch (err) {
      this.log('_onUninstall error', err);
    }
  }

  _clearTimers() {
    const drivers = Homey.ManagerDrivers.getDrivers();
    if (drivers) {
      for (let key in drivers) {
        if (drivers.hasOwnProperty(key)) {
          const driver = drivers[key];
          const devices = driver.getDevices();
          for (let device of devices) {
            if (device.clearTimers) {
              device.clearTimers();
            }
          }
        }
      }
    }
  }

};
