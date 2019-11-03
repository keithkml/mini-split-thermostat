const ir = require("./ir")

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
    console.log("configs", this.allConfigurations)
  }

  computeOptimalState() {
    let annotatedConfigurations = this.allConfigurations.map(configuration => ({
      configuration
    }))
    console.log(annotatedConfigurations)
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
      console.log(total + " (" + score.join("+") + ") <-- " + configuration)
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
    // console.log(annotatedConfigurations);
    let bestScore = annotatedConfigurations[0].score
    return (this.optimalConfigurations = annotatedConfigurations
      .filter(a => a.score == bestScore)
      .map(a => a.configuration))
  }

  applyOptimalState() {
    if (!this.optimalConfigurations || !this.optimalConfigurations.length) {
      console.error("no optimal configurations")
      return false
    }
    if (
      this.currentConfiguration &&
      this.optimalConfigurations.some(c => arraysEqual(c, this.currentConfiguration))
    ) {
      console.log("we're already in an optimal configuration; not changing anything")
      return false
    }
    const newConfiguration = this.optimalConfigurations[0]
    for (let i = 0; i < this.rooms.length; i++) {
      let room = this.rooms[i]
      let c = newConfiguration[i]
      let data =
        c == "off" ? ir.getBuffer("off") : ir.getBuffer(c, room.fanSetting, room.temp.ideal)
      room.blaster.sendData(data)
      console.log(`Configuring ${room.name} for ${c} ${room.fanSetting} -> ${room.temp.ideal} F`)
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
    console.error("proposedMode was ", proposedMode)
    return 0
  }
}

exports.Home = Home
exports.Room = Room
