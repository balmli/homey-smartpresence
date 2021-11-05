'use strict';

const Homey = require('homey');

module.exports = class SmartPresenceApp extends Homey.App {

  async onInit() {
    try {
      await this.initFlows();
      this.log('SmartPresenceApp is running...');
    } catch (err) {
      this.log('onInit error', err);
    }
  }

  async initFlows() {
    this.firstGuestArrivedTrigger = this.homey.flow.getDeviceTriggerCard('first_guest_arrived');

    this.firstHouseholdMemberArrivedTrigger = this.homey.flow.getDeviceTriggerCard('first_household_member_arrived');

    this.firstKidArrivedTrigger = this.homey.flow.getDeviceTriggerCard('first_kid_arrived');

    this.firstPersonEnteredTrigger = this.homey.flow.getDeviceTriggerCard('first_person_entered');

    this.guestArrivedTrigger = this.homey.flow.getDeviceTriggerCard('guest_arrived');

    this.guestLeftTrigger = this.homey.flow.getDeviceTriggerCard('guest_left');

    this.householdMemberArrivedTrigger = this.homey.flow.getDeviceTriggerCard('household_member_arrived');

    this.householdMemberLeftTrigger = this.homey.flow.getDeviceTriggerCard('household_member_left');

    this.kidArrivedTrigger = this.homey.flow.getDeviceTriggerCard('kid_arrived');

    this.kidLeftTrigger = this.homey.flow.getDeviceTriggerCard('kid_left');

    this.lastGuestLeftTrigger = this.homey.flow.getDeviceTriggerCard('last_guest_left');

    this.lastHouseholdMemberLeftTrigger = this.homey.flow.getDeviceTriggerCard('last_household_member_left');

    this.lastKidLeftTrigger = this.homey.flow.getDeviceTriggerCard('last_kid_left');

    this.lastPersonLeftTrigger = this.homey.flow.getDeviceTriggerCard('last_person_left');

    this.someoneEnteredTrigger = this.homey.flow.getDeviceTriggerCard('someone_entered');

    this.someoneLeftTrigger = this.homey.flow.getDeviceTriggerCard('someone_left');

    this.userEnteredTrigger = this.homey.flow.getDeviceTriggerCardDevice('user_entered');

    this.userLeftTrigger = this.homey.flow.getDeviceTriggerCardDevice('user_left');

    this.homey.flow.getConditionCard('a_household_member_is_home')
      .registerRunListener((args, state) => this.householdMemberIsHome(args, state));

    this.homey.flow.getConditionCard('kids_at_home')
      .registerRunListener((args, state) => this.kidsAtHome(args, state));

    this.homey.flow.getConditionCard('having_guests')
      .registerRunListener((args, state) => this.havingGuests(args, state));

    this.homey.flow.getConditionCard('someone_at_home')
      .registerRunListener((args, state) => this.someoneAtHome(args, state));

    this.homey.flow.getConditionCard('user_at_home')
      .registerRunListener((args, state) => args.device.userAtHome());
  }

  async householdMemberIsHome(args, state) {
    return this.getPresenceStatus().filter(d => d.present && !d.guest).length > 0;
  }

  async kidsAtHome(args, state) {
    return this.getPresenceStatus().filter(d => d.present && d.kid).length > 0;
  }

  async havingGuests(args, state) {
    return this.getPresenceStatus().filter(d => d.present && d.guest).length > 0;
  }

  async someoneAtHome(args, state) {
    return this.getPresenceStatus().filter(d => d.present).length > 0;
  }

  getPresenceStatus() {
    const status = [];
    const driver = this.homey.drivers.getDriver('smart_presence');
    const devices = driver.getDevices();
    for (let device of devices) {
      status.push({
        id: device.getData().id,
        present: device.getPresenceStatus(),
        kid: device.isKid(),
        guest: device.isGuest(),
        lastSeen: device.getLastSeen()
      });
    }
    return status;
  }

  deviceArrived(device) {
    const currentPrecenseStatus = this.getPresenceStatus();
    this.log('deviceArrived', currentPrecenseStatus);
    const deviceid = device.getData().id;
    const presentAndNotSameDevice = currentPrecenseStatus.filter(d => d.id !== deviceid && d.present);
    if (presentAndNotSameDevice.length === 0) {
      this.homey.app.firstPersonEnteredTrigger.trigger(device.getFlowCardTokens(), {});
    }
    if (device.isHouseHoldMember() && presentAndNotSameDevice.filter(d => !d.guest).length === 0) {
      this.homey.app.firstHouseholdMemberArrivedTrigger.trigger(device.getFlowCardTokens(), {});
    }
    if (device.isKid() && presentAndNotSameDevice.filter(d => d.kid).length === 0) {
      this.homey.app.firstKidArrivedTrigger.trigger(device.getFlowCardTokens(), {});
    }
    if (device.isGuest() && presentAndNotSameDevice.filter(d => d.guest).length === 0) {
      this.homey.app.firstGuestArrivedTrigger.trigger(device.getFlowCardTokens(), {});
    }
  }

  deviceLeft(device) {
    const currentPrecenseStatus = this.getPresenceStatus();
    this.log('deviceLeft', currentPrecenseStatus);
    if (currentPrecenseStatus.filter(d => d.present).length === 0) {
      this.homey.app.lastPersonLeftTrigger.trigger(device.getFlowCardTokens(), {});
    }
    if (device.isHouseHoldMember() && currentPrecenseStatus.filter(d => d.present && !d.guest).length === 0) {
      this.homey.app.lastHouseholdMemberLeftTrigger.trigger(device.getFlowCardTokens(), {});
    }
    if (device.isKid() && currentPrecenseStatus.filter(d => d.present && d.kid).length === 0) {
      this.homey.app.lastKidLeftTrigger.trigger(device.getFlowCardTokens(), {});
    }
    if (device.isGuest() && currentPrecenseStatus.filter(d => d.present && d.guest).length === 0) {
      this.homey.app.lastGuestLeftTrigger.trigger(device.getFlowCardTokens(), {});
    }
  }

};
