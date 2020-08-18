'use strict';

const net = require("net");

module.exports = class Network {

  constructor(options) {
    options = options || {};
    this.log = options.log || console.log;
  }

  scan(host, port, timeout) {
    return new Promise((resolve, reject) => {
      const client = new net.Socket();

      const cancelCheck = setTimeout(function () {
        client.destroy();
        reject(new Error("Host timeout"));
      }, timeout);

      const cleanup = function () {
        if (cancelCheck) {
          clearTimeout(cancelCheck);
        }
        client.destroy();
      };

      client.on('error', function (err) {
        if (err && err.errno && err.errno === "ECONNREFUSED") {
          cleanup();
          resolve();
        } else if (err && err.errno && err.errno === "EHOSTUNREACH") {
          cleanup();
          reject(new Error("Host unreachable"));
        } else if (err && err.errno && err.errno === "ENETUNREACH") {
          cleanup();
          reject(new Error("Network unreachable"));
        } else if (err && err.errno) {
          cleanup();
          reject(new Error("Unknown error: " + err.errno));
        } else {
          cleanup();
          reject(new Error("ICMP driver can't handle " + err));
        }
      });

      try {
        client.connect(port, host, function () {
          cleanup();
          resolve();
        });
      } catch (ex) {
        cleanup();
        reject(new Error("Connect failed: " + ex.message));
      }
    });
  }

};
