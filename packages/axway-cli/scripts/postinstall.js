const { cyan, green } = require('snooplogg').default.chalk;

console.log(`
${green('Axway CLI successfully installed!')}

GETTING HELP:

  The Axway CLI has built-in help that can be accessed by passing ${cyan('--help')} into
  any command or by running:

    ${cyan('axway')}

  Visit the documentation for configuration and troubleshooting help:

    ${cyan('https://docs.axway.com/bundle/Axway_CLI_allOS_en/page/axway_cli.html')}

AUTHENTICATION:

  To log into the AMPLIFY Platform, run:

    ${cyan('axway auth login')}

PACKAGES:

  The Axway CLI package manager allows you to search, view, install, update,
  and uninstall packages such as other Axway CLI products.

  To search for a package, run:

    ${cyan('axway pm search')}

  To install a package, run:

    ${cyan('axway pm install <package>[@<version>]')}

  To list installed packages, run:

    ${cyan('axway pm list')}

ORGANIZATION, USER, AND TEAM MANAGEMENT:

  Once authenticated as a platform user, you may manage organizations, teams,
  and your user information using the following commands:

    ${cyan('axway org')}
    ${cyan('axway team')}
    ${cyan('axway user')}

NEXT STEPS:

  Install Amplify Runtime Services:

    ${cyan('axway pm i acs')}

  Install Amplify API Builder:

    ${cyan('axway pm i @axway/amplify-api-builder-cli')}
`);
