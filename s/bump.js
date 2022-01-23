const pkg = JSON.parse(require('fs').readFileSync("./package.json").toString())

const version = pkg.version.split(".")

const patch = parseInt(version[2]) + 1

const newVersion = version[0] + "." + version[1] + "." + patch

console.log(newVersion)

pkg.version = newVersion

require('fs').writeFileSync("./package.json", JSON.stringify(pkg, null, 2))