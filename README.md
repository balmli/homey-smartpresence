# Smart Presence

The app works by detecting closed TCP ports of smartphones on your Wi-Fi network. This will work without installing the Homey app, and will allow you to detect guests as well.


#### Installing:

For adding a device, please follow these steps:

1. Check the IP address of the smartphone. This can be done from the admin UI of the Wi-Fi router.
2. Make a static reservation for the IP address.  Also done from the admin UI of the Wi-Fi router.
3. Add the device by entering a name, and the IP address of the smartphone.  Check the 'Is guest' or 'Is kid' - checkboxes for guests or kids.

## Device: Smartphone

#### Triggers

- A household member arrived / left
- A kid (part of the household) arrived / left
- A specific user arrived / left
- A guest arrived / left
- Someone arrived / left
- The first household member arrived
- The first kid arrived
- The first guest arrived
- The first person arrived
- The last household member left
- The last kid left
- The last guest left
- The last person left

#### Conditions

- Household members home / No household members home
- Kids at home / Kids not at home
- Having guests / Not having guests
- Someone is home / Nobody is home
- A specific user is home / away


## Acknowledgements:

- The original 'Smart Presence' app created by Terry Hendrix.

## Feedback:

Please report issues at the [issues section on Github](https://github.com/balmli/homey-smartpresence/issues).

## Release Notes:

#### 0.8.1

- Fixed memory issue

#### 0.8.0

- Added presence to the Timeline
- Fixed rename bug
- Migrated to SDK3

#### 0.7.6

- Language support

#### 0.7.5

- Added support for kids

#### 0.7.4

- Fixed issue with first person, household member and guest triggers

#### 0.7.3

- Performance improvements

#### 0.7.2

- Better language support
- Better performance

#### 0.7.1

- Better language support

#### 0.7.0

- The port number can be configured from advanced settings
- Increased check intervals for better performance

#### 0.6.3

- Fixed missing capability

#### 0.6.2

- Added token for user entered / user left triggers

#### 0.6.1

- Fixed issue with adding devices

#### 0.6.0

- New version compatible with Homey firmware 5.x

#### 0.5.1

- Device tile will now grey out when an user is not home and vice versa
