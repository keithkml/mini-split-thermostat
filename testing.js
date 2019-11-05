let inUnitTest = false
exports.setInUnitTest = () => {
  inUnitTest = true
}
exports.isUnitTest = () => inUnitTest
