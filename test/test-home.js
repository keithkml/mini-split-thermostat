const test = require("tape-async")
const testing = require("../testing")
testing.setInUnitTest()
const lolex = require("lolex")
const clock = lolex.install()

const home = require("../home")
const { Home, Room } = home
const ir = require("../ir")
const codes = require("../codes")

test("should do the obvious thing with a single room", async function(t) {
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
  await clock.tickAsync(5000)
  t.equal(sent.toString("hex"), ir.getBuffer("cool", "auto", 68).toString("hex"))

  A.temp.current = 70
  t.deepEqual(h.computeOptimalState(), [["off"]])
  h.applyOptimalState()
  await clock.tickAsync(5000)
  t.equal(sent.toString("hex"), ir.getBuffer("off").toString("hex"))

  A.temp.current = 69
  t.deepEqual(h.computeOptimalState(), [["heat"]])
  h.applyOptimalState()
  await clock.tickAsync(5000)
  t.equal(sent.toString("hex"), ir.getBuffer("heat", "auto", 72).toString("hex"))

  t.end()
})

test("should not repeat commands in a simple case", async function(t) {
  let A
  let sent
  let h = new Home(
    (A = new Room({
      name: "A",
      temp: { ideal: 70 },
      fanSetting: "auto",
      blaster: {
        sendData(x) {
          sent = x.toString("hex")
        }
      }
    }))
  )

  A.temp.current = 71
  t.deepEqual(h.computeOptimalState(), [["cool"]])
  await h.applyOptimalState()
  t.equal(sent, ir.getBuffer("cool", "auto", 68).toString("hex"))
  sent = null
  await h.applyOptimalState()
  t.equal(sent, null)

  t.end()
})

test("should repeat commands 6 hours later", async function(t) {
  let A
  let sent
  let h = new Home(
    (A = new Room({
      name: "A",
      temp: { ideal: 70 },
      fanSetting: "auto",
      blaster: {
        sendData(x) {
          sent = x.toString("hex")
        }
      }
    }))
  )

  const cool = ir.getBuffer("cool", "auto", 68).toString("hex")

  A.temp.current = 71
  t.deepEqual(h.computeOptimalState(), [["cool"]])
  await h.applyOptimalState()
  t.equal(sent, cool)
  clock.tick(7 * 60 * 60 * 1000)
  sent = null
  await h.applyOptimalState()
  t.equal(sent, cool)

  t.end()
})

test("should not repeat commands when there are multiple optimal states (ignoring change cost)", async function(t) {
  let A
  let sentA, sentB
  let h = new Home(
    (A = new Room({
      name: "A",
      temp: { ideal: 70 },
      fanSetting: "auto",
      changeCost: 0,
      blaster: {
        sendData(x) {
          sentA = x.toString("hex")
        }
      }
    })),
    (B = new Room({
      name: "B",
      temp: { ideal: 70 },
      fanSetting: "auto",
      changeCost: 0,
      blaster: {
        sendData(x) {
          sentB = x.toString("hex")
        }
      }
    }))
  )

  A.temp.current = 72
  B.temp.current = 70
  t.deepEqual(h.computeOptimalState(), [["cool", "off"]])
  h.applyOptimalState()
  await clock.tickAsync(1200)
  t.equal(sentA, ir.getBuffer("cool", "auto", 68).toString("hex"))
  t.equal(sentB, ir.getBuffer("off").toString("hex"))

  // now create a situation where there are two optimal cases, which includes the previous one
  B.temp.current = 68
  t.deepEqual(h.computeOptimalState(), [["cool", "off"], ["off", "heat"]])

  sentA = sentB = null
  h.applyOptimalState()
  await clock.tickAsync(1200)
  t.equal(sentA, null)
  t.equal(sentB, null)

  t.end()
})

test("should not change unless difference higher than change cost", async function(t) {
  let A
  let sentA, sentB
  let h = new Home(
    (A = new Room({
      name: "A",
      temp: { ideal: 70 },
      fanSetting: "auto",
      blaster: {
        sendData(x) {
          sentA = x.toString("hex")
        }
      }
    })),
    (B = new Room({
      name: "B",
      temp: { ideal: 70 },
      fanSetting: "auto",
      blaster: {
        sendData(x) {
          sentB = x.toString("hex")
        }
      }
    }))
  )

  A.temp.current = 71
  B.temp.current = 70
  t.deepEqual(h.computeOptimalState(), [["cool", "off"]])
  h.applyOptimalState()
  await clock.tickAsync(1200)
  t.equal(sentA, ir.getBuffer("cool", "auto", 68).toString("hex"))
  t.equal(sentB, ir.getBuffer("off").toString("hex"))

  B.temp.current = 70.5
  t.deepEqual(h.computeOptimalState(), [["cool", "off"]])

  sentA = sentB = null
  h.applyOptimalState()
  await clock.tickAsync(1200)
  t.equal(sentA, null)
  t.equal(sentB, null)

  B.temp.current = 72
  t.deepEqual(h.computeOptimalState(), [["cool", "cool"]])

  sentA = sentB = null
  h.applyOptimalState()
  await clock.tickAsync(1200)
  t.equal(sentA, null) // was already sent
  t.equal(sentB, ir.getBuffer("cool", "auto", 68).toString("hex"))

  t.end()
})

