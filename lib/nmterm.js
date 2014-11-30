/**
 * nmterm - a wicd-curses-like interface for NetworkManager
 * Copyright (c) 2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/nmterm
 */

var cp = require('child_process')
  , path = require('path')
  , fs = require('fs')
  , blessed = require('blessed');

/*
$ nmcli general {status|hostname|permissions|logging}
$ nmcli networking {on|off|connectivity}
$ nmcli radio {all|wifi|wwan|wimax}
$ nmcli connection {show|up|down|add|edit|modify|delete|reload|load}
$ nmcli device {status|show|connect|disconnect|wifi|wimax}

$ nmcli general
STATE      CONNECTIVITY  WIFI-HW  WIFI     WWAN-HW  WWAN
connected  full          enabled  enabled  enabled  enabled
$ nmcli networking
enabled
$ nmcli radio
WIFI-HW  WIFI     WWAN-HW  WWAN
enabled  enabled  enabled  enabled
$ nmcli connection
NAME       UUID                                  TYPE             DEVICE
Foobar     12c8b6a5-31d1-4ea8-a1af-b541da345df1  802-11-wireless  --
LINKGEAR11  1484d982-bd6e-4e56-a4a0-df4c10414762  802-11-wireless  wlp2s0
$ nmcli device
DEVICE  TYPE      STATE      CONNECTION
wlp2s0  wifi      connected  LINKGEAR11
lo      loopback  unmanaged  --

$ nmcli device show
GENERAL.DEVICE:                         wlp2s0
GENERAL.TYPE:                           wifi

$ nmcli device wifi
*  SSID             MODE   CHAN  RATE       SIGNAL  BARS  SECURITY
   sleepyrouter           Infra  11    54 Mbit/s  74      ▂▄▆_  WPA2
$ nmcli --terse --fields SSID device wifi
sleepyrouter
$ nmcli --terse --fields SSID,SIGNAL device wifi
sleepyrouter:74
$ nmcli --terse --fields NAME,UUID,TYPE,DEVICE c show
Foobar:121c86a5-34e1-4aa8-a2bf-15d22d3ebdf9:802-11-wireless:--
LINKGEAR11:2483d482-ad6e-be56-1d10-6afcd0b14768:802-11-wireless:wlp2s0
$ nmcli -t -f STATE,CONNECTIVITY,WIFI-HW,WIFI,WWAN-HW,WWAN g status
connected:full:enabled:enabled:enabled:enabled
*/

function nmterm() {
  return nmterm;
}

nmterm._getNetworks = function(callback) {
  spawn('nmcli -t -f SSID,MODE,CHAN,RATE,SIGNAL,BARS,SECURITY d wifi', function(err, out) {
    if (err) return callback(err);
    var nets = [];
    out.trim().split('\n').forEach(function(line) {
      var parts = line.split(':');
      var network = {
        ssid: parts[0],
        mode: parts[1],
        chan: parts[2],
        rate: parts[3],
        signal: +parts[4],
        bars: parts[5],
        security: parts[6]
      };
      nets[network.ssid] = network;
      nets.push(network);
    });
    return callback(null, nets);
  });
};

nmterm._getConfiguredNetworks = function(callback) {
  spawn('nmcli -t -f NAME,UUID,TYPE,DEVICE c show', function(err, out) {
    if (err) return callback(err);
    var nets = [];
    out.trim().split('\n').forEach(function(line) {
      var parts = line.split(':');
      var network = {
        name: parts[0],
        uuid: parts[1],
        type: parts[2],
        device: parts[3],
        connected: false
      };
      network.connected = network.device !== '--';
      nets[network.name] = network;
      nets.push(network);
    });
    return callback(null, nets);
  });
};

nmterm._getConnection = function(callback) {
  // $ nmcli n connectivity
  spawn('nmcli -t -f STATE,CONNECTIVITY,WIFI-HW,WIFI,WWAN-HW,WWAN g status', function(err, out) {
    if (err) return callback(err);
    var nets = [];
    out.trim().split('\n').forEach(function(line) {
      var parts = line.split(':');
      var network = {
        state: parts[0],
        connectivity: parts[1],
        wifihw: parts[2],
        wifi: parts[3],
        wwanhw: parts[4],
        wwan: parts[5]
      };
      network.connected = network.state === 'connected';
      nets[network.name] = network;
      nets.push(network);
    });
    return callback(null, nets);
  });
};

nmterm._unrfkill = function(callback) {
  // $ nmcli n on
};

nmterm._rfkill = function(callback) {
  // $ nmcli n off
};

// connection = settings - recorded wifi records set up
// device = in the moment finding networks

nmterm._openConfiguredConnection = function(callback) {
  // $ nmcli c up id Foobar
};

