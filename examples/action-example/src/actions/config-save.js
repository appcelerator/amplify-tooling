export default async ({ console, data, event }) => {
	console.log('ACTION EXAMPLE: You have just updated the Axway CLI config!');
	console.log(`Event: ${event}`);
	console.log('Data:', data);
};
