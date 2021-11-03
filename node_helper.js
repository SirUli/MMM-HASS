'use strict';

/* Magic Mirror
 * Module: MMM-HASS
 *
 * Simple transposition of Benjamin Roesner´s MMM-FHEM
 * to use it with home assistant
 *
 * GNU GPL v3.0
 */

const NodeHelper = require('node_helper');
var request = require('request');
var _ = require('underscore');

module.exports = NodeHelper.create({
  start: function() {
    this.config = {};
  },

  buildHassUrl: function(config, urlpath) {
    var self = this;
    var url = config.host;

    if (config.port) {
      url += ':' + config.port;
    }

    url += urlpath;

    if (config.apipassword) {
      url = '?api_password=' + config.apipassword;
    }

    if (config.https) {
      url = 'https://' + url;
    } else {
      url = 'http://' + url;
    }

    self.clogger(url);

    return url
  },

  buildHassDeviceUrl: function(devicename, config) {
    var self = this;
    urlpath = '/api/states/' + devicename
    return self.buildHassUrl(config, urlpath);
  },

  buildHassEventUrl: function(domain, service, config) {
    var self = this;
    urlpath = '/api/services/' + domain + '/' + service;
    return self.buildHassUrl(config, urlpath);
  },

  buildHassAuthorizationHeader: function(config) {
    if(config.hassiotoken) {
      if(config.token) {
        return { 'Authorization' : 'Bearer ' + config.token };
      } else {
        return { 'Authorization' : 'Bearer ' + process.env.HASSIO_TOKEN };
      }
    }
  },

  clogger: function(logentry) {
    if(config.debuglogging) {
      console.log(logentry);
    }
  },

  sendHassEvent: function(config, domain, service, params) {
    var self = this;

    var urlstr = self.buildHassEventUrl(domain, service, config);

    var post_options = {
      url: urlstr,
      method: 'POST',
      json: params
    };

    post_options.headers = buildHassAuthorizationHeader(config);

    var post_req = request(post_options, function(error, response, body) {
      self.clogger('Response: ' + response.statusCode);
    });
  },

  getHassReadings: function(config, callback) {
    var self = this;
    self.clogger(config.devices);

    var structuredData = _.each(config.devices, function(device) {
      var outDevice = {};

      self.clogger(device);

      var readings = device.deviceReadings;
      var urls = [];

      // First, build a list of url for all the readings
      //
      readings.forEach(function(element, index, array) {
        var url = self.buildHassDeviceUrl(element.sensor, config);
        self.clogger('Request URL: ' + url);
        urls.push(url);
      });

      self.clogger(urls);

      var completed_requests = 0;

      // Then, get all the json for the device
      //
      var i;
      for (i in urls) {
        var get_options = {
          url: urls[i],
          json: true
        };
        
        get_options.headers = buildHassAuthorizationHeader(config);

        request(get_options, function(error, response, body) {
          completed_requests++;
          self.clogger(error);
          self.clogger(body);
          outDevice[body.entity_id] = body.state;
          if (completed_requests == urls.length) {
            // All requests done for the device, process responses array
            // to retrieve all the states
            outDevice.label = device.deviceLabel;
            self.clogger(outDevice);
            callback(outDevice);
          }
        });
      }
    });
  },

  // Subclass socketNotificationReceived received.
  socketNotificationReceived: function(notification, payload) {
    if (notification === 'GETDATA') {
      var self = this;
      self.config = payload;
      var structuredData = {};
      var completed_devices = 0;
      this.getHassReadings(this.config, function(device) {
        completed_devices++;
        structuredData[device.label] = device;
        if (completed_devices == self.config.devices.length) {
          self.sendSocketNotification('DATARECEIVED', structuredData);
        }
      });
    } else if (notification === 'HASS_1') {
      var self = this;
      this.sendHassEvent(this.config, 'media_player', 'select_source', {
        'entity_id': 'media_player.menjador',
        'source': 'Tria asm'
      });
    } else if (notification === 'HASS_2') {
      var self = this;
      this.sendHassEvent(this.config, 'switch', 'turn_on', {
        'entity_id': 'switch.cuina'
      });
    }
  }
});
