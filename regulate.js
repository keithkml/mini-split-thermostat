let ir = require("./ir")
let codes = require("./codes")
let broadlink = require("./index")
let temps = require("./temps")
let home = require("./home")
const { logger } = require("./logging")
const process = require("process")

const HUE_USERNAME = process.env.HUE_USERNAME

process.on("uncaughtException", function(err) {
  logger.error("" + err, { err })
})
process.on("beforeExit", code => {
  logger.warn("beforeExit event with code: ", { code })
})

process.on("exit", code => {
  logger.warn("exit event with code: ", { code })
})

/*
 * TODO ideas:
 *
 * ✅ Allow changing desired temperature by time of day
 * - Allow preferring fan instead of off
 * ✅ Turn off the status LED after changing
 * ✅ Reconfigure everything every hour or two in case someone changed it
 * ✅ Log to ELK or some logging service
 * ✅ Improve logging (log full room state periodically)
 * - Text to speech to announce major changes
 * - Text owner when there are incompatible changes
 * ✅ Alert owner on exit (done via CloudWatch alerts)
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
    blasterMacAddress: "9d276601a8c0",
    schedule: {
      "5am": {
        temp: {
          ideal: 75,
          min: 72,
          max: 80
        },
        priority: 0.5
      },
      "8am": { priority: 1 },
      "7pm": { priority: 0.5 },
      "11pm": { priority: 0.1 }
    }
  }),
  new home.Room({
    name: "Rec Room",
    sensorId: "00:17:88:01:04:b6:89:68-02-0402",
    blasterMacAddress: "9d276701a8c0",
    schedule: {
      "6am": {
        temp: {
          ideal: 74,
          min: 70,
          max: 78
        },
        turnOffStatusLight: false,
        priority: 10
      },
      "6pm": {
        priority: 0.1
      },
      "10pm": {
        temp: {
          ideal: 68,
          min: 66,
          max: 74
        },
        turnOffStatusLight: true,
        priority: 1
      }
    }
  }),
  new home.Room({
    name: "Bedroom",
    sensorId: "00:17:88:01:06:f5:f1:d5-02-0402",
    blasterMacAddress: "9d278901a8c0",
    schedule: {
      "8am": {
        temp: {
          ideal: 74,
          min: 70,
          max: 78
        },
        fanSetting: "auto",
        turnOffStatusLight: false,
        priority: 1
      },
      "6pm": {
        temp: {
          ideal: 68,
          min: 66,
          max: 72
        },
        fanSetting: "high",
        turnOffStatusLight: true,
        priority: 2
      }
    }
  }),
  new home.Room({
    name: "Nursery",
    sensorId: "00:17:88:01:02:01:2e:d5-02-0402",
    blasterMacAddress: "9d27b601a8c0",
    schedule: {
      "6pm": {
        temp: {
          ideal: 70,
          min: 66,
          max: 74
        },
        turnOffStatusLight: true,
        priority: 10
      },
      "8am": {
        temp: {
          ideal: 74,
          min: 70,
          max: 78
        },
        turnOffStatusLight: false,
        priority: 1
      }
    }
  })
)

function scanForDevices() {
  logger.info("Looking for Broadlink devices on the LAN...")

  let devices = new broadlink()

  devices.on("deviceReady", dev => {
    let mac = dev.mac.toString("hex")
    for (let room of mousepad.rooms)
      if (room.blasterMacAddress == mac) {
        room.blaster = dev
        logger.info(
          "Device ready: " + room.name + " - " + dev.getType() + " " + dev.host.address + " " + mac,
          { name: room.name, type: dev.getType(), address: dev.host.address, mac }
        )
        return
      }
    logger.info("Unknown device ready: " + dev.getType() + " " + dev.host.address + " " + mac)
  })
  devices.discover()
}

function scanForDevicesUntilAll() {
  if (!mousepad.rooms.some(r => !r.blaster)) {
    return
  }
  scanForDevices()
  setTimeout(scanForDevicesUntilAll, 1000)
}

// Each call seeems to only pick up 3 devices out of the 4 in the house, so let's run it until we get them all
scanForDevicesUntilAll()

logger.info("Starting Hue sensor polling...")
temps.startPollingSensors(HUE_USERNAME, async sensor => {
  for (let room of mousepad.rooms) {
    if (sensor.uniqueId == room.sensorId) {
      room.sensor = sensor
      let temp = ((sensor.state.attributes.attributes.temperature / 100) * 9) / 5 + 32
      let oldTemp = room.temp.current
      room.temp.current = temp
      logger.info(room.name + " is now " + temp + " F", { oldTemp, ...room.getLogFields() })
      return
    }
  }
  logger.info("there's a sensor we're not using: " + sensor.uniqueId, {
    uniqueId: sensor.uniqueId,
    attributes: sensor.state.attributes.attributes
  })
})

function logAllRooms() {
  for (let room of mousepad.rooms) {
    logger.info("Current status", { periodicStatus: true, ...room.getLogFields() })
  }
}

setInterval(() => mousepad.computeOptimalState(), 60 * 1000)
setInterval(() => {
  mousepad.applyOptimalState()
  logAllRooms()
}, 5 * 60 * 1000)
setTimeout(() => {
  mousepad.computeOptimalState()
  mousepad.applyOptimalState()
  logAllRooms()
}, 15 * 1000)
