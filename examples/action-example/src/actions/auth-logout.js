module.exports = async ({ console, data, event }) => {
	console.log('ACTION EXAMPLE: You have just logged out!');
	console.log(`Event: ${event}`);
	console.log('Data:', data);
};
