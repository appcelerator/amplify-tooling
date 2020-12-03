module.exports = async ({ console, data, event }) => {
	console.log('ACTION EXAMPLE: You have just updated all packages!');
	console.log(`Event: ${event}`);
	console.log('Data:', data);
};
