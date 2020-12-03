module.exports = async ({ console, data, event }) => {
	console.log('ACTION EXAMPLE: You have just activated a specific package version!');
	console.log(`Event: ${event}`);
	console.log('Data:', data);
};
