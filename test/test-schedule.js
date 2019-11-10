const test = require("tape-async")
const testing = require("../testing")
testing.setInUnitTest()
const lolex = require("lolex")
const { Schedule } = require("../schedule")

const midnight = Date.parse("2019-11-10 00:00")
const one_am = Date.parse("2019-11-10 01:00")
const two_am = Date.parse("2019-11-10 02:00")

const one_pm = Date.parse("2019-11-10 13:00")
const two_pm = Date.parse("2019-11-10 14:00")

test("basic schedule", async function(t) {
  const clock = lolex.install({ now: two_am })

  const o = {}

  let s = new Schedule(o, {
    "2am": { part: "morning" },
    "12pm": { part: "midday" },
    "12am": { part: "night" }
  })

  t.equal(o.part, "morning")

  clock.setSystemTime(one_pm)
  clock.tick(1000)
  t.equal(o.part, "midday")

  clock.setSystemTime(two_pm)
  clock.tick(1000)
  t.equal(o.part, "midday")

  clock.setSystemTime(midnight)
  clock.tick(1000)
  t.equal(o.part, "night")

  clock.setSystemTime(one_am)
  clock.tick(1000)
  t.equal(o.part, "night")

  clock.uninstall()
  t.end()
})
