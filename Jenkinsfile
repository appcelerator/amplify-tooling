#! groovy
library 'pipeline-library'

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

        stage('Integration Test') {
              try {
                  sh 'yarn run gulp integration'
              } finally {

              }
        }

      } // ansiColor
    } // nodejs
  } // node
} // timestamps