nmterm._closeConfiguredConnection = function(callback) {
  // $ nmcli c down id Foobar
};

nmterm._deleteConfiguredConnection = function(callback) {
  // $ nmcli c delete id Foobar
  // $ nmcli c delete uuid 1914bb0c-fa13-4d9d-befc-f3db3c96f0bb
};

nmterm._connectNetwork = function(callback) {
  // $ nmcli d wifi connect Foobar password [password] name Foobar --private
  // $ nmcli d wifi connect Foobar password [password] name Foobar
  // $ nmcli d wifi connect Foobar password [password] iface wlan0 name Foobar
};

nmterm._addConfiguredNetwork = function(callback) {
  // $ nmcli c add
  // $ nmcli c add Foobar password [password] name Foobar --private
};

nmterm._removeConfiguredNetwork = function(callback) {
  // $ nmcli c remove Foobar
};

nmterm._getConfiguredNetwork = function(callback) {
  // $ nmcli c show
  // $ nmcli c show Foobar = need to parse output!!!
};

nmterm._connectConfiguredNetwork = function(callback) {
  // $ nmcli c up Foobar
};

nmterm._diconnectConfiguredNetwork = function(callback) {
  // $ nmcli c down Foobar
};

nmterm._connectNetwork = function(callback) {
  // $ nmcli d wifi connect Foobar password [password] name Foobar --private
};

nmterm._diconnectNetwork = function(callback) {
  // $ nmcli d wifi disconnect Foobar
};

/*
$ nmcli c show Foobar
connection.id:                          Foobar
connection.uuid:                        12f88ea5-3ae1-4aa8-adbf-b5d12ace5dfc
connection.interface-name:              --
connection.type:                        802-11-wireless
connection.autoconnect:                 yes
connection.timestamp:                   1416962187
connection.read-only:                   no

    out.trim().split('\n').forEach(function(line) {
      // ADD:
      line = line.replace(/: +/g, ':');

      var parts = line.split(':');
      var network = {
        state: parts[0],
        connectivity: parts[1],
        wifihw: parts[2],
        wifi: parts[3],
        wwanhw: parts[4],
        wwan: parts[5]
      };
      network.connected = network.state === 'connected';
      nets[network.name] = network;
      nets.push(network);
    });
    return callback(null, nets);
  });
*/

try {
  fs.mkdirSync(process.env.HOME + '/.nmterm');
} catch (e) {
  ;
}

try {
  nmterm.config = require(process.env.HOME + '/.nmterm/config.json');
} catch (e) {
  nmterm.config = {};
}

nmterm.start = function(callback) {
  var screen = blessed.screen({
    autoPadding: true,
    fastCSR: true,
    log: process.env.HOME + '/.nmterm/debug.ui.log'
  });

  nmterm.screen = screen;

  screen._.target = null;

  screen._.wrapper = blessed.box({
    parent: screen,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
  });

  screen._.bar = blessed.listbar({
    parent: screen._.wrapper,
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    keys: true,
    mouse: true,
    autoCommandKeys: true,
    style: {
      item: {
        fg: 'blue',
        hover: {
          fg: 'white',
          bg: 'black'
        }
      },
      selected: {
        fg: 'white',
        bg: 'black'
      },
      prefix: {
        fg: 'white'
      }
    }
  });

  screen._.sep = blessed.line({
    parent: screen._.wrapper,
    top: 1,
    left: 0,
    right: 0,
    orientation: 'horizontal'
  });

  var tabs = screen._.tabs = {};

  ['wifi',
   'networks',
   'rfkill',
   'logs',
   'debug'].forEach(function(name) {
    if (name === 'debug' && !nmterm.config.debug) {
      return;
    }

    var tab = tabs[name] = blessed.box({
      top: 2,
      left: 0,
      right: 0,
      bottom: 0,
      scrollable: true,
      keys: true,
      vi: true,
      alwaysScroll: true,
      scrollbar: {
        ch: ' '
      },
      style: {
        scrollbar: {
          inverse: true
        }
      }
    });

    screen._.bar.addItem({
      text: name,
      callback: function() {
        // if (screen._.msg) screen._.msg.hide();
        if (screen._.target) screen._.target.detach();
        screen._.wrapper.append(tab);
        tab.focus();
        screen._.target = tab;
        screen.render();
      }
    });
  });

  screen._.bar.commands[0].callback();

  function exit() {
    //screen._.msg.hide = function() {};
    //screen._.msg.display('Shutting down...', -1);
    return callback();
  }

  function refresh() {
    ;
  }

  screen.key('f5', function() {
    return refresh(null, true);
  });

  screen.ignoreLocked.push('C-c');

  screen.key('C-c', function(ch, key) {
    return exit();
  });
};

module.exports = nmterm;
