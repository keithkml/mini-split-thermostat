const { test } = require("tape")
const testing = require("../testing")
testing.setInUnitTest()
const { Home, Room } = require("../home")
const ir = require("../ir")
const codes = require("../codes")

test("should do the obvious thing with a single room", function(t) {
  let A
  let sent
  let h = new Home(
    (A = new Room({
      name: "A",
      temp: { ideal: 70 },
      fanSetting: "auto",
      blaster: {
        sendData(x) {
          sent = x
        }
      }
    }))
  )

  A.temp.current = 71
  t.deepEqual(h.computeOptimalState(), [["cool"]])
  h.applyOptimalState()
  t.equal(sent.toString("hex"), ir.getBuffer("cool", "auto", 70).toString("hex"))

  A.temp.current = 70
  t.deepEqual(h.computeOptimalState(), [["off"]])
  h.applyOptimalState()
  t.equal(sent.toString("hex"), ir.getBuffer("off").toString("hex"))

  A.temp.current = 69
  t.deepEqual(h.computeOptimalState(), [["heat"]])
  h.applyOptimalState()
  t.equal(sent.toString("hex"), ir.getBuffer("heat", "auto", 70).toString("hex"))

  t.end()
})

test("should not repeat commands in a simple case", function(t) {
  let A
  let sent
  let h = new Home(
    (A = new Room({
      name: "A",
      temp: { ideal: 70 },
      fanSetting: "auto",
      blaster: {
        sendData(x) {
          sent = x
        }
      }
    }))
  )

  A.temp.current = 71
  t.deepEqual(h.computeOptimalState(), [["cool"]])
  h.applyOptimalState()
  t.equal(sent.toString("hex"), ir.getBuffer("cool", "auto", 70).toString("hex"))
  sent = null
  h.applyOptimalState()
  t.equal(sent, null)

  t.end()
})

test("should not repeat commands when there are multiple optimal states", function(t) {
  let A
  let sentA, sentB
  let h = new Home(
    (A = new Room({
      name: "A",
      temp: { ideal: 70 },
      fanSetting: "auto",
      blaster: {
        sendData(x) {
          sentA = x
        }
      }
    })),
    (B = new Room({
      name: "B",
      temp: { ideal: 70 },
      fanSetting: "auto",
      blaster: {
        sendData(x) {
          sentB = x
        }
      }
    }))
  )

  A.temp.current = 71
  B.temp.current = 70
  t.deepEqual(h.computeOptimalState(), [["cool", "off"]])
  h.applyOptimalState()
  t.equal(sentA.toString("hex"), ir.getBuffer("cool", "auto", 70).toString("hex"))
  t.equal(sentB.toString("hex"), ir.getBuffer("off").toString("hex"))

  // now create a situation where there are two optimal cases, which includes the previous one
  B.temp.current = 69
  t.deepEqual(h.computeOptimalState(), [["cool", "off"], ["off", "heat"]])

  sentA = sentB = null
  h.applyOptimalState()
  t.equal(sentA, null)
  t.equal(sentB, null)

  t.end()
})

test("should turn all devices off cool before turning any on heat", function(t) {
  let A
  let sent = []
  let h = new Home(
    (A = new Room({
      name: "A",
      temp: { ideal: 70 },
      fanSetting: "auto",
      blaster: {
        sendData(x) {
          sent.push("A")
        }
      }
    })),
    (B = new Room({
      name: "B",
      temp: { ideal: 70 },
      fanSetting: "auto",
      blaster: {
        sendData(x) {
          sent.push("B")
        }
      }
    }))
  )

  A.temp.current = 71
  B.temp.current = 70
  t.deepEqual(h.computeOptimalState(), [["cool", "off"]])
  h.applyOptimalState()
  t.deepEqual(sent, ["B", "A"])

  sent.splice(0, 2)
  A.temp.current = 71
  B.temp.current = 68
  t.deepEqual(h.computeOptimalState(), [["off", "heat"]])
  h.applyOptimalState()
  t.deepEqual(sent, ["A", "B"])
  t.end()
})
