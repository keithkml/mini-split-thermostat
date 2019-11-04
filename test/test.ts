"use strict"
import * as Broadlink from "broadlinkjs"
import fs = require("fs")

var b = new Broadlink()

b.on("deviceReady", dev => {
  if (dev.getType() !== "RM2") {
    logger.info("Not a supported device yet.")
  }

  var rm2 = dev as Broadlink.RM2
  var timer = setInterval(function() {
    logger.info("send check!")
    rm2.checkData()
  }, 1000)

  rm2.on("temperature", temp => {
    logger.info("get temp " + temp)
    rm2.enterLearning()
  })

  rm2.on("rawData", data => {
    fs.writeFile("test1", data, function(err) {
      if (err) {
        return logger.info(err)
      }
      logger.info("The file was saved!")
      clearInterval(timer)
    })
  })
  rm2.checkTemperature()
})

b.discover()
