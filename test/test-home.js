const { test } = require("tape");
const { Home, Room } = require("../home");

console.log(Home);
console.log(Room);

test("should do the obvious thing with a single room", function(t) {
  let A;
  let h = new Home((A = new Room({ name: "A", temp: { ideal: 90 } })));

  A.temp.current = 91;
  t.deepEqual(h.computeOptimalState(), [["cool"]]);

  A.temp.current = 90;
  t.deepEqual(h.computeOptimalState(), [["off"]]);

  A.temp.current = 89;
  t.deepEqual(h.computeOptimalState(), [["heat"]]);

  t.end();
});

test("should work with 2 rooms which have compatible needs", function(t) {
  let A, B;
  let h = new Home(
    (A = new Room({ name: "A", temp: { ideal: 90 } })),
    (B = new Room({ name: "B", temp: { ideal: 90 } }))
  );

  A.temp.current = 91;
  B.temp.current = 90;
  t.deepEqual(h.computeOptimalState(), [["cool", "off"]]);

  A.temp.current = 91;
  B.temp.current = 91;
  t.deepEqual(h.computeOptimalState(), [["cool", "cool"]]);

  A.temp.current = 90;
  B.temp.current = 90;
  t.deepEqual(h.computeOptimalState(), [["off", "off"]]);

  A.temp.current = 89;
  B.temp.current = 90;
  t.deepEqual(h.computeOptimalState(), [["heat", "off"]]);

  A.temp.current = 89;
  B.temp.current = 89;
  t.deepEqual(h.computeOptimalState(), [["heat", "heat"]]);

  t.end();
});

test("should work with 2 rooms which have INCOMPATIBLE needs but no clear winner", function(t) {
  let A, B;
  let h = new Home(
    (A = new Room({ name: "A", temp: { ideal: 90 } })),
    (B = new Room({ name: "B", temp: { ideal: 90 } }))
  );

  A.temp.current = 91;
  B.temp.current = 89;
  t.deepEqual(h.computeOptimalState(), [["cool", "off"], ["off", "heat"]]);

  t.end();
});

test("should work with 2 rooms which have INCOMPATIBLE needs and a clear winner", function(t) {
  let A, B;
  let h = new Home(
    (A = new Room({ name: "A", temp: { ideal: 90 } })),
    (B = new Room({ name: "B", temp: { ideal: 90 } }))
  );

  A.temp.current = 92;
  B.temp.current = 89;
  t.deepEqual(h.computeOptimalState(), [["cool", "off"]]);

  A.temp.current = 91;
  B.temp.current = 88;
  t.deepEqual(h.computeOptimalState(), [["off", "heat"]]);

  t.end();
});
