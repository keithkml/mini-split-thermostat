"use strict"
let broadlink = require("../index")
let fs = require("fs")

var b = new broadlink()
var dev = null
var lastData = Buffer.from("xxx")

var filenames = ["dummy.txt", "lightoff", "off"]
// for (var mode of ['heat']) {
//     for (var fan of ['auto', 'high']) {
//         for (var temp of [65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80]) {
//             filenames.push(`${mode}-${temp}-${fan}.ir`)
//         }
//     }
// }
logger.info(filenames)

function useFilename() {
  var toReturn = filenames.shift()
  logger.info("next: " + filenames[0])
  return toReturn
}

b.on("deviceReady", dev => {
  logger.info("device ready " + dev.getType())
  global.dev = dev
  dev.enterLearning()
  useFilename()
  var timer = setInterval(function() {
    dev.checkData()
  }, 1000)

  dev.on("rawData", data => {
    if (data.equals(lastData)) {
      logger.info("data didn't change")
      return
    }
    var nextFilename = useFilename()
    lastData = data
    fs.writeFile(nextFilename, data, function(err) {
      if (err) {
        return logger.info(err)
      }
      logger.info("    (saved " + nextFilename)
    })

    dev.enterLearning()
  })
})

b.discover()
