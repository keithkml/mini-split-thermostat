const winston = require("winston")
const testing = require("./testing")
var AWS = require("aws-sdk")
const WinstonCloudWatch = require("winston-cloudwatch")

AWS.config.getCredentials(function(err) {
  if (err) console.log(err.stack)
  // credentials not loaded
  else {
    console.log("Access key:", AWS.config.credentials.accessKeyId)
    console.log("Secret access key:", AWS.config.credentials.secretAccessKey)
  }
})
let transports
if (testing.isUnitTest()) {
  console.log("WE'RE IN A UNIT TEST; NOT LOGGING TO AWS")
  transports = [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
} else {
  transports = [
    //
    // - Write to all logs with level `info` and below to `combined.log`
    // - Write all logs error (and below) to `error.log`.
    //
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({
      format: winston.format.simple()
    }),
    new WinstonCloudWatch({
      logGroupName: "temps",
      logStreamName: "temps",
      awsRegion: "us-east-2"
    })
  ]
}
const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "user-service" },
  transports
})

exports.logger = logger
