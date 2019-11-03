var ir = require('./ir')
var codes = require('./codes')
var broadlink = require('./index')

// ir.printAll()

var devices = new broadlink();

devices.on("deviceReady", (dev) => {
    console.log("Device ready: " + dev.getType() + " " + dev.host + " " + dev.mac.toString('hex'))

    dev.sendData(ir.getBuffer('heat', 'auto', 80))
    setTimeout(() => dev.sendData(ir.getBuffer('lightoff')), 2000)
});

console.log("Looking for Broadlink devices on the LAN...")
devices.discover()