const { test } = require("tape")
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
