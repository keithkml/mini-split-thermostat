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
  try {
    var x = codes
    for (var name of names) x = x[name]
    return Buffer.from(x, "hex")
  } catch (e) {
    throw new Error("could not find IRR codes for " + names)
  }
}
exports.printAll = function() {
  console.log(codes)
}
