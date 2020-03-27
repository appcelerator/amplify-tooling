#! groovy
library 'pipeline-library@runNPMPackage'

runNPMPackage {
  junitReportPath = 'packages/*/junit.xml'
  nodeVersions = [ '10.19.0', '12.16.1', '13.11.0' ]
  packageJsonPath = 'packages/amplify-cli/package.json'
  publish = false
}
