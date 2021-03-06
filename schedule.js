const deepExtend = require("deep-extend")
const deepEqual = require("deep-equal")
const { logger } = require("./logging")

const TIME_REGEX = /(\d+)\s*([ap])m?/

/**
 * @param {string} str something like 2pm or 4am
 * @returns hour of the day as a float (8.5 for 8:30am, 13.25 for 1:15pm)
 */
function parseTime(str) {
  const g = str.match(TIME_REGEX)
  if (!g) throw new Error("regex does not match " + str)
  let hourOfDay = parseInt(g[1])
  const pm = g[2].toLowerCase() == "p"
  if (!pm && hourOfDay == 12) hourOfDay = 0
  if (pm && hourOfDay != 12) hourOfDay += 12
  return hourOfDay
}

class Schedule {
  constructor(target, rules) {
    this.target = target
    this.lastApplied = {}
    this.times = Object.keys(rules).map(time => ({
      hourOfDay: parseTime(time),
      values: rules[time]
    }))
    this.times.sort((a, b) => a.hourOfDay - b.hourOfDay)
    setInterval(() => this.update(), 1000)
    this.update()
  }

  update() {
    const toApply = {}
    const now = new Date()
    const currentHour = now.getHours()
    let applyIndex = this.times.length - 1
    for (let i = 0; i < this.times.length; i++) {
      if (this.times[i].hourOfDay > currentHour) {
        applyIndex = i - 1
        break
      }
    }
    for (let j = 0; j < this.times.length; j++) {
      const k = (applyIndex + 1 + j) % this.times.length
      deepExtend(toApply, this.times[k].values)
    }
    if (!deepEqual(toApply, this.lastApplied)) {
      logger.info("Scheduled change of " + this.target, {
        targetObj: this.target.toString(),
        ...toApply,
        old: this.lastApplied
      })
      deepExtend(this.target, toApply)
      this.lastApplied = toApply
    }
  }
}

exports.Schedule = Schedule
