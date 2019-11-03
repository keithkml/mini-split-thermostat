let huejay = require("huejay");

function pollSensors(client, callback) {
  client.sensors
    .getAll()
    .then(sensors => {
      for (let sensor of sensors) {
        if (sensor.type == "ZLLTemperature") {
          callback(sensor);
        }
      }
    })
    .catch(error => {
      console.log(error.stack);
      exitHorribly();
    });
}

exports.startPollingSensors = function(username, callback) {
  huejay
    .discover()
    .then(bridges => {
      let bridge = bridges[0];
      console.log("Using Hue bridge " + bridge.ip);
      client = new huejay.Client({
        host: bridge.ip,
        username
      });
      setInterval(() => pollSensors(client, callback), 10 * 1000);
    })
    .catch(error => {
      console.log(`An error occurred: ${error.message}`);
      exitHorribly();
    });
};
