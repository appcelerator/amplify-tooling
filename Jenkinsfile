#! groovy
library 'pipeline-library'

runNPMPackage {
  nodeVersions = [ '12.18.0', '14.15.1' ]
  packageJsonPath = 'packages/axway-cli/package.json'
  platforms = [ 'linux', 'osx' ]
  publish = false
  // successThreshold = 50
}
