/**
 * nmterm - a wicd-curses-like interface for NetworkManager
 * Copyright (c) 2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/nmterm
 */

var cp = require('child_process')
  , path = require('path')
  , fs = require('fs')
  , util = require('util')
  , blessed = require('blessed');

// $ nmcli general {status|hostname|permissions|logging}
// $ nmcli networking {on|off|connectivity}
// $ nmcli radio {all|wifi|wwan|wimax}
// $ nmcli connection {show|up|down|add|edit|modify|delete|reload|load}
// $ nmcli device {status|show|connect|disconnect|wifi|wimax}

function nmterm() {
  return nmterm;
}

nmterm._getNetworks = function(callback) {
  utils.spawn('nmcli -t -f SSID,MODE,CHAN,RATE,SIGNAL,BARS,SECURITY d wifi', function(err, out) {
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
  utils.spawn('nmcli -t -f NAME,UUID,TYPE,DEVICE c show', function(err, out) {
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
  utils.spawn('nmcli -t -f STATE,CONNECTIVITY,WIFI-HW,WIFI,WWAN-HW,WWAN g status', function(err, out) {
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

nmterm._checkConnectivity = function(callback) {
  utils.spawn('nmcli n connectivity', function(err, out) {
    if (err) return callback(err);
    return callback(null, out === 'full');
  });
};

nmterm._unrfkill = function(callback) {
  utils.spawn('nmcli n on', function(err, out) {
    if (err) return callback(err);
    return callback(null, true);
  });
};

nmterm._rfkill = function(callback) {
  utils.spawn('nmcli n off', function(err, out) {
    if (err) return callback(err);
    return callback(null, true);
  });
};

nmterm._openConfiguredConnection = function(id, callback) {
  utils.spawn('nmcli c up id "' + id + '"', function(err, out) {
    if (err) return callback(err);
    return callback(null, true);
  });
};

nmterm._closeConfiguredConnection = function(id, callback) {
  utils.spawn('nmcli c down id "' + id + '"', function(err, out) {
    if (err) return callback(err);
    return callback(null, true);
  });
};

nmterm._deleteConfiguredConnection = function(id, callback) {
  if (nmterm._isUUID(id)) {
    utils.spawn('nmcli c delete uuid "' + id + '"', function(err, out) {
      if (err) return callback(err);
      return callback(null, true);
    });
    return;
  }
  utils.spawn('nmcli c delete id "' + id + '"', function(err, out) {
    if (err) return callback(err);
    return callback(null, true);
  });
};

nmterm._isUUID = function(id) {
  return /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(id);
};

nmterm._connectNetwork = function(id, password, callback) {
  // $ nmcli d wifi connect Foobar password [password] name Foobar --private
  // $ nmcli d wifi connect Foobar password [password] name Foobar
  // $ nmcli d wifi connect Foobar password [password] iface wlan0 name Foobar
  var cmd = 'nmcli d wifi connect "' + id + '" password "'
    + password + '" name "' + id + '"';
  utils.spawn(cmd, function(err, out) {
    if (err) return callback(err);
    return callback(null, true);
  });
};

nmterm._addConfiguredNetwork = function(id, password, callback) {
  // $ nmcli c add
  // $ nmcli c add Foobar password [password] name Foobar --private
  var cmd = 'nmcli c add "' + id + '" password "'
    + password + '" name "' + id + '"';
  utils.spawn(cmd, function(err, out) {
    if (err) return callback(err);
    return callback(null, true);
  });
};

nmterm._removeConfiguredNetwork = function(id, callback) {
  // $ nmcli c remove Foobar
  utils.spawn('nmcli c remove "' + id, function(err, out) {
    if (err) return callback(err);
    return callback(null, true);
  });
};

nmterm._getConfiguredNetwork = function(id, callback) {
  // $ nmcli c show
  // $ nmcli c show Foobar
  if (!callback) {
    callback = id;
    id = null;
  }
  if (!id) {
    utils.spawn('nmcli -t -f NAME,UUID,TYPE,DEVICE c show', function(err, out) {
      if (err) return callback(err);
      var nets = [];
      out.trim().split('\n').forEach(function(line) {
        var parts = line.split(':');
        var network = {
          name: parts[0],
          uuid: parts[1],
          type: parts[2],
          device: parts[3]
        };
        nets[network.name] = network;
        nets.push(network);
      });
      return callback(null, nets);
    });
    return;
  }
  utils.spawn('nmcli c show "' + id + '"', function(err, out) {
    if (err) return callback(err);
    var network = {};
    out.trim().split('\n').forEach(function(line) {
      var parts = line.replace(/:\s+/g, '').trim().split(':');
      network[parts[0]] = parts[1];
    });
    return callback(null, network);
  });
};

nmterm._connectConfiguredNetwork = function(id, callback) {
  // $ nmcli c up Foobar
  utils.spawn('nmcli c up "' + id + '"', function(err, out) {
    if (err) return callback(err);
    return callback(null, true);
  });
};

nmterm._diconnectConfiguredNetwork = function(id, callback) {
  // $ nmcli c down Foobar
  utils.spawn('nmcli c down "' + id + '"', function(err, out) {
    if (err) return callback(err);
    return callback(null, true);
  });
};

nmterm._connectNetwork = function(id, password, callback) {
  // $ nmcli d wifi connect Foobar password [password] name Foobar --private
  utils.spawn('nmcli d wifi connect "' + id + '" password "' + password + '" name "' + id + '"', function(err, out) {
    if (err) return callback(err);
    return callback(null, true);
  });
};

nmterm._diconnectNetwork = function(id, callback) {
  // $ nmcli d wifi disconnect Foobar
  utils.spawn('nmcli d wifi disconnect "' + id + '"', function(err, out) {
    if (err) return callback(err);
    return callback(null, true);
  });
};

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

  nmterm.networks = [];

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

  function exit() {
    //screen._.msg.hide = function() {};
    //screen._.msg.display('Shutting down...', -1);
    return callback();
  }

  function refresh(callback) {
    nmterm._getNetworks(function(err, networks) {
      if (err) return screen._.msg.error(err.message);
      nmterm.networks = networks;
      var index = tabs.wifi._.list.selected;
      tabs.wifi._.list.clearItems();
      networks.forEach(function(network) {
        tabs.wifi._.list.addItem(network.ssid);
      });
      tabs.wifi._.list.select(index);
      screen.render();
      if (callback) callback();
    });
  }

  (function self() {
    return refresh(function() {
      return setTimeout(self, 1000);
    });
  })();

  screen.key('f5', function() {
    return refresh();
  });

  screen.ignoreLocked.push('C-c');

  screen.key('C-c', function(ch, key) {
    return exit();
  });

  /**
   * Wifi
   */

  tabs.wifi.on('focus', function() {
    tabs.wifi._.list.focus();
  });

  tabs.wifi._.list = blessed.list({
    parent: tabs.wifi,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
      scrollbar: {
        inverse: true
      },
      selected: {
        bg: 'blue'
      },
      item: {
        hover: {
          bg: 'blue'
        }
      }
    },
    scrollbar: {
      ch: ' '
    }
  });

  tabs.wifi._.list.on('select', function(el, index) {
    //var text = el.getText().trim();
    //var parts = text.split(/\s+/);
    var text = utils.inspect(nmterm.networks[index]);
    return screen._.details.display(text, -1);
  });

  /**
   * Global Widgets
   */

  screen._.prompt = blessed.prompt({
    parent: screen,
    top: 'center',
    left: 'center',
    height: 'shrink',
    width: 'shrink',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    content: 'Label:',
    border: 'line',
    hidden: true
  });

  screen._.question = blessed.question({
    parent: screen,
    top: 'center',
    left: 'center',
    width: 'shrink',
    height: 'shrink',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    content: 'Label:',
    border: 'line',
    hidden: true
  });

  screen._.fm = blessed.filemanager({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '70%',
    height: '50%',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    label: ' Choose a file... ',
    border: 'line',
    hidden: true
  });

  screen._.picker = blessed.list({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '70%',
    height: '50%',
    border: 'line',
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    hidden: true,
    style: {
      scrollbar: {
        inverse: true
      },
      selected: {
        bg: 'blue'
      },
      item: {
        hover: {
          bg: 'blue'
        }
      }
    },
    scrollbar: {
      ch: ' '
    }
  });

  /**
   * Loader
   */

  screen._.loader = blessed.loading({
    parent: screen,
    top: 'center',
    left: 'center',
    height: 5,
    align: 'center',
    width: '50%',
    tags: true,
    hidden: true,
    border: 'line'
  });

  /**
   * Message
   */

  screen._.msg = blessed.message({
    parent: screen,
    top: 'center',
    left: 'center',
    height: 'shrink',
    width: '50%',
    align: 'center',
    tags: true,
    hidden: true,
    border: 'line',
    ignoreKeys: ['q']
  });

  /**
   * Details
   */

  screen._.details = blessed.message({
    parent: screen,
    top: 'center',
    left: 'center',
    width: '70%',
    height: '50%',
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    hidden: true,
    border: 'line',
    scrollbar: {
      ch: ' '
    },
    style: {
      scrollbar: {
        bg: 'blue'
      }
    }
  });

  screen._.bar.commands[0].callback();
};

/**
 * Utils
 */

var utils = {};

utils.spawn = function(cmd, callback) {
  var parts = cmd.split(' ');
  var file = parts[0];
  var args = parts.slice(1);

  var quoted = false;
  var buf = '';
  var parts_ = [];

  for (var i = 0; i < parts.length; i++) {
    if (parts[i][0] === '"') {
      quoted = true;
    }
    if (quoted) {
      buf += parts[i].replace(/^"|"$/g, '');
      if (parts[i][parts[i].length - 1] === '"') {
        parts_.push(buf);
        buf = '';
        quoted = false;
      }
    } else {
      parts_.push(parts[i]);
    }
  }

  parts = parts_;

  var ps = cp.spawn(file, args, {
    cwd: process.cwd(),
    env: process.env,
    detached: false,
    stdio: ['ignore', 'pipe', 'ignore']
  });

  function onerror(err) {
    try {
      ps.kill();
    } catch (e) {
      ;
    }
    return callback(err);
  }

  ps.on('error', onerror);
  ps.stdout.on('error', onerror);

  ps.stdout.setEncoding('utf8');

  var buf = '';
  ps.stdout.on('data', function(data) {
    buf += data;
  });

  ps.stdout.on('end', function(data) {
    if (data) buf += data;
  });

  ps.on('exit', function(code) {
    if (code !== 0) {
      return callback(new Error('Error Code: ' + code));
    }
    return callback(null, buf);
  });
};

utils.inspect = function(obj, level) {
  return typeof obj !== 'string'
    ? util.inspect(obj, false, level || 10, true)
    : obj;
};

utils.print = function(msg) {
  return typeof msg === 'object'
    ? process.stdout.write(utils.inspect(msg) + '\n')
    : console.log.apply(console, arguments);
};

utils.error = function(msg) {
  return typeof msg === 'object'
    ? process.stderr.write(utils.inspect(msg) + '\n')
    : console.error.apply(console, arguments);
};

utils.printl = function(msg, level) {
  return process.stdout.write(utils.inspect(msg, level) + '\n');
};

module.exports = nmterm;
