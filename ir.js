var codes = {}
exports.setInfraredCode = function(direction, temp, fan, hex) {
  if (!codes[direction]) codes[direction] = {}
  if (!codes[direction][fan]) codes[direction][fan] = {}
  codes[direction][fan][temp] = hex
}
exports.setSpecialCode = function(name, hex) {
  codes[name] = hex
}
exports.getBuffer = function(...names) {
  var x = codes
  for (var name of names) x = x[name]
  return Buffer.from(x, "hex")
}
exports.printAll = function() {
  console.log(codes)
}
