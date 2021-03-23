console.log("hi");
console.log(`This process is pid ${process.pid}`);
process.on('SIGTERM', (sig) => {
	console.log("sig=",sig);
	setTimeout(()=>{
		console.log("bye");
		process.exit(0);
	},1000)
});




setTimeout(()=>{
	console.log("bye bye");
	process.exit(0);
},600000)