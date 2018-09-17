#! groovy
library 'pipeline-library@fix_windows_exitcode'

timestamps {
  def isMaster = false
  def packageVersion
  def nodeVersion = '8.11.4'
  def yarnVersion = 'latest' // We want latest by default, but can lockdown if we wish to

  node('osx || linux') {
    stage('Checkout') {
      // checkout scm
      // Hack for JENKINS-37658 - see https://support.cloudbees.com/hc/en-us/articles/226122247-How-to-Customize-Checkout-for-Pipeline-Multibranch
      // do a git clean before checking out
      checkout([
        $class: 'GitSCM',
        branches: scm.branches,
        extensions: scm.extensions + [[$class: 'CleanBeforeCheckout']],
        userRemoteConfigs: scm.userRemoteConfigs
      ])

      isMaster = env.BRANCH_NAME.equals('master')
      packageVersion = jsonParse(readFile('package.json'))['version']
      currentBuild.displayName = "#${packageVersion}-${currentBuild.number}"
      stash allowEmpty: true, name: 'sources', useDefaultExcludes: false
    }

    nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
      ansiColor('xterm') {
        stage('Install') {
          timeout(15) {
            // Ensure we have yarn
            ensureYarn(yarnVersion)
            sh 'yarn'
            fingerprint 'package.json'
          } // timeout
        } // stage

        // TODO: Anything other than test? Test also runs lint so pointless having a separate lint step

        stage('Unit Test') {
            try {
              sh 'yarn run gulp coverage'
            } finally {
              // record results even if tests/coverage 'fails'
              junit 'packages/*/junit.xml'
              step([$class: 'CoberturaPublisher', autoUpdateHealth: false, autoUpdateStability: false, coberturaReportFile: 'coverage/cobertura-coverage.xml', failUnhealthy: false, failUnstable: false, maxNumberOfBuilds: 0, onlyStable: false, sourceEncoding: 'ASCII', zoomCoverageChart: false])
            }
        }
      } // ansiColor
    } // nodejs
  } // node

  stage('Integration tests') {
    parallel(
      'Linux integration tests': integrationTests('linux', nodeVersion, yarnVersion),
      'OSX integration tests': integrationTests('osx', nodeVersion, yarnVersion),
      'Windows Integration tests': integrationTests('windows', nodeVersion, yarnVersion),
      failFast: false
	)
  }

} // timestamps

def integrationTests(os, nodeVersion, yarnVersion) {
  return {
    node(os) {
      nodejs(nodeJSInstallationName: "node ${nodeVersion}") {
        stage('Test') {
          timeout(15) {
            unstash 'sources'
            // Install yarn if not installed
            ensureYarn(yarnVersion)
            if('windows'.equals(os)) {
              bat 'yarn'
            } else {
              sh 'yarn'
            }
            try {
              if('windows'.equals(os)) {
                bat 'yarn run gulp integration'
              } else {
                sh 'yarn run gulp integration'
              }
            } finally {
              // record results even if tests/coverage 'fails'
            }
          } // timeout
        } // test
      } // nodejs
    }  // node
  }
}
