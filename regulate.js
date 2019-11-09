let ir = require("./ir")
let codes = require("./codes")
let broadlink = require("./index")
let temps = require("./temps")
let home = require("./home")
const { logger } = require("./logging")

const HUE_USERNAME = process.env.HUE_USERNAME

/*
 * TODO ideas:
 *
 * - Don't thrash; allow a margin of error +/- 1 degree
 * - Minimize changes, especially at night, to reduce beeping. Need a change scoring function
 * - Allow changing desired temperature by time of day
 * ✅ Turn off the status LED after changing
 * ✅ Reconfigure everything every hour or two in case someone changed it
 * ✅ Log to ELK or some logging service
 * - Text owner when there are incompatible changes
 * ✅ Be more resilient to errors
 * - Reset connection to Broadlink and Hue every few hours
 * - Use getSensorById instead of enumerating every time
 * - Publish the change to index.js and then make this *use* broadlinkjs instead of forking it
 * ✅ Turn all devices off before switching from heat to cool or vice versa
 * ✅ Pause between IR signals
 */

let mousepad = new home.Home(
  new home.Room({
    name: "Living Room",
    sensorId: "00:17:88:01:04:b6:75:75-02-0402",
    blasterMacAddress: "9d276801a8c0",
    temp: {
      ideal: 77,
      min: 72,
      max: 80
    },
    fanSetting: "auto"
  }),
  new home.Room({
    name: "Rec Room",
    sensorId: "00:17:88:01:04:b6:89:68-02-0402",
    blasterMacAddress: "9d276901a8c0",
    temp: {
      ideal: 77,
      min: 72,
      max: 80
    },
    fanSetting: "auto"
  }),
  new home.Room({
    name: "Bedroom",
    sensorId: "00:17:88:01:06:f5:f1:d5-02-0402",
    blasterMacAddress: "9d278901a8c0",
    temp: {
      ideal: 77,
      min: 72,
      max: 80
    },
    fanSetting: "auto",
    turnOffStatusLight: true
  }),
  new home.Room({
    name: "Nursery",
    sensorId: "00:17:88:01:02:01:2e:d5-02-0402",
    blasterMacAddress: "9d27b801a8c0",
    temp: {
      ideal: 77,
      min: 72,
      max: 80
    },
    fanSetting: "auto",
    turnOffStatusLight: true
  })
)

function scanForDevices() {
  let devices = new broadlink()

  devices.on("deviceReady", dev => {
    let mac = dev.mac.toString("hex")
    for (let room of mousepad.rooms)
      if (room.blasterMacAddress == mac) {
        room.blaster = dev
        logger.info(
          "Device ready: " + room.name + " - " + dev.getType() + " " + dev.host.address + " " + mac
        )
        return
      }
    logger.info(
      "Unknown device ready: " +
        room.name +
        " - " +
        dev.getType() +
        " " +
        dev.host.address +
        " " +
        mac
    )
  })

  logger.info("Looking for Broadlink devices on the LAN...")
  devices.discover()
}

// This seeems to only pick up 3 devices out of the 4 in the house, so let's run it twice
scanForDevices()
scanForDevices()

logger.info("Starting Hue sensor polling...")
temps.startPollingSensors(HUE_USERNAME, async sensor => {
  for (let room of mousepad.rooms) {
    if (sensor.uniqueId == room.sensorId) {
      room.sensor = sensor
      let temp = ((sensor.state.attributes.attributes.temperature / 100) * 9) / 5 + 32
      if (room.temp.current != temp) {
        logger.info(room.name + " is now " + temp + " F")
        room.temp.current = temp
      }
      return
    }
  }
  logger.info("there's a sensor we're not using: " + sensor.uniqueId, sensor.state)
})

setInterval(() => mousepad.computeOptimalState(), 60 * 1000)
setInterval(() => mousepad.applyOptimalState(), 5 * 60 * 1000)
setTimeout(() => {
  mousepad.computeOptimalState()
  mousepad.applyOptimalState()
}, 15 * 1000)
