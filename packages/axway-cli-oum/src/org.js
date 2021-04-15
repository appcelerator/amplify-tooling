export default {
	commands: `${__dirname}/org`,
	desc: 'Manage Amplify platform organizations',
	help: {
		header({ style }) {
			return `${this.desc}.

Note that you must be authenticated into an Amplify platform account to view or
manage organizations. Run ${style.highlight('"axway auth login"')} to authenticate.`;
		},
		footer({ style }) {
			return `${style.heading('Examples:')}

  List all organizations:
    ${style.highlight('axway org ls')}

  View your current organization's details:
    ${style.highlight('axway org view')}

  View a specific organization's details:
    ${style.highlight('axway org view myorg')}`;
		}
	}
};
