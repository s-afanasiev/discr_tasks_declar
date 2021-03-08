const fs = require('fs');
const path = require('path');
const SETT	= read_settings(path.normalize("../c_settings.json"));
const io = require('socket.io-client');
//@ после выполнения следующей строки произойдёт коннект !
var socket = io(SETT.client_socket);

socket.on('connect', function(){
  console.log("connected!")
});



function read_settings(json_path)
{
	try	{
		//const json = fs.readFileSync(json_path, "utf8");
		let settings = JSON.parse(fs.readFileSync(json_path, "utf8"));

		if (settings) return settings;
		else {
			console.log("wrong settings data")
			return {error: "wrong settings data"};
		}
	}
	catch (e) {
		console.error("JSON PARSE ERROR: ", e);
		return {error: e};
	}
}

main();
function main(){
	var obj = {"a":5, "b":"str"}
	var obj2 = JSON.stringify(obj);
	var obj3 = JSON.stringify(obj2);
	var obj4 = JSON.stringify(obj3);
	console.log(obj);
	console.log(obj2);
	console.log(obj3);
	console.log(obj4);
}