test("should turn all devices off cool before turning any on heat", async function(t) {
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

  A.temp.current = 72
  B.temp.current = 70
  t.deepEqual(h.computeOptimalState(), [["cool", "off"]])
  h.applyOptimalState()
  await clock.tickAsync(5000)
  t.deepEqual(sent, ["B", "A"])

  sent.splice(0, 2)
  A.temp.current = 70
  B.temp.current = 68
  t.deepEqual(h.computeOptimalState(), [["off", "heat"]])
  h.applyOptimalState()
  await clock.tickAsync(5000)
  t.deepEqual(sent, ["A", "B"])
  t.end()
})

test("should not send commands already sent", async function(t) {
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
  const promise = h.applyOptimalState()
  await clock.tickAsync(5000)
  t.deepEqual(sent, ["B", "A"])

  await promise
  sent.splice(0, 2)
  B.temp.current = 71
  t.deepEqual(h.computeOptimalState(), [["cool", "cool"]])
  h.applyOptimalState()
  await clock.tickAsync(5000)
  t.deepEqual(sent, ["B"])
  t.end()
})

//TODO: should send commands if slightly different
// test("should send commands if slightly different", async function(t) {
//   let A
//   let sent
//   let h = new Home(
//     (A = new Room({
//       name: "A",
//       temp: { ideal: 70 },
//       fanSetting: "auto",
//       blaster: {
//         sendData(x) {
//           sent = x
//         }
//       }
//     }))
//   )

//   A.temp.current = 73
//   t.deepEqual(h.computeOptimalState(), [["cool"]])
//   h.applyOptimalState()
//   await clock.tickAsync(5000)
//   t.equal(sent.toString("hex"), ir.getBuffer("cool", "auto", 68).toString("hex"))

//   sent = null
//   A.temp.ideal = 71
//   t.deepEqual(h.computeOptimalState(), [["cool"]])
//   h.applyOptimalState()
//   await clock.tickAsync(5000)
//   t.equal(sent.toString("hex"), ir.getBuffer("cool", "auto", 67).toString("hex"))

//   sent = null
//   A.fanSetting = "high"
//   t.deepEqual(h.computeOptimalState(), [["cool"]])
//   h.applyOptimalState()
//   await clock.tickAsync(5000)
//   t.equal(sent.toString("hex"), ir.getBuffer("cool", "high", 67).toString("hex"))

//   t.end()
// })

test("should delay when transitioning from cool to heat", async function(t) {
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
  t.deepEqual(sent, ["B"])
  await clock.tickAsync(5000)
  t.deepEqual(sent, ["B", "A"])

  sent.splice(0, 2)
  A.temp.current = 70
  B.temp.current = 68
  t.deepEqual(h.computeOptimalState(), [["off", "heat"]])
  h.applyOptimalState()
  t.deepEqual(sent, ["A"])
  await clock.tickAsync(5000)
  t.deepEqual(sent, ["A", "B"])

  t.end()
})

test("turn status light off after change", async function(t) {
  let A
  let sent = []
  let h = new Home(
    (A = new Room({
      name: "A",
      temp: { ideal: 70 },
      fanSetting: "auto",
      turnOffStatusLight: true,
      blaster: {
        sendData(x) {
          sent.push(x.toString("hex"))
        }
      }
    }))
  )

  A.temp.current = 71
  t.deepEqual(h.computeOptimalState(), [["cool"]])
  h.applyOptimalState()
  const cool = ir.getBuffer("cool", "auto", 68).toString("hex")
  t.deepEqual(sent, [cool])
  await clock.tickAsync(5000)
  t.deepEqual(sent, [cool, ir.getBuffer("lightoff").toString("hex")])

  sent.splice(0, 2)
  A.temp.current = 70
  t.deepEqual(h.computeOptimalState(), [["off"]])
  h.applyOptimalState()
  const off = ir.getBuffer("off").toString("hex")
  t.deepEqual(sent, [off])
  await clock.tickAsync(5000)
  t.deepEqual(sent, [off, ir.getBuffer("lightoff").toString("hex")])

  t.end()
})
