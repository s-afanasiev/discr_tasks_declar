'use sctrict';
// requires
const fs = require('fs');
const path = require('path');
const os = require('os');
const {spawn, exec} = require('child_process');
const EventEmitter = require('events');

//const SETT_PATH = __dirname+"/../c_settings.json";
//console.log("sett_path = ", path.normalize(SETT_PATH));
//const SETT	= read_settings(path.normalize(SETT_PATH));
//const socket = require('socket.io-client')(SETT.client_socket);
const io = require('socket.io-client');
var socket;

let controller = require('./controller/controller.js');
console.log('controller keys=', Object.keys(controller));
setTimeout(()=>{
    controller = null;
    console.log('controller =', controller);
}, 1000)

setTimeout(()=>{
    controller = require('./controller/controller.js');
    console.log('controller keys=', Object.keys(controller));
}, 2000)


function main() {
    console.log("main()");
    const controller = connect_controller(CTRL_PATH);
    //*1) SET IO LGSTENERS
    //socket_io_init();   
}

function socket_io_init(){
    socket = io(SETT.client_socket).on('connect', function(){
        console.log("connected to master !");
        //socket.emit("test", true);
        //@ prepare identifiers and SEND to master!
        setTimeout(()=>{
            prepare_identifiers().then(arr => {
                io_to_master({title:"identifiers", kind: "report", done: true, payload: arr});
            }).catch(ex => {
                console.log("fail to prepare own identifiers:", ex);
                io_to_master({title:"identifiers", kind: "report", done: false, cause: ex});
            });
        }, 300);
    });
}

function io_to_master(data){
    //* {kind: "", title: "", done: Boolean, data: Any}
    if(!data){
        return {error: "need data"}
    }
    //* NOTE: IN Controller Code 'data.from' will be equal to "controller"
    if(!data.from) {data.from = "agent_core"}
    console.log(">> '" + data.kind + "' to master:" + data.title);
    switch(data.title) {
        //* Launcher sends report own identifiers or request same machine brothers
        //* IF REPORT, then data = [TYPE, SID, MD5, IP, PID, PPID, APID]
        case "identifiers":
        case "manifest":
        case "same_md5_agents":
        //* Launcher expresses an intention to update Controller and wait 'update_agent' event
        case "update_agent":
        case "sync_dirs":
        case "kill_agent":
        case "start_agent":
            socket.emit(data.kind, data, ack=>{console.log("LLLLLLI:acknowledgementsacknowledgements!")});
            break;
        default: 
            console.log("TODO: unregistered event:", data.title);
            socket.emit(data.kind, data);
            break;
    }
}

function prepare_identifiers(){
    console.log("preparing identifiers for master...");
    return new Promise((resolve,reject)=>{
        const TYPE = 0, SID = 1, MD5 = 2, IP = 3, PID = 4, PPID = 5, APID = 6;
        let arr = [];
        arr[TYPE] = "launcher";
        arr[SID] = false;
        arr[IP] = false;
        arr[PID] = process.pid;
        arr[PPID] = process.ppid;
        arr[APID] = (isNaN(Number(process.argv[2]))) ? (-1) : (Number(process.argv[2]));
        if (arr[APID] == 0) arr[APID] = -1;
        
        get_mac((err, res) => {
            if (err) {
                return reject(err);
            }
            arr[MD5] = res;
            this.identifiers = arr;
            this.emtr.emit("identifiers", arr);
            resolve(arr);
        }) 
    });   
}

function get_mac(callback){
    exec_cmd_getmac("getmac")
    .then(res=>{
        res = MD5hash(res);
        console.log("Mac address has successfully received")
        callback(null, res)
    })
    .catch(err=>{
        console.log("try_get_mac_once() returned err:", err)
        if(++attempts_counter >= MAX_ATTEMPTS) {
            console.log("attempts_counter has reached max value:", attempts_counter)
            return callback("MAXX ATTEMPTS to get MAC has reached")
        }
        setTimeout(()=>{
            console.log("Retry to get MAC address...");
            get_mac(callback);
        }, ATTEMPTS_INTERVAL)
    });
}

function exec_cmd_getmac(command_){
    var EOL = /(\r\n)|(\n\r)|\n|\r/;
    let command = command_ || "getmac";
    return new Promise((resolve,reject)=>{
        var CMD = exec('cmd');
        var stdout = '';
        var stdoutres = '';
        var stderr = null;
        CMD.stdout.on('data', function (data) {
            //console.log('exec_cmd chunk:', data);
            stdout += data.toString();
        });
        CMD.stderr.on('data', function (data) {
            if (stderr === null) { stderr = data.toString(); }
            else { stderr += data.toString(); }
        });
        CMD.on('exit', function () {
            stdout = stdout.split(EOL);
            // Find the line index for the macs
            //let regexp = /\d\d-\d\d-\d\d-\d\d-\d\d-\d\d/;
            let regexp = /\w\w-\w\w-\w\w-\w\w-\w\w-\w\w/;
            stdout.forEach(function (out, index) {
                if(typeof out != "undefined")
                    var n = out.search(regexp);
                if (n > -1) {
                    stdoutres += out.slice(n, 17);
                }
                if (out && typeof beginRow == 'undefined' && out.indexOf(regexp) === 0) {
                    beginRow = index;
                }
            });
            if(stderr) reject(stderr);
            else { resolve(stdoutres || false) }
        });
        //CMD.stdin.write('wmic process get ProcessId,ParentProcessId,CommandLine \n');
        CMD.stdin.write(command+'\r\n');
        CMD.stdin.end();
    });
}

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
