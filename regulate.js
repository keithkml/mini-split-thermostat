let ir = require("./ir");
let codes = require("./codes");
let broadlink = require("./index");
let temps = require("./temps");
let home = require("./home");

const HUE_USERNAME = process.env.HUE_USERNAME;

let mousepad = new home.Home(
  new home.Room({
    name: "Living Room",
    sensorId: "00:17:88:01:04:b6:75:75-02-0402",
    blasterMacAddress: "9d278901a8c0",
    temp: {
      ideal: 75,
      min: 68,
      max: 78
    },
    fanSetting: "auto"
  })
  // new Room({
  //     name: "Rec Room",
  //     sensorId: '00:17:88:01:04:b6:89:68-02-0402'
  // }),
  // new Room({
  //     name: "Bedroom",
  //     sensorId: '00:17:88:01:02:01:2e:d5-02-0402'
  // })
  // Nursery: {
  //     sensorId: 'XXX'
  // }
);

let devices = new broadlink();

devices.on("deviceReady", dev => {
  let mac = dev.mac.toString("hex");
  for (let room of mousepad.rooms)
    if (room.blasterMacAddress == mac) room.blaster = dev;
  console.log(
    "Device ready: " + dev.getType() + " " + dev.host.address + " " + mac
  );

  //dev.sendData(ir.getBuffer('heat', 'auto', 80))
  //setTimeout(() => dev.sendData(ir.getBuffer('lightoff')), 2000)
});

console.log("Looking for Broadlink devices on the LAN...");
devices.discover();

console.log("Starting Hue sensor polling...");
temps.startPollingSensors(HUE_USERNAME, sensor => {
  for (let room of mousepad.rooms) {
    if (sensor.uniqueId == room.sensorId) {
      room.sensor = sensor;
      let temp =
        ((sensor.state.attributes.attributes.temperature / 100) * 9) / 5 + 32;
      if (room.temp.current != temp) {
        console.log(room.name + " is now " + temp + " F");
        room.temp.current = temp;
      }
    }
  }
});

setInterval(() => mousepad.computeOptimalState(), 5 * 1000);
setInterval(() => mousepad.applyOptimalState(), 30 * 1000);
