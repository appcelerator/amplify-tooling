export default  async ({ console, data, event }) => {
	console.log('ACTION EXAMPLE: You have just purged old packages!');
	console.log(`Event: ${event}`);
	console.log('Data:', data);
};
