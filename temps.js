let huejay = require("huejay")
const { logger } = require("./logging")

function pollSensors(client, callback) {
  client.sensors
    .getAll()
    .then(sensors => {
      for (let sensor of sensors) {
        if (sensor.type == "ZLLTemperature" || sensor.type == "ZLLLightLevel") {
          callback(sensor)
        }
      }
    })
    .catch(error => {
      logger.error(error.stack)
    })
}

exports.startPollingSensors = function(username, callback) {
  huejay
    .discover()
    .then(bridges => {
      let bridge = bridges[0]
      logger.info("Using Hue bridge " + bridge.ip)
      client = new huejay.Client({
        host: bridge.ip,
        username
      })
      setInterval(() => pollSensors(client, callback), 10 * 1000)
    })
    .catch(error => {
      logger.error(`An error occurred: ${error.message}`)
    })
}
