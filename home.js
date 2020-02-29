const ir = require("./ir")
const { logger } = require("./logging")
const { Schedule } = require("./schedule")

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

const sleep = async ms => new Promise(resolve => setTimeout(resolve, ms))

function arraysEqual(a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  if (a.length != b.length) return false

  // If you don't care about the order of the elements inside
  // the array, you should sort both arrays here.
  // Please note that calling sort on an array will modify that array.
  // you might want to clone your array first.

  for (let i = 0; i < a.length; ++i) if (a[i] !== b[i]) return false

  return true
}

class Home {
  constructor(...rooms) {
    this.rooms = rooms
    this.lastRefreshMs = 0
    this.maxRefreshIntervalMs = 6 * 60 * 60 * 1000
    this.sleepBetweenCommands = 1000
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

  async applyOptimalState() {
    if (!this.optimalConfigurations || !this.optimalConfigurations.length) {
      logger.error("no optimal configurations")
      return false
    }
    const now = Date.now()
    const force = now - this.lastRefreshMs >= this.maxRefreshIntervalMs
    if (
      this.currentConfiguration &&
      this.optimalConfigurations.some(c => arraysEqual(c, this.currentConfiguration)) &&
      !force
    ) {
      logger.info("we're already in an optimal configuration; not changing anything", {
        type: "optimal"
      })
      return false
    }
    this.lastRefreshMs = now
    const newConfiguration = this.optimalConfigurations[0]
    let doneAnythingYet = false
    // Gotta turn devices off first otherwise the whole system dies
    for (let i = 0; i < this.rooms.length; i++) {
      if (newConfiguration[i] == "off") {
        if (doneAnythingYet) await sleep(this.sleepBetweenCommands)
        try {
          await this.rooms[i].configure(newConfiguration[i], force)
        } catch (e) {
          logger.error(this.rooms[i].name + " - " + e, {
            ...this.rooms[i].getLogFields(),
            errorMessage: "" + e,
            mode: newConfiguration[i]
          })
        }
        doneAnythingYet = true
      }
    }
    for (let i = 0; i < this.rooms.length; i++) {
      if (newConfiguration[i] != "off") {
        if (doneAnythingYet) await sleep(this.sleepBetweenCommands)
        try {
          await this.rooms[i].configure(newConfiguration[i], force)
        } catch (e) {
          logger.error(this.rooms[i].name + " - " + e, {
            ...this.rooms[i].getLogFields(),
            errorMessage: "" + e,
            mode: newConfiguration[i]
          })
        }
        doneAnythingYet = true
      }
    }
    this.currentConfiguration = newConfiguration
    return true
  }
}

class Room {
  constructor(options) {
    this.overshootIdealTemp = 2
    this.priority = 1
    this.temp = {}
    this.fanSetting = "auto"
    this.changeCost = 1.1
    this.currentMode = null
    for (let k in options) this[k] = options[k]
    if (this.schedule) this.scheduleObject = new Schedule(this, this.schedule)
  }

  scoreModeChange(proposedMode) {
    // We prefer "off" if we're not valid
    if (!this.isValid()) return proposedMode == "off" ? 0 : -A_LOT
    const changeCost = this.currentMode == proposedMode ? 0 : this.changeCost
    return this.priority * (this.scoreModeChangeWithoutPriority(proposedMode) - changeCost)
  }

  scoreModeChangeWithoutPriority(proposedMode) {
    // Check for danger first
    if (this.temp.current < this.temp.min)
      if (proposedMode == "heat") return A_LOT * (this.temp.min - this.temp.current)
    if (this.temp.current > this.temp.max)
      if (proposedMode == "cool") return A_LOT * (this.temp.current - this.temp.max)
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
    logger.error("no score for proposedMode ", { proposedMode, ...this.getLogFields() })
    return 0
  }

  isValid() {
    return !isNaN(this.temp.current) && typeof this.temp.current == "number"
  }

  async configure(mode, force) {
    if (!this.isValid) {
      logger.warn("Skipping configuration of " + this.name + " because we're not valid", {
        ...this.getLogFields()
      })
      return false
    }
    const temp = this.temp.ideal + (mode == "heat" ? 1 : -1) * this.overshootIdealTemp
    let data = mode == "off" ? ir.getBuffer("off") : ir.getBuffer(mode, this.fanSetting, temp)
    if (
      this.currentIRData &&
      data.toString("hex") == this.currentIRData.toString("hex") &&
      !force
    ) {
      logger.warn("Skipping configuration of " + this.name + " because it hasn't changed", {
        ...this.getLogFields()
      })
      return
    }
    this.currentMode = mode
    this.temp.target = temp
    this.currentIRData = data
    logger.info(
      `Configuring ${this.name} (currently ${this.temp.current} F) for ${mode} ${this.fanSetting} -> ${temp} F`,
      { ...this.getLogFields() }
    )
    this.blaster.sendData(data)
    await sleep(1000)
    this.blaster.sendData(data)
    if (this.turnOffStatusLight) {
      // We need to do this even for "off" because sometimes the lights stay on for a few minutes
      await sleep(1000)
      this.blaster.sendData(ir.getBuffer("lightoff"))
    }
    return true
  }

  getLogFields() {
    return {
      name: this.name,
      mode: this.currentMode,
      modeNumeric: this.currentMode == "off" ? 0 : this.currentMode == "cool" ? -1 : 1,
      priority: this.priority,
      ...this.temp,
      diff: this.temp.ideal - this.temp.current,
      fanSetting: this.fanSetting
    }
  }

  toString() {
    return this.name + " (" + this.temp.current + " F) " + this.currentMode
  }
}

exports.Home = Home
exports.Room = Room
