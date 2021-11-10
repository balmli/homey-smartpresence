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
    this.firstGuestArrivedTrigger = this.homey.flow.getTriggerCard('first_guest_arrived');

    this.firstHouseholdMemberArrivedTrigger = this.homey.flow.getTriggerCard('first_household_member_arrived');

    this.firstKidArrivedTrigger = this.homey.flow.getTriggerCard('first_kid_arrived');

    this.firstPersonEnteredTrigger = this.homey.flow.getTriggerCard('first_person_entered');

    this.guestArrivedTrigger = this.homey.flow.getTriggerCard('guest_arrived');

    this.guestLeftTrigger = this.homey.flow.getTriggerCard('guest_left');

    this.householdMemberArrivedTrigger = this.homey.flow.getTriggerCard('household_member_arrived');

    this.householdMemberLeftTrigger = this.homey.flow.getTriggerCard('household_member_left');

    this.kidArrivedTrigger = this.homey.flow.getTriggerCard('kid_arrived');

    this.kidLeftTrigger = this.homey.flow.getTriggerCard('kid_left');

    this.lastGuestLeftTrigger = this.homey.flow.getTriggerCard('last_guest_left');

    this.lastHouseholdMemberLeftTrigger = this.homey.flow.getTriggerCard('last_household_member_left');

    this.lastKidLeftTrigger = this.homey.flow.getTriggerCard('last_kid_left');

    this.lastPersonLeftTrigger = this.homey.flow.getTriggerCard('last_person_left');

    this.someoneEnteredTrigger = this.homey.flow.getTriggerCard('someone_entered');

    this.someoneLeftTrigger = this.homey.flow.getTriggerCard('someone_left');

    this.userEnteredTrigger = this.homey.flow.getDeviceTriggerCard('user_entered');

    this.userLeftTrigger = this.homey.flow.getDeviceTriggerCard('user_left');

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

  async deviceArrived(device) {
    const currentPrecenseStatus = this.getPresenceStatus();
    const tokens = device.getFlowCardTokens();
    this.log('deviceArrived', currentPrecenseStatus);
    const deviceid = device.getData().id;
    const presentAndNotSameDevice = currentPrecenseStatus.filter(d => d.id !== deviceid && d.present);
    if (presentAndNotSameDevice.length === 0) {
      await this.homey.app.firstPersonEnteredTrigger.trigger(tokens, {}).catch(this.error);
    }
    if (device.isHouseHoldMember() && presentAndNotSameDevice.filter(d => !d.guest).length === 0) {
      await this.homey.app.firstHouseholdMemberArrivedTrigger.trigger(tokens, {}).catch(this.error);
    }
    if (device.isKid() && presentAndNotSameDevice.filter(d => d.kid).length === 0) {
      await this.homey.app.firstKidArrivedTrigger.trigger(tokens, {}).catch(this.error);
    }
    if (device.isGuest() && presentAndNotSameDevice.filter(d => d.guest).length === 0) {
      await this.homey.app.firstGuestArrivedTrigger.trigger(tokens, {}).catch(this.error);
    }
  }

  async deviceLeft(device) {
    const currentPrecenseStatus = this.getPresenceStatus();
    const tokens = device.getFlowCardTokens();
    this.log('deviceLeft', currentPrecenseStatus);
    if (currentPrecenseStatus.filter(d => d.present).length === 0) {
      await this.homey.app.lastPersonLeftTrigger.trigger(tokens, {}).catch(this.error);
    }
    if (device.isHouseHoldMember() && currentPrecenseStatus.filter(d => d.present && !d.guest).length === 0) {
      await this.homey.app.lastHouseholdMemberLeftTrigger.trigger(tokens, {}).catch(this.error);
    }
    if (device.isKid() && currentPrecenseStatus.filter(d => d.present && d.kid).length === 0) {
      await this.homey.app.lastKidLeftTrigger.trigger(tokens, {}).catch(this.error);
    }
    if (device.isGuest() && currentPrecenseStatus.filter(d => d.present && d.guest).length === 0) {
      await this.homey.app.lastGuestLeftTrigger.trigger(tokens, {}).catch(this.error);
    }
  }

};
