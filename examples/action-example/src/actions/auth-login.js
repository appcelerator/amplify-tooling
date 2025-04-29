export default async ({ console, data, event }) => {
	console.log('ACTION EXAMPLE: You have just logged in!');
	console.log(`Event: ${event}`);
	console.log('Data:', data);
};
