const { test } = require("tape")
const { Home, Room } = require("../home")

console.log(Home)
console.log(Room)

// TODO: test weird numbers  (0, nan)
// TODO: test really minor differences  (75.1 vs 75.0)

test("should do the obvious thing with a single room", function(t) {
  let A
  let h = new Home((A = new Room({ name: "A", temp: { ideal: 70 } })))

  A.temp.current = 71
  t.deepEqual(h.computeOptimalState(), [["cool"]])

  A.temp.current = 70
  t.deepEqual(h.computeOptimalState(), [["off"]])

  A.temp.current = 69
  t.deepEqual(h.computeOptimalState(), [["heat"]])

  t.end()
})

test("should work with 2 rooms which have compatible needs", function(t) {
  let A, B
  let h = new Home(
    (A = new Room({ name: "A", temp: { ideal: 70 } })),
    (B = new Room({ name: "B", temp: { ideal: 70 } }))
  )

  A.temp.current = 71
  B.temp.current = 70
  t.deepEqual(h.computeOptimalState(), [["cool", "off"]])

  A.temp.current = 71
  B.temp.current = 71
  t.deepEqual(h.computeOptimalState(), [["cool", "cool"]])

  A.temp.current = 70
  B.temp.current = 70
  t.deepEqual(h.computeOptimalState(), [["off", "off"]])

  A.temp.current = 69
  B.temp.current = 70
  t.deepEqual(h.computeOptimalState(), [["heat", "off"]])

  A.temp.current = 69
  B.temp.current = 69
  t.deepEqual(h.computeOptimalState(), [["heat", "heat"]])

  t.end()
})

test("should work with 2 rooms which have INCOMPATIBLE needs but no clear winner", function(t) {
  let A, B
  let h = new Home(
    (A = new Room({ name: "A", temp: { ideal: 70 } })),
    (B = new Room({ name: "B", temp: { ideal: 70 } }))
  )

  A.temp.current = 71
  B.temp.current = 69
  t.deepEqual(h.computeOptimalState(), [["cool", "off"], ["off", "heat"]])

  t.end()
})

test("should work with 2 rooms which have INCOMPATIBLE needs and a clear winner", function(t) {
  let A, B
  let h = new Home(
    (A = new Room({ name: "A", temp: { ideal: 70 } })),
    (B = new Room({ name: "B", temp: { ideal: 70 } }))
  )

  A.temp.current = 72
  B.temp.current = 69
  t.deepEqual(h.computeOptimalState(), [["cool", "off"]])

  A.temp.current = 71
  B.temp.current = 68
  t.deepEqual(h.computeOptimalState(), [["off", "heat"]])

  t.end()
})

test("should prioritize correcting extreme cold", function(t) {
  let A, B
  let h = new Home(
    (A = new Room({ name: "A", temp: { ideal: 70, min: 68, max: 75 } })),
    (B = new Room({ name: "B", temp: { ideal: 70, min: 68, max: 75 } }))
  )

  A.temp.current = 67
  B.temp.current = 75
  t.deepEqual(h.computeOptimalState(), [["heat", "off"]])

  t.end()
})

test("should prioritize correcting extreme heat", function(t) {
  let A, B
  let h = new Home(
    (A = new Room({ name: "A", temp: { ideal: 70, min: 65, max: 72 } })),
    (B = new Room({ name: "B", temp: { ideal: 70, min: 65, max: 72 } }))
  )

  A.temp.current = 67
  B.temp.current = 73
  t.deepEqual(h.computeOptimalState(), [["off", "cool"]])

  t.end()
})

test("should prioritize correcting extreme cold proportionally to how extreme it is", function(t) {
  let A, B
  let h = new Home(
    (A = new Room({ name: "A", temp: { ideal: 70, min: 68, max: 80 } })),
    (B = new Room({ name: "B", temp: { ideal: 70, min: 68, max: 80 } }))
  )

  // 66 is closer to 70 than 81 is, and both are outside the min/max range, but we should still prioritize heat
  // because 67 is further from min than 81 is from max
  A.temp.current = 66
  B.temp.current = 81
  t.deepEqual(h.computeOptimalState(), [["heat", "off"]])

  t.end()
})

test("should prioritize correcting extreme heat proportionally to how extreme it is", function(t) {
  let A, B
  let h = new Home(
    (A = new Room({ name: "A", temp: { ideal: 70, min: 60, max: 72 } })),
    (B = new Room({ name: "B", temp: { ideal: 70, min: 60, max: 72 } }))
  )

  // 75 is closer to 70 than 59 is, and both are outside the min/max range, but we should still prioritize cooling
  // because 75 is further from min than 75 is from max
  A.temp.current = 59
  B.temp.current = 75
  t.deepEqual(h.computeOptimalState(), [["off", "cool"]])

  t.end()
})
