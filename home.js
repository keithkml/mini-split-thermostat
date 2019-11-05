const ir = require("./ir")
const { logger } = require("./logging")

function permuteConfigurations(mode, numberOfRooms) {
  if (numberOfRooms == 1) return [["off"], [mode]]
  const result = []
  for (let subconfigs of permuteConfigurations(mode, numberOfRooms - 1)) {
    result.push(["off", ...subconfigs])
    result.push([mode, ...subconfigs])
  }
  return result
}

const notAllOff = configuration => configuration.some(c => c != "off")

const A_LOT = 10000

function arraysEqual(a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.length != b.length) return false

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.
  // Please note that calling sort on an array will modify that array.
  // you might want to clone your array first.

  for (var i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) return false
  }
  return true
}

class Home {
  constructor(...rooms) {
    this.rooms = rooms
    this.allConfigurations = [
      ...permuteConfigurations("cool", rooms.length),
      ...permuteConfigurations("heat", rooms.length)
    ].filter(notAllOff)
    this.allConfigurations.push(this.rooms.map(r => "off"))
    this.optimalConfigurations = null
    this.currentConfiguration = null
  }

  computeOptimalState() {
    let annotatedConfigurations = this.allConfigurations.map(configuration => ({
      configuration
    }))
    for (let annotated of annotatedConfigurations) {
      let configuration = annotated.configuration
      let score = []
      for (let i = 0; i < this.rooms.length; i++) {
        let proposedMode = configuration[i]
        let room = this.rooms[i]
        let s = room.scoreModeChange(proposedMode)
        score.push(s)
      }
      let total = score.reduce((a, b) => a + b, 0)
      logger.info("score: " + total + " (" + score.join("+") + ") <-- " + configuration)
      annotated.score = total
    }
    annotatedConfigurations.sort((a, b) => {
      const scoreDifference = b.score - a.score
      if (scoreDifference != 0)
        // choose the one with a higher score
        return scoreDifference
      const onUnitsA = a.configuration.filter(c => c != "off").length
      const onUnitsB = b.configuration.filter(c => c != "off").length
      // choose the one with fewer units on
      let unitDifference = onUnitsA - onUnitsB
      if (unitDifference != 0) return unitDifference
      // at this point they're both pretty similar; let's at least make the answer deterministic
      let aStr = a.configuration.toString()
      let bStr = b.configuration.toString()
      if (aStr == bStr) return 0
      return aStr > bStr ? 1 : -1
    })
    let bestScore = annotatedConfigurations[0].score
    return (this.optimalConfigurations = annotatedConfigurations
      .filter(a => a.score == bestScore)
      .map(a => a.configuration))
  }

  applyOptimalState() {
    if (!this.optimalConfigurations || !this.optimalConfigurations.length) {
      logger.error("no optimal configurations")
      return false
    }
    if (
      this.currentConfiguration &&
      this.optimalConfigurations.some(c => arraysEqual(c, this.currentConfiguration))
    ) {
      logger.info("we're already in an optimal configuration; not changing anything")
      return false
    }
    const newConfiguration = this.optimalConfigurations[0]
    // Gotta turn devices off first otherwise the whole system dies
    for (let i = 0; i < this.rooms.length; i++) {
      if (newConfiguration[i] == "off") this.rooms[i].configure(newConfiguration[i])
    }
    for (let i = 0; i < this.rooms.length; i++) {
      if (newConfiguration[i] != "off") this.rooms[i].configure(newConfiguration[i])
    }
    this.currentConfiguration = newConfiguration
    return true
  }
}

class Room {
  constructor(options) {
    for (let k in options) {
      this[k] = options[k]
    }
  }

  scoreModeChange(proposedMode) {
    // We prefer "off" if we're not valid, even though it doesn't really matter. It helps the optimizer make better decisions.
    if (!this.isValid()) return proposedMode == "off" ? 0 : -A_LOT
    // Check for danger first
    if (this.temp.current < this.temp.min) {
      if (proposedMode == "heat") return A_LOT * (this.temp.min - this.temp.current)
    }
    if (this.temp.current > this.temp.max) {
      if (proposedMode == "cool") return A_LOT * (this.temp.current - this.temp.max)
    }
    // desiredChange will be negative if we'd like to cool the room
    const desiredChange = this.temp.ideal - this.temp.current
    if (proposedMode == "cool") {
      if (desiredChange < 0) return -desiredChange
      return -A_LOT
    }
    if (proposedMode == "heat") {
      if (desiredChange > 0) return desiredChange
      return -A_LOT
    }
    if (proposedMode == "off")
      // return negative score for status quo unless desiredChange is zero
      return -Math.abs(desiredChange)
    // should never happen
    logger.error("proposedMode was ", proposedMode)
    return 0
  }

  isValid() {
    return !isNaN(this.temp.current) && typeof this.temp.current == "number"
  }

  configure(mode) {
    if (!this.isValid) {
      logger.warn("Skipping configuration of " + this.name + " because we're not valid")
      return false
    }
    let data =
      mode == "off" ? ir.getBuffer("off") : ir.getBuffer(mode, this.fanSetting, this.temp.ideal)
    this.blaster.sendData(data)
    logger.info(`Configuring ${this.name} for ${mode} ${this.fanSetting} -> ${this.temp.ideal} F`)
    return true
  }
}

exports.Home = Home
exports.Room = Room
