export default async ({ console, data, event }) => {
	console.log('ACTION EXAMPLE: You have just installed a package!');
	console.log(`Event: ${event}`);
	console.log('Data:', data);
};
