#! groovy
library 'pipeline-library'

runNPMPackage {
  nodeVersions = [ '20.18.2', '22.13.1' ]
  packageJsonPath = 'packages/axway-cli/package.json'
  platforms = [ 'linux', 'osx' ]
  publish = false
  // successThreshold = 50
}
