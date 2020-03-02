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
 * ✅ Turn devices off before switching from heat to cool or vice versa
 * ✅ Pause between IR signals
 * - Turn all devices off and back on every few hours, in case one got stuck
 */

let mousepad = new home.Home(
  new home.Room({
    name: "Living Room",
    sensorPrefix: "00:17:88:01:04:b6:75:75-02",
    blasterMacAddress: "9d277b00a8c0",
    schedule: {
      "5am": {
        temp: {
          ideal: 74,
          min: 66,
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
    name: "Nursery",
    sensorPrefix: "00:17:88:01:04:b6:89:68-02",
    blasterMacAddress: "9d279200a8c0",
    schedule: {
      "5am": {
        temp: {
          ideal: 73,
          min: 68,
          max: 78
        },
        priority: 3
      },
      "7am": {
        turnOffStatusLight: false
      },
      "6pm": {
        temp: {
          ideal: 68,
          min: 66,
          max: 74
        },
        turnOffStatusLight: true
      }
    }
  }),
  new home.Room({
    name: "Bedroom",
    sensorPrefix: "00:17:88:01:06:f5:f1:d5-02",
    blasterMacAddress: "9d278600a8c0",
    schedule: {
      "8am": {
        temp: {
          ideal: 76,
          min: 68,
          max: 78
        },
        fanSetting: "auto",
        turnOffStatusLight: false,
        priority: 1
      },
      "8pm": {
        temp: {
          ideal: 67,
          min: 62,
          max: 72
        },
        fanSetting: "high",
        turnOffStatusLight: true,
        priority: 2
      }
    }
  }),
  new home.Room({
    name: "Office",
    sensorPrefix: "00:17:88:01:02:01:2e:d5-02",
    blasterMacAddress: "9d27b700a8c0",
    schedule: {
      "9pm": {
        temp: {
          ideal: 68,
          min: 62,
          max: 80
        },
        turnOffStatusLight: true,
        priority: 0.1
      },
      "7am": {
        temp: {
          ideal: 76,
          min: 67,
          max: 80
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

// Each call seeems to only pick up 3 devices out of the 4 in the house, so let's run it until we get them all
function scanForDevicesAgain(resolve, reject) {
  if (!mousepad.rooms.some(r => !r.blaster)) {
    logger.info("Found all devices")
    resolve()
    return
  }
  scanForDevices()
  setTimeout(() => scanForDevicesAgain(resolve, reject), 400)
}

function scanForDevicesUntilAll() {
  return new Promise(scanForDevicesAgain)
}

function waitForTemperaturesAgain(resolve, reject) {
  if (!mousepad.rooms.some(r => !r.temp.current)) {
    logger.info("Got all temperatures")
    resolve()
    return
  }
  setTimeout(() => waitForTemperaturesAgain(resolve, reject), 400)
}

function waitForAllTemperatures() {
  return new Promise(waitForTemperaturesAgain)
}

logger.info("Starting Hue sensor polling...")
temps.startPollingSensors(HUE_USERNAME, async sensor => {
  for (let room of mousepad.rooms) {
    if (sensor.uniqueId.startsWith(room.sensorPrefix)) {
      const attributes = sensor.state.attributes.attributes
      if ("temperature" in attributes) {
        room.sensor = sensor
        let temp = ((attributes.temperature / 100) * 9) / 5 + 32
        let oldTemp = room.temp.current
        room.temp.current = temp
        logger.info(room.name + " is now " + temp + " F", { oldTemp, ...room.getLogFields() })
      }
      if ("lightlevel" in attributes) {
        room.lightLevel = attributes.lightlevel
      }
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

function startTimers() {
  mousepad.computeOptimalState()
  mousepad.applyOptimalState()
  logAllRooms()
  logger.info("Starting timers")
  setInterval(() => {
    mousepad.computeOptimalState()
    mousepad.applyOptimalState()
    logAllRooms()
  }, 30 * 1000)
}

async function main() {
  await scanForDevicesUntilAll()
  await waitForAllTemperatures()
  startTimers()
}

main()
  .then(console.log)
  .catch(console.error)

module.exports = { mousepad }
