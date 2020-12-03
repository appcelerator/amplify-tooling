module.exports = async ({ console, data, event }) => {
	console.log('ACTION EXAMPLE: You have just switched default org!');
	console.log(`Event: ${event}`);
	console.log('Data:', data);
};
