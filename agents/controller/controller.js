//controller.js
'use sctrict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const {spawn, exec} = require('child_process');
const EventEmitter = require('events');
const io = require('socket.io-client');
//const socket = require('./socket.io.dev.js')(SETT.client_socket);
const $checkDiskSpace = require('check-disk-space');
var ps = require('ps-node');
const { emit } = require('process');
//@ ---------------------------------
function mainTest(){
	const settings = read_settings("../c_settings.json");
	console.log("settings = "+JSON.stringify(settings))
	const io = require('socket.io-client');
	const socket = io(settings.client_socket);
	socket.on("connect", (par)=>{ console.log("connected??") })
}
//@-------IMPLEMENTATION------------
const glob = {}; //global var
main();
function main(){
	new App().run();
}
//@ ---------------------------------
function App(){
	this.run=()=>{
        new Controller(
            new Identifiers(),
            new SocketIoHandlers(
                new IoWrap(
                    new IoSettings(__dirname+"/../c_settings.json").as("settings"),
                    new StringifiedJson()
                )
            )
                .with('compareManifest', new ComparedManifest(
                    new DirStructure(), 
                    new DirsComparing(),
                    "settings"
                ))
                .with('killPartner', new KilledPartner())
                .with('updateFiles', new UpdatedFiles())
                .with('startPartner', new StartedPartner())
                .with('diskSpace', new DiskSpace())
        ).run();
	}
}
function Controller(identifiers, socketIoHandlers){
    this.identifiers=identifiers;
    this.socketIoHandlers=socketIoHandlers;
    this.run=()=>{
        this.identifiers.prepare().then(agent_ids=>{
            this.socketIoHandlers.run(agent_ids);
        }).catch(err=>{
            console.log("Launcher.run(): this.identifiers.prepare() Error: ", err);
        })
    }
}
function Identifiers(){
    this.prepare=()=>{
        console.log("preparing identifiers for master...");
        return new Promise((resolve,reject)=>{
            let ids = {};
            ids.ag_type = "controller";
            this.get_mac((err, mac) => {
                if (err) { return reject(err);}
                else{
                    ids.md5 = mac;
                    ids.pid = process.pid;
                    ids.ppid = process.ppid;
                    ids.apid = (isNaN(Number(process.argv[2]))) ? (-1) : (Number(process.argv[2]));
                    if (ids.apid == 0) ids.apid = -1;
                    ids.sid = "";
                    ids.ip = "";
                    resolve(ids);
                }
            }) 
        }); 
    }  
    this.get_mac=(callback)=>{
        //console.log("now in get_mac()")
        this.exec_cmd_getmac("getmac").then(res=>{
            res = MD5hash(res);
            console.log("Mac address has successfully received")
            callback(null, res)
        }).catch(err=>{
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
    this.exec_cmd_getmac=(command_)=>{
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
}
function IoWrap(ioSettings, stringifiedJson){
	this.socket = undefined;
    this.ioSettings= ioSettings;
    this.stringifiedJson= stringifiedJson;
    this.socketio=()=>{return this.socket}
    this.run=(agent_ids)=>{
        const io = require('socket.io-client');
		const settings = this.ioSettings.read(); //sync
        console.log("IoWrap.run(): settings=", settings);
		//@ At this moment connection happens
		this.socket = io(settings.client_socket, {query:{
            "browser_or_agent": "agent",
            "agent_identifiers": this.stringifiedJson.run(agent_ids)
        }});
        this.socket.on('connect',()=>{console.log(">>>connected to server!")})
        this.socket.on('disconnect',()=>{console.log(">>>disconnected from server!")})
		return this;
    }
}
function StringifiedJson(){
    this.ids_json = undefined;
    this.run=(ids_json)=>{
        this.ids_json=ids_json;
        const ids_string = (this.ids_json) ? JSON.stringify(this.ids_json) : JSON.stringify({})
        return ids_string;
    };
}
function IoSettings(settingsPath){
	this.settingsPath = settingsPath;
	this.read=()=>{
		const normalized_path = path.normalize(this.settingsPath);
        let settings;
		try{
			const json_file = fs.readFileSync(normalized_path, "utf8");
			settings = JSON.parse(json_file);
		}catch(err){
            console.log("IoSettings.read() Error: ", err);
            return {error: err};
        }
        return settings;
	}
    this.as=(name)=>{
        glob[name]=this;
        return this;
    }
}

function SocketIoHandlers(ioWrap){
    this.ioWrap= ioWrap;
	this.socket = undefined;
    this.allEvHandlers = {};
    this.with=(ev_name, evHandler)=>{
        this.allEvHandlers[ev_name] = evHandler;
        return this;
    }
	this.run=(agent_ids)=>{
        this.socket = this.ioWrap.run(agent_ids).socketio();
		Object.keys(this.allEvHandlers).forEach(ev_name=>{
			console.log("hanging up '"+ev_name+"' event.");
            this.allEvHandlers[ev_name].run(ev_name, this.socket);   
        });
	};
	this.tech_events = ['connect', 'disconnect', 'compareManifest', 'same_md5_agents', 'updateFiles', 'startPartner', 'killPartner', 'identifiers', 'update_folder', 'partner_leaved', 'partner_appeared'];
	this.user_events = ['diskSpace', 'gpu_info', 'housekeeping', 'proc_count', 'exec_cmd', 'nvidia_smi', 'wetransfer'];

    this.user_evt_handlers = {
        disk_space: function(){
			console.log("'disk_space' event");
			$checkDiskSpace("C:/").then((diskSpace) => {
                // { free: 12345678, size: 98756432 }
                console.log("diskSpace =",diskSpace);
                _socket.emit('disk_space', {done:true, res:diskSpace});
            }).catch((ex)=>{
                console.log("diskSpace error=",ex);
                _socket.emit('disk_space', {done:false, details:ex});
            }); 
		},
		gpu_info: function(){},
		housekeeping: function(){},
		proc_count: function(){},
		exec_cmd: function(){},
		nvidia_smi: function(){},
		wetransfer: function(){}
	}
}
//@-------Comparing the Manifest-------------
function ComparedManifest(dirStructure, dirsComparing, settings){
    this.dirStructure = dirStructure;
    this.dirsComparing = dirsComparing;
    this.curMan = [];
    this.settings = glob[settings] || {}
    this.run=(ev_name, socket)=>{
        //@ ev_name = 'compareManifest'
        socket.on(ev_name, (remote_manif)=>{
            console.log("ComparedManifest: remote_manif=",remote_manif)
            this.manifestos(remote_manif).then(local_manif=>{
                console.log("ComparedManifest: local_manif=",local_manif)
                let difference;
                try{
                    difference = this.dirsComparing.compare(local_manif, remote_manif);
                }catch(err){socket.emit({is_error: true, error: err});}
                console.log("ComparedManifest: on event: difference=",JSON.stringify(difference));
                const is_changes_exist = (difference) ? true : false;
                socket.emit(ev_name, {is_error: false, is_changes: is_changes_exist});
            }).catch(err=>{
                console.log("ComparedManifest: on event: manifestos() Error: ", err);
                socket.emit({is_error: true, error: err});
            })
        })
        return this;
    }
    this.current=()=>{return this.curMan}
    this.manifestos=(remote_manif)=>{
        //@ remote_manif = {controller:{}, other:{}}
        return new Promise((resolve, reject)=>{
            const local_dir_controller = this.settings.local_dir_controller || "../controller";
            const local_dir_other = this.settings.local_dir_other || "../other";
            const paths = [];
            Object.keys(remote_manif).forEach(in_fact_folder=>{
                let local_dir;
                if(in_fact_folder=="controller"){local_dir = local_dir_controller}
                else if(in_fact_folder=="other"){local_dir = local_dir_other}
                else if(in_fact_folder=="launcher"){local_dir = __dirname}
                paths.push({name:in_fact_folder, path: local_dir})
            });
            this.dirStructure.allMansAsync(paths).then(local_manifest=>{
                resolve(local_manifest);
            }).catch(err=>{
                reject("ComparedManifest.manifestos() Error: "+JSON.stringify(err));
            })
        });
    }
}
function DirStructure(){
    //@ returns manifest of one directory. Type Array ['f1', 'f2']
    this.manOfDirAsync=(look_dir)=>{
        return new Promise((resolve, reject)=>{
            look_dir = look_dir || "\\update";
            console.log("DirStructure.manOfDirAsync(): look_dir=",look_dir);
            walk(look_dir, look_dir, function(err, results) {
                (err) ? reject(err): resolve(results);
            });
            function walk(cur_path, root_path, cbDone){
                var results = [];
                fs.readdir(cur_path, function(err, list) {
                    if (err) return cbDone(err);
                    let cur_path_without_root = (cur_path.length > root_path.length) ? cur_path.slice(root_path.length) : "";
                    var pending = list.length;
                    if (!pending) return cbDone(null, results);
                    list.forEach(function(file) {
                        let file_path_without_root = cur_path_without_root + "\\" + file;
                        file = cur_path + "\\" + file;
                        fs.stat(file, function(err, stat) {
                            if (stat && stat.isDirectory()) {
                                walk(file, root_path, function(err, list2) {
                                    if(err) return cbDone(err);
                                    if(list2.length==0){
                                        results.push([file_path_without_root+"\\"]);
                                    }
                                    else results = results.concat(list2);
                                    if (!--pending) cbDone(null, results);
                                });
                            }else{
                                results.push([file_path_without_root,stat.size,stat.mtime]);
                                if (!--pending) cbDone(null, results);
                            }
                        });
                    });
                });
            }
        });
    }
    //@ returns manifests of a several dirs. Type object {'launcher':[], 'controller':[]}
    this.allMansAsync=(paths_data)=>{
        console.log("DirStructure.allMansAsync: paths_data=", paths_data)
        return new Promise((resolve,reject)=>{
            const result = {};
            let pending = paths_data.length;
            paths_data.forEach(path_data=>{
                this.manOfDirAsync(path_data.path).then(res=>{
                    result[path_data.name] = res;
                    if(!--pending){resolve(result)}
                }).catch(err=>{
                    console.log("DirStructure.allMansAsync() Error: ", err);
                    if(!--pending){resolve(result)}
                })
            });
            setTimeout(()=>{reject("DirStructure.allMansAsync(): timeout Error!")},5000);
        });
    }
}
function DirsComparing(){
    this.compareResult=undefined;
    this.compare=(next_mans, prev_mans)=>{
        console.log();
        const result = {};
        for(let man in next_mans){
            const comparedDirs = this.compare2Dirs(next_mans[man], prev_mans[man]);
            if(Object.keys(comparedDirs).length>0){result[man] = comparedDirs;}
        }
        return Object.keys(result).length>0 ? result : undefined;
    }
    this.compare2Dirs=(next_man, prev_man)=>{
        //@ next_man = {controller:[], launcher:[], other:[]}
        //console.log("DirsComparing.comparing(): next_man=",next_man);
        const new_files = find_new_files(next_man, prev_man);
        const files_to_change = find_files_to_change(next_man, prev_man);
        const old_files = find_old_files(next_man, prev_man);
        const answer = {}
        if(new_files.length>0) answer.new_files = new_files;
        if(files_to_change.length>0) answer.files_to_change = files_to_change;
        if(old_files.length>0) answer.old_files = old_files;
        return answer;
        //@ arrays intersection
        //@ let intersection = arrA.filter(x => arrB.includes(x));
        //@ arrays difference: Unique values of first array
        //@ let difference = arrA.filter(x => !arrB.includes(x));
        function find_new_files(next_man, prev_man){
            const FNAME=0, FSIZE=1, FDATE=2;
            return next_man.filter(n_a =>{
                let is_new_name=true;
                prev_man.forEach(p_a=>{
                    if(n_a[FNAME]==p_a[FNAME]){
                        is_new_name = false;
                    }
                });
                return is_new_name;
            });
        }
        function find_files_to_change(next_man, prev_man){
            const FNAME=0, FSIZE=1, FDATE=2;
            return next_man.filter(n_a =>{
                let is_new_name=true;
                let is_diff_size=false;
                let is_diff_date=false;
                prev_man.forEach(p_a=>{
                    if(n_a[FNAME]==p_a[FNAME]){
                        is_new_name = false;
                        if(n_a.length > 1){
                            if(n_a[FSIZE]!=p_a[FSIZE]) is_diff_size = true;
                            const ndate = convert_to_comparable_date(n_a[FDATE]);
                            const pdate = convert_to_comparable_date(p_a[FDATE]);
                            if(ndate>pdate) is_diff_date = true;
                        }
                    }
                });
                if(is_diff_size||is_diff_date){return true;}
                else{return false;}
            });
        }
        function find_old_files(next_man, prev_man){
            const FNAME=0, FSIZE=1, FDATE=2;
            return prev_man.filter(p_a =>{
                let is_old_name=true;
                next_man.forEach(n_a=>{
                    if(n_a[FNAME]==p_a[FNAME]){
                        is_old_name = false;
                    }
                });
                if(p_a.length==1){is_old_name = false}
                return is_old_name;
            });
        }
        function convert_to_comparable_date(date){
            if (typeof date == "object") return date.getTime();
            else if(typeof date == "string") return Date.parse(date);
            else{
                console.log("Converting Date to Ms ERROR: Unknown type of input date: ", date);
                return 0;
            }
        }
    }
}
//@-------Update chain----------
function KilledPartner(){
    this.run=(ev_name, socket)=>{
        socket.on(ev_name, (msg)=>{
            console.log("KilledPartner.run() pid =", msg.pid);
            //TODO: 1. cmd_exec(kill) 2. socket.emit(ok)
            this.kill_by_pid(msg.pid);
            socket.emit(ev_name, {is_killed: true});
        });
    }
    this.kill_by_pid=(pid)=>{
        try { 
            process.kill(list[i].pid);
        } catch(ex) {
            console.log("KilledPartner.kill_by_pid() Error: ", ex);
        }
    }
}
function UpdatedFiles(){
    this.run=(ev_name, socket)=>{
        socket.on(ev_name, ()=>{
            console.log("UpdatedFiles.run()...");
            socket.emit(ev_name, {is_updated: true})
        });
    }
}
function StartedPartner(){
    this.run=(ev_name, socket)=>{
        socket.on(ev_name, ()=>{
            console.log("StartedPartner.run()...");
            //TODO: 1. cmd_exec(kill) 2. socket.emit(ok)
            this.start("", (err, res)=>{
                const start_msg = {};
                if(err){ start_msg.is_error = true; start_msg.is_started = false; }
                else{ start_msg.is_started = true; }
                socket.emit(ev_name, start_msg);
            });
        });
    }
    this.start=(c_location, callback)=>{
        //TODO: CHECK IF FILE EXGST !!!
        const agent_type = "launcher";
        let partner_path = path.normalize(GS.partner.file_path);
        fs.stat(partner_path, (err)=>{
            if (err) {
                callback(err);
                return;
            }
            console.log("Starting "+agent_type+"...");
            //var CMD = spawn('cmd');
            var CMD = exec('cmd');
            var stdout = '';
            var stderr = null;
            CMD.stdout.on('data', function (data) { stdout += data.toString(); });
            CMD.stderr.on('data', function (data) {
                if (stderr === null) { stderr = data.toString(); }
                else { stderr += data.toString(); }
            });
            CMD.on('exit', function () { callback(stderr, stdout || false);  });

            //CMD.stdin.write('wmic process get ProcessId,ParentProcessId,CommandLine \n');
            CMD.stdin.write('start cmd.exe @cmd /k "cd..\\'+agent_type+' & node '+agent_type+'.js '+process.pid+' '+1+'"\r\n');
            CMD.stdin.end();
        });
    }
}
//@-------------------------------

function DiskSpace(){
    this.run=(ev_name, socket)=>{
        console.log("DiskSpace.run()...");
        socket.on(ev_name, ()=>{
			$checkDiskSpace("C:/").then((disk_space) => {
                // { free: 12345678, size: 98756432 }
                console.log("disk_space =",disk_space);
                socket.emit('diskSpace', {is_error:false, disk_space:disk_space});
            }).catch((ex)=>{
                console.log("DiskSpace.run(): $checkDiskSpace Error: ",ex);
                _socket.emit('disk_space', {is_error:true, error:ex});
            }); 
        });
    }
}

//==================================================
//==================================================

//----------PARSE NVIDIA GPU FUNCTIONS--------------
function parse_nvsmi_result(str) {
	let linesTmp = str.split(os.EOL);
	let counter = 0;
	let lines = [];
	let all_params = [];

	linesTmp.forEach(function (line) {
		if (line && line.trim()) {
			lines.push(line);
		}
	});

	let is_hat = false;

	while (counter < lines.length) {
		//console.log("COUNTER=", counter);
	
		if (is_hat) {
			counter = parse_next_cards(counter);
		}
		else {	
			if (lines[counter].indexOf('NVIDIA-SMI') > -1 ) {
				is_hat = true;
				while (lines[counter].indexOf('=======') == -1) { counter++ }
				counter = parse_first_card(counter);
			}
			else counter++;
		}
	}
	
	return all_params;

	function parse_first_card(raw_index) 
	{
	//expecting, that incoming string is: '---------'
	//console.log("parse_first_card(): income raw =", lines[raw_index]);
    let result_obj ={};
	// go to the next string after '==========='
	raw_index++;
	//read first string of params
    let vals = lines[raw_index].split(/\s+/);
	let params1 = parse_vals(vals, 1);
	Object.assign(result_obj, params1);
	//console.log("result_obj=", result_obj);
    //console.log("VALS= ", JSON.stringify(vals));
	//console.log("vals.length= ", vals.length);
    raw_index++;
	//read second string of params
    let vals2 = lines[raw_index].split(/\s+/);
	let params2 = parse_vals(vals2, 2);
	Object.assign(result_obj, params2);
	//console.log("result_obj=", result_obj);
    //console.log("VALS 2= ", JSON.stringify(vals2));
    //console.log("vals2.length= ", vals2.length);
	//expecting, that the next string will '---------'
	raw_index++;
	all_params.push(result_obj);
	//console.log("parse_first_card(): returned raw =", lines[raw_index], "INDEX:", raw_index);
    return raw_index;
	}
	
	function parse_next_cards(raw_index) 
	{
		//expecting, that incoming string is: '---------'
		//console.log("parse_next_cards(): income raw =", lines[raw_index]);
		let result_obj ={};
		// go to the next string after '---------'
		raw_index++;
		let vals = lines[raw_index].split(/\s+/);
		//console.log("VALS= ", JSON.stringify(vals));
		if (vals.length < 10) { return;}
		else {
			let params1 = parse_vals(vals, 1);
			Object.assign(result_obj, params1);
			//console.log("result_obj=", result_obj);
			raw_index++;
			let vals2 = lines[raw_index].split(/\s+/);
			let params2 = parse_vals(vals2, 2);
			Object.assign(result_obj, params2);
			//console.log("result_obj=", result_obj);
			//console.log("VALS 2= ", JSON.stringify(vals2));
			raw_index++;
			//console.log("parse_next_cards(): returned raw =", lines[raw_index], "INDEX:", raw_index);
			all_params.push(result_obj);
			return raw_index;
		}
	}
	function parse_vals(vals, order) 
	{
		//----PARSE FIRST STRING OF PARAMS-----
		if (order == 1) {
			let gpu_id, gpu_name="", bus_id;
			for (let v=0; v < vals.length; v++) {
				//console.log("v1=",v);
				if ((v >= 0)&&(v < 2)) {
					if (isNaN(Number(vals[v]))) {  }
					else { gpu_id = vals[v]; }
				}
				else if (v == 2) {
					while ( (v < vals.length)&&(vals[v] != '|') ) {
						gpu_name += vals[v] + '_';
						v++; 
					} 
				}
				else if ( (v >= 7)&&(v < 9) ) {
					if (vals[v].search(/\d+:\d+/) > -1) {
						bus_id = vals[v];
					}
				}
				//console.log("v2=",v);
			}
			return {gpu_id:gpu_id, gpu_name:gpu_name, bus_id:bus_id }
		}
		//----PARSE SECOND STRING OF PARAMS-----
		else if (order == 2) {
			let fan, temp, mem_use = "";
			
			for (let v=0; v < vals.length; v++) {
				if ((v >= 0)&&(v < 4)) {
					if (vals[v].search(/\d+%/) > -1) {
						fan = vals[v];
					}
					if (vals[v].search(/\d+C/) > -1) {
						temp = vals[v];
					}
				}
				else if (vals[v].search(/\d+MiB/) > -1) {
					mem_use += vals[v] + '/';
				}
			}
			
			return {fan:fan, temp:temp, mem_use:mem_use }
		}
		else { console.log("unknown order:", order); return; }
	}
}

//----------EXTERNAL FUNCTIONS--------------
function sync_dirs_test(){
    const loc_root = "../launcher/";
    const rem_root = "\\ita52\\TMP";
    const changes = []
}
//@ wrapping of copy_files() function with input array of full names param 
function sync_dirs(changes, mcb, loc_root, rem_root){
    //* changes = {copy_names:[[],[]], empty_dirs:[]}
    loc_root = loc_root || "../launcher/";
    rem_root = rem_root || GS.master.update_folder || SETT.update_folder;
    let err_names = [];
    let str_res;
    console.log("============= changes =", changes);
    if (changes instanceof Object){
        copy_files(loc_root, rem_root, changes.copy_names).then(res=>{ 
            //console.log("FILES COPIED: ERR FILES =", res);
            err_names = err_names.concat(res);
            //** even if emtpy folder copy will ended with error
            create_empty_dirs(loc_root, changes.empty_dirs)
            .then(res=>{ 
                //console.log("EMPTY DIRS CREATED: ERROR DIRS =", res);
                err_names = err_names.concat(res);
                str_res = (err_names.length > 0) ? "defected" : "flawless"
                mcb(err_names, str_res);
            }).catch(ex=>{ 
                console.log("ERR: sync_dirs(): create_empty_dirs():", ex); 
                str_res = (err_names.length > 0) ? "defected" : "flawless"
                mcb(err_names, str_res);
            });
        }).catch(ex=>{ 
            console.log("ERR: sync_dirs(): copy_files():", ex);
            mcb(copy_names, "useless");
        });  
    }else{
        console.log("ERR sync_dirs(): changes param is not an Object:", changes);
        mcb([], "useless");
    }
}
//@ copy files from remote to local dir including creating missing dirs if not exist
function copy_files(loc_root, rem_root, copy_names){
    return new Promise((resolve, reject) => {
        if (!Array.isArray(copy_names)){ copy_names = []; }
        let pending = copy_names.length;
        let err_names = [];
        if (pending > 0){
            copy_names.forEach((item, ind) => {
                console.log("copying from:", rem_root+item, " to:", loc_root+item);
                let loc_file = loc_root+item;
                create_dir_if_need(loc_file, (err, path_dir) => {
                    if (err) {
                        err_names.push(path_dir);
                        if (!--pending) { resolve(err_names); }
                    }else{
                        fs.copyFile(rem_root+item, loc_root+item, (err)=>{
                            if(err){
                                console.log("copy err=", err);
                                err_names.push(item);
                                if (!--pending) { resolve(err_names); }
                            }else{
                                if (!--pending) { resolve(err_names); }
                            }
                        });
                    }
                });
            });
        }
        else { resolve(err_names); }
    });
}
//* same code as in launcher.js
function create_empty_dirs(loc_root, empty_dirs) 
{
    return new Promise((resolve, reject) => {
        let pending = empty_dirs.length;
        let err_names = [];
        //console.log("__________________empty_dirs=", empty_dirs.length);
        if (empty_dirs.length > 0) {    
            empty_dirs.forEach((item, ind) => {
                let loc_dir = loc_root+item;
                fs.mkdir(loc_dir, { recursive: true }, (err) => {
                    if(err) {
                        console.log("ERR LOC DIR=", loc_dir);
                        err_names.push(loc_dir);
                        if (!--pending) { resolve(err_names); }
                    }
                    else {
                        //console.log("CREATED LOC DIR=", loc_dir);
                        if (!--pending) { resolve(err_names); }
                    }
                });
            });
        }
        else { resolve(err_names); }
    });
}

function create_dir_if_need(path_, cb)
{
    fs.stat(path_, (err, stats) => {
        if ((err)&&(err.code == "ENOENT")) {
            let file_index = path_.lastIndexOf("\\");
            let path_dir = path_.slice(0, file_index);
            //console.log("path_dir=", path_dir);
            fs.mkdir(path_dir, { recursive: true }, (err) => {
                if(err) { cb(err, path_dir) }
                else { cb(null) }
            });
        }
        else { cb(null); }

    });
}

function exec_cmd_getmac(command_)
{
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

function execute_command(command_)
{
    let command = command_ || "tasklist";
    return new Promise((resolve,reject)=>{
        var CMD = exec(command);
        var stdout = '';
        var stdoutres = '';
        var stderr = null;
        CMD.stdout.on('data', function (data) {
            //console.log('---execute_command stdout chunk:', data);
            stdout += data.toString();
        });
        CMD.stderr.on('data', function (data) {
            //console.log('---execute_command stderr chunk:', data);
            if (stderr === null) { stderr = data.toString(); }
            else { stderr += data.toString(); }
        });
        CMD.on('exit', function () {
            //console.log('---execute_command EXIT:', stdout);
            resolve(stdout);
        });
        //CMD.stdin.write('wmic process get ProcessId,ParentProcessId,CommandLine \n');
        //CMD.stdin.write(command+'\r\n');
        //CMD.stdin.end();
    });
}

// "./", "controller"
function Manifest(){
    this.curMan = [];
    this.init=(look_dir)=>{
        this.manOfDir(look_dir).then(res=>{this.curMan=res}).catch(err=>{
            console.log("Manifest.init()->manOfDIr() Error: ",err);
        });
        return this;
    }
    this.current=()=>{return this.curMan}
    this.manOfDir=(look_dir)=>{
        return new Promise((resolve, reject)=>{
            look_dir = look_dir || "..\\launcher"
            walk(look_dir, look_dir, function(err, results) {
                (err) ? reject(err): resolve(results);
            });
            function walk(cur_path, root_path, cbDone){
                var results = [];
                fs.readdir(cur_path, function(err, list) {
                    if (err) return cbDone(err);
                    let cur_path_without_root = (cur_path.length > root_path.length) ? cur_path.slice(root_path.length) : "";
                    var pending = list.length;
                    if (!pending) return cbDone(null, results);
                    list.forEach(function(file) {
                        let file_path_without_root = cur_path_without_root + "\\" + file;
                        file = cur_path + "\\" + file;
                        fs.stat(file, function(err, stat) {
                            if (stat && stat.isDirectory()) {
                                walk(file, root_path, function(err, list2) {
                                    if(err) return cbDone(err);
                                    //@ means empty directory
                                    if(list2.length==0){
                                        results.push([file_path_without_root+"\\"]);
                                    }
                                    else results = results.concat(list2);
                                    if (!--pending) cbDone(null, results);
                                });
                            }else{
                                let inner_res = [];
                                inner_res.push(file_path_without_root);
                                inner_res.push(stat.size);
                                inner_res.push(stat.mtime);
                                results.push(inner_res);
                                if (!--pending) cbDone(null, results);
                            }
                        });
                    });
                });
            }
        });
    }
}
function get_dir_manifest_ctol(look_path, except)
{
    //look_path = path.normalize(look_path);
    //if(look_path.startsWith('.')) look_path = path.resolve(look_path);
    return new Promise((resolve, reject)=>{
        //let except_2 = "node_modules";
        var walk = function(dir, root_path, except, done) {
            var results = [];
            fs.readdir(dir, function(err, list) {
                if (err) return done(err);
                let dir_path_without_root = (dir.length > root_path.length) ? dir.slice(root_path.length) : "";
                var pending = list.length;
                if (!pending) return done(null, results);
                
                list.forEach(function(file) {
                    let file_path_without_root = dir_path_without_root + "\\" + file;
                    file = dir + "\\" + file;
                    //file = path.resolve(dir, file);
                    fs.stat(file, function(err, stat) {
                        if (stat && stat.isDirectory()) {
                            let is_except = false;
                            for (let i=0; i<except.length; i++) {
                                if (file.endsWith(except[i])) {
                                    is_except = true;
                                    break;
                                }
                            }
                            if (is_except) {
                                if (!--pending) done(null, results);
                                return;
                            }
                            else {
                                walk(file, root_path, except, function(err, res) {
                                    if (res.length == 0) { 
                                        let dir_res = [];
                                        dir_res.push(file_path_without_root);
                                        dir_res.push(stat.size);
                                        dir_res.push(stat.mtime);
                                        dir_res.push('empty_dir');
                                        results.push(dir_res);
                                    }
                                    else { results = results.concat(res); }
                                    if (!--pending) done(null, results);
                                });
                            }
                        }
                        else {
                            let inner_res = [];
                            inner_res.push(file_path_without_root);
                            inner_res.push(stat.size);
                            inner_res.push(stat.mtime);
                            results.push(inner_res);
                            if (!--pending) done(null, results);
                        }
                    });
                });
            });
        };
        walk(look_path, look_path, except, function(err, results) {
            (err) ? reject(err): resolve(results);
        });
    });
}
//* sync
function compare_manifests_1rp1lp(local, remote)
{
    let copy_names = [];
    let empty_dirs = [];
    //only those files which only exist  in 'launcher' folder
    let in_launcher_folder = [];
    //1.1. Trim Big Manifest By Controller
    remote = trim_remote_except_controller_folder(remote);
    
    let local_empty_dirs = get_empty_dirs(local);
    let remote_empty_dirs = get_empty_dirs(remote);
    empty_dirs = DiffArrays(remote_empty_dirs, local_empty_dirs);
    
    in_launcher_folder = in_launcher_folder.concat(reduce_changes_to_launcher_folder(empty_dirs));
    
    local = trim_empty_dirs(local);
    remote = trim_empty_dirs(remote);

    //1.2. Extract flat Arrays with 'Names' from Arr2d
    const names = extract_flat_names(local, remote);
    //1.3. Find new Names in remote 'controller' Folder
    let diff_rl = DiffArrays(names.remote, names.local);
    copy_names = copy_names.concat(diff_rl);
    //console.log("new_remote_files =", diff_rl);

    //2. FIND DIFFER BY SIZE AND BY DATE (EXEC TIME = 0.5 ms)
    //2.1. Find Intersec by Name
    let intersec = IntersecArrays(names.local, names.remote);
    //console.log("intersec =", intersec);
    //2.2. Choose Only Intersected from 2d arrays
    local = get_intersecs_from_2d(local, intersec);
    remote = get_intersecs_from_2d(remote, intersec);
    //console.log("local =", local);
    //console.log("remote =", remote);
    //2.3. Sort both Arrays by Names
    local = local.sort(sort_by_name);
    remote = remote.sort(sort_by_name);
    //2.4. go to compare sizes or later by Date
    console.log("copy_names before=", copy_names);
    let names_diff_by_size = compare_intersec_by_size_or_date(local, remote);
    copy_names = copy_names.concat(names_diff_by_size);
    console.log("copy_names after=", copy_names);
    in_launcher_folder = in_launcher_folder.concat(reduce_changes_to_launcher_folder(copy_names));
    console.log("in_launcher_folder =", in_launcher_folder);
    //4. COPY CHANGES
    return {copy_names:copy_names, empty_dirs:empty_dirs, in_launcher_folder:in_launcher_folder};

    function get_empty_dirs(arr2d)
    {
        const NAME = 0;
        const EMPTY_DIR = 3;
        let res = [];
        for (let i in arr2d) {
            if (arr2d[i][EMPTY_DIR] == 'empty_dir') {
                res.push(arr2d[i][NAME]); 
            }
        }
        return res;
    }
    function trim_empty_dirs(arr2d)
    {
        let res = [];
        const EMPTY_DIR = 3;
        for (let i in arr2d) {
            if (arr2d[i][EMPTY_DIR] != 'empty_dir') {
                res.push(arr2d[i]);
            }
        }
        return res;
    }
    //* sync
    function trim_remote_except_controller_folder(remote){
        // const folder = './controller';
        let trim_remote = new Array();
        for (let i in remote) {
            if (remote[i][0].startsWith("\\controller\\")) {
                continue;
            } else { trim_remote.push(remote[i]); }
        }
        return trim_remote;
    }
    //* sync
    function extract_flat_names(local, remote){
        let local_names = [], remote_names = [];
        for (let i in local) {local_names.push(local[i][0]); }
        for (let i in remote) {remote_names.push(remote[i][0]); }
        return {local:local_names, remote:remote_names }
    }
    //* sync
    function get_intersecs_from_2d(arr2d, intersec){
        let result = [];
        for (let row in arr2d) {
            for (let i in intersec) {
                if (arr2d[row][0] == intersec[i]) result.push(arr2d[row]);
            }
        }
        return result;
    }
    function sort_by_name(a,b) {
        if (a[0] > b[0]) return 1;
        if (a[0] == b[0]) return 0;
        if (a[0] < b[0]) return -1;
    }
    //* sync
    function compare_intersec_by_size_or_date(loc, rem){
        //* Here we have two same-length arrays sorted by Names, so indexes are always match
        let names_diff_by_size_or_date = [];
        if (loc.length == rem.length) {
            for (let i in rem) {
                if (loc[i][1] != rem[i][1]) {
                    names_diff_by_size_or_date.push(rem[i][0]);
                } else {
                    rem[i][2] = (typeof rem[i][2] == 'string') ? (Date.parse(rem[i][2])) : (rem[i][2].getTime());
                    loc[i][2] = (typeof loc[i][2] == 'string') ? (Date.parse(loc[i][2])) : (loc[i][2].getTime());
                    //if (Date.parse(rem[i][2]) > loc[i][2].getTime()) {
                    if (rem[i][2] > loc[i][2]) {
                        names_diff_by_size_or_date.push(rem[i][0]);
                    }
                }
            }
        }
        else { console.log("ERROR1: function 'compare_intersec()': lengths are different") }
        return names_diff_by_size_or_date;
    }
    
    function reduce_changes_to_launcher_folder(copy_names){
        // const folder = './controller';
        let trim_ = [];
        for (let i in copy_names) {
            if (copy_names[i].startsWith("\\launcher\\")) {
                console.log("YES !");
                trim_.push(copy_names[i]);
            }
        }
        console.log("trim_ =", trim_);
        return trim_;
    }
}
//* sync


const GS = {
    main: function() {
        //*1) SET IO LISTENERS        
        GS.socket_io_init();
    },
    emtr: new EventEmitter(),
    wait_identifiers: function(){
        return new Promise((resolve,reject)=>{
            if(this.identifiers) resolve(this.identifiers);
            else {
                this.emtr.once("identifiers", ids=>{
                    this.identifiers = ids;
                    resolve(this.identifiers);
                });
            }
        });
    },
    prepare_identifiers: function(){
        console.log("preparing identifiers for master...");
        var attempts_counter = 0;
        const MAX_ATTEMPTS = 3;
        const ATTEMPTS_INTERVAL = 5000;
        return new Promise((resolve,reject)=>{
            const TYPE = 0, SID = 1, MD5 = 2, IP = 3, PID = 4, PPID = 5, APID = 6;
            const _identifiers = {};
            _identifiers.ag_type = "controller";
            _identifiers.md5 = "";
            _identifiers.sid = "";
            _identifiers.ip = "";
            _identifiers.pid = String(process.pid);
            _identifiers.ppid =String(process.ppid);
            console.log("GS.prepare_identifiers(): process.argv=", process.argv);
            _identifiers.apid = (isNaN(Number(process.argv[2]))) ? ("") : (String(process.argv[2]));
            if (_identifiers.apid == 0) _identifiers.apid = "";;

            get_mac((err, res) => {
              if (err) {
                return reject(err);
              }else{
                _identifiers.md5 = String(res);
                resolve(_identifiers);
              }
            })    
        });
        function get_mac(callback){
          //console.log("now in get_mac()")

          exec_cmd_getmac("getmac").then(res=>{
            res = MD5hash(res);
            console.log("Mac address has successfully received")
            callback(null, res)
          }).catch(err=>{
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

    },
    TYPE: 0, SID: 1, MD5: 2, IP: 3, PID: 4, PPID: 5, STATE: 6, TASKS: 7,
    EVS:{CONNECT: 'connect', HOUSEKEEP: 'housekeeping', DISK: 'disk_space', PROC: 'proc_count', 
         EXEC_CMD: 'exec_cmd', NVSMI: 'nvidia_smi', WETRANSFER: 'wetransfer',
        VOIDMAIN: 'void_controller', VOIDALL: 'void_all'},
    socket_io_init: function() {
        
        //* 'connect' and 'disconnect' practically not used
        socket.on('connect', function(){
            //* prepare identifiers and SEND to master!
            setTimeout(()=>{
                GS.prepare_identifiers().then(arr => {
                    GS.io_to_master({title:"identifiers", kind: "report", done: true, payload: arr});
                }).catch(ex => {
                    console.log("fail to prepare own identifiers:", ex);
                    GS.io_to_master({title:"identifiers", kind: "report", done: false, cause: ex});
                });
            }, 400);
        });
        socket.on('disconnect', function(){
            console.log("DISCONNECTED");
        });
        socket.on('identifiers', function(){});
        //* Master pass Update Directory Manifest at the begining and everytime then it changes
        socket.on('manifest', function(data){
            let {tid, jid, payload} = data;
            //console.log("manifest data Object keys=", Object.keys(data));
            if (typeof tid == 'undefined') { console.log("ERR: Master wasn't pass task ID !"); }
            if (payload) {
                GS.manifest.compare(payload).then(res_obj => {
                    console.log("res_obj=", JSON.stringify(res_obj));
                    //?e.g.: res_obj = {is_diff: true, is_touch_partner_folder: false}
                    let parcel = {kind: "report", done: true, title: 'manifest', answer: res_obj, tid: tid, jid: jid};
                    GS.io_to_master(parcel);
                }).catch(ex=>{ 
                    console.log("ERR:",ex); 
                    let parcel = {kind: "report", done: false, title: 'manifest', cause: ex, tid: tid, jid: jid};
                    GS.io_to_master(parcel);
                });
            } else { 
                let err_msg = "ERR: 'manifest' event: no manifest !";
                console.log(err_msg); 
                let parcel = {kind: "report", done: false, title: 'manifest', cause: err_msg, tid: tid, jid: jid};
                GS.io_to_master(parcel);
            }
        });
        socket.on('partner_leaved', function(data){
            //- data = <Array> state_agent || <String> sid
            console.log("<<<EVENT: partner_leaved, data:", data);
            GS.partner.is_partner_under_update = false;
            (GS.partner.count > 0) ? (GS.partner.count--) : (GS.partner.count = 0);
            if (Array.isArray(data.payload)) {
                GS.partner.list = GS.partner.list.filter(el=>{return el.sid != data.payload[GS.SID]})
            }
            else if (typeof data.payload == 'string') {
                GS.partner.list = GS.partner.list.filter(el=>{return el.sid != data.payload})
            }
        });
        socket.on('partner_appeared', function(data){
            //- data.payload = <Array> state_agent || <String> sid
            console.log("<<<EVENT: partner_appeared, data:", data);
            GS.partner.is_partner_under_update = false;
            GS.partner.count++;
            if (Array.isArray(data.payload)) {
                GS.partner.list.push({
                    sid: data.payload[GS.SID],
                    pid: data.payload[GS.PID],
                    ppid: data.payload[GS.PPID],
                    apid: data.payload[GS.APID],
                });
            }
        });
        //* After Launcher has send "identifiers" to Master, Master pass "same Pids" guys
        socket.on('same_md5_agents', function(data){ 
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            if (payload) {
                let partners_count = GS.partner.save_identifiers(payload);
                let is_partner_exist = (partners_count > 0) ? true : false;

                let parcel = {kind: "report", done: true, title: "same_md5_agents", answer: is_partner_exist, tid: tid, id: jid};
                GS.io_to_master(parcel);
            } else { 
                let err_msg = "ERR: 'same_md5_agents' socket event: no payload !";
                console.log(err_msg);
                let parcel = {kind: "report", done: false, title: "same_md5_agents", cause: err_msg, tid: tid, id: jid};
                GS.io_to_master(parcel); 
            }
            
        });
        socket.on('sync_dirs', function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log("<<EVENT sync_dirs !");
            
            sync_dirs(GS.manifest.diff, (errlist, str_res) => {
                let parcel;
                if (str_res == 'useless') 
                {
                    parcel = {kind: "report", done: false, title: "sync_dirs", cause: "agent has no local changes", tid: tid, jid: jid};
                }
                else if (errlist.length > 0) 
                {
                    console.log("ERR: fail to sync dirs:", errlist.length);
                    parcel = {kind: "report", done: false, title: "sync_dirs", cause: errlist, tid: tid, jid: jid};
                }
                else 
                {
                    console.log("sync dirs:", str_res);
                    parcel = {kind: "report", done: true, title: "sync_dirs", answer: str_res, tid: tid, jid: jid};
                }
                GS.io_to_master(parcel);
            });
        });
        socket.on('start_agent', function(data){ 
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log("<< start_agent EVENT !");
            GS.partner.start("", (err, res) => {
                if (err) {
                    console.log("ERR: fail to start_agent:", err);
                    let parcel = {kind: "report", done: false, title: "start_agent", cause: err, tid: tid, jid: jid};
                    GS.io_to_master(parcel);
                }
                else {
					GS.partner.is_under_update = false;
                    let parcel = {kind: "report", done: true, title: "start_agent", answer: "ok", tid: tid, jid: jid};
                    GS.io_to_master(parcel);
                }
            });
        });  
        socket.on('kill_agent', function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log("<< kill_agent EVENT !");
            GS.partner.kill(GS.partner.list, (list) => {
                GS.partner.list = [];
                GS.partner.is_under_update = true;
                //* answer = [<count of killed pids>, <count of killed ppids>]
                let parcel = {kind: "report", done: true, title: "kill_agent", answer: list, tid: tid, jid: jid};
                GS.io_to_master(parcel);
            });
        });
        socket.on('update_folder', function(update_folder){
            GS.master.set_update_folder(update_folder);
        });
        socket.on(GS.EVS.HOUSEKEEP, function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            let parcel = {kind: "report", done: true, title: GS.EVS.HOUSEKEEP, answer: "ready", tid: tid, jid: jid};
            GS.io_to_master(parcel);
        });
        socket.on(GS.EVS.DISK, function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log("socket 'disk_space' event: data=", tid, jid, payload);
            // On Windows
            //* payload = "C:";
            if(typeof payload != 'string')
            {
                payload = 'C:';
            }
            if (payload.endsWith(":")) {payload += "/"}
            checkDiskSpace(payload).then((diskSpace) => {
                // { free: 12345678, size: 98756432 }
                console.log("diskSpace =",diskSpace);
                let parcel = {kind: "report", done: true, title: GS.EVS.DISK, answer: diskSpace.free, tid: tid, jid: jid};
                GS.io_to_master(parcel);
            }).catch((ex)=>{
                let parcel = {kind: "report", done: false, title: GS.EVS.DISK, cause: ex, tid: tid, jid: jid};
                GS.io_to_master(parcel);
            }); 
        });
        socket.on(GS.EVS.PROC, function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log("socket 'proc_count' event:", tid, jid, payload);
            if (typeof payload == "object") 
            {
                let process = payload.process;
                    find_process_by_name(process).then(res=>{
                        let parcel = {kind: "report", done: true, title: GS.EVS.PROC, answer: res, tid: tid, jid: jid};
                        GS.io_to_master(parcel);
                    }).catch(ex=>{
                        let parcel = {kind: "report", done: false, title: GS.EVS.PROC, cause: ex, tid: tid, jid: jid};
                        GS.io_to_master(parcel);
                    });

            } else {console.log("ERR: eng: socket 'data' property must be an Object!")}
            
            
        });
        socket.on(GS.EVS.EXEC_CMD, function(data){

            console.log('>>>>>>>arbitrary_cmd:', data);
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log("socket 'exec_cmd' event: data=", tid, jid, payload);
            let command;
            if (typeof payload == 'object')
            {
                command = payload.command;
            }
            else if (typeof payload == 'string')
            {
                command = payload;
            }
            execute_command(command).then(res=>{
                // res = [] || [{pid, ppid, command, argument}, {...}]
                let parcel = {kind: "report", done: true, answer: res, title: "exec_cmd", tid: tid, jid: jid};
                GS.io_to_master(parcel);
            }).catch(ex=>{
                console.log("ERR: exec_cmd event: fail to execute_command !");
                let parcel = {kind: "report", done: false, cause: ex, title: "exec_cmd", tid: tid, jid: jid};
                GS.io_to_master(parcel);
            });
        });
        socket.on(GS.EVS.NVSMI, function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log("socket 'nvidia_smi' event: data=", tid, jid, payload);
            const NVIDIA_PATH = '"C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe"';
            execute_command(NVIDIA_PATH + '\r\n').then(res=>{
                // res = [] || [{pid, ppid, command, argument}, {...}]
                let nvidia_info = parse_nvsmi_result(res);
                let parcel = {kind: "report", done: true, title: GS.EVS.NVSMI, answer: nvidia_info, tid: tid, jid: jid};
                GS.io_to_master(parcel);
            }).catch(ex=>{
                console.log("ERR: NVSMI: fail to execute_command !");
                let parcel = {kind: "report", done: false, title: GS.EVS.NVSMI, cause: ex, tid: tid, jid: jid};
                GS.io_to_master(parcel);
            });           
        });
        socket.on(GS.EVS.WETRANSFER, function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            Selenium.example(payload).then(res=>{
                console.log("SELENIUM RESULT =",res);
                let parcel = {kind: "report", done: true, title: GS.EVS.WETRANSFER, answer: res, tid: tid, jid: jid};
                GS.io_to_master(parcel);
            }).catch(ex=>{console.log("EX=",ex)});
        });
        socket.on(GS.EVS.VOIDMAIN, function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log(GS.EVS.VOIDMAIN, "event, params:", tid, jid, payload);
            GS.io_to_master({kind: "report", done: true, title: GS.EVS.VOIDMAIN, answer: true, tid: tid, jid: jid});
        });
		socket.on(GS.EVS.VOIDALL, function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log(GS.EVS.VOIDALL, "event, params:", tid, jid, payload);
            GS.io_to_master({kind: "report", done: true, title: GS.EVS.VOIDALL, answer: true, tid: tid, jid: jid});
        });
        socket.on('gpu_info', function(data){
            console.log("'gpu_info' event, params:", data);
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            GS.io_to_master({kind: "report", done: true, title: 'gpu_info', answer: 'gpu test ok', tid: tid, jid: jid});
        });
		socket.on('check_same_md5', function(data){
			// data = {tid:'tid', payload:{par1:'', par2:''}} || ...payload:{single_data:[]} || ...single_data:''
            let {tid, jid, payload} = GS.extract_socketio_data(data);

			const PARTNER = 'launcher';
            let res = {partners_count:0,
                is_partner_under_update: GS.partner.is_under_update, 
                is_partner_exist:false};

            if (Array.isArray(payload)) {
                // [[GS.TYPE, GS.MD5, GS.SID, GS.IP, GS.PID, GS.PPID, GS.APID], [...], [...]]
                payload.forEach(agent_arr=>{
                    if (agent_arr[GS.TYPE] == PARTNER) {
                        //- add current partners pids and ppids to local list
                        GS.partner.list.push({
                            pid: agent_arr[GS.PID],
                            ppid: agent_arr[GS.PPID],
                            apid: agent_arr[GS.APID],
                        });
                        //- flag true, if at least one partner is present
                        res.is_partner_exist = true;
                        res.partners_count++;
                    }
                });						
            }
            GS.io_to_master({kind: "report", done: true, title: "check_same_md5", answer: res, tid: tid, jid: jid});
        });
    },
    extract_socketio_data: function(data){
        let res = {};
        if(typeof data == 'object') {
            res.tid = data.tid;
            res.jid = data.jid;
            res.payload = data.payload;
        }
        return res;
    },
    io_to_master: function(data){
        //* {kind: "", title: "", done: Boolean, data: Any}
        if(!data){ return console.log("io_to_master(): no data!") }
            //* NOTE: IN Controller Code 'data.from' will be equal to "controller"
        data.from = "controller";
        console.log(">>> '" + data.kind + "' to master:" + data.title);
        //* POSSIBLE OUTBOX EVENTS: 
        //* "manifest", "same_md5_agents", "update_agent", "sync_dirs", "kill_agent", "start_agent", GS.EVS.HOUSEKEEP, GS.EVS.DISK, GS.EVS.PROC, GS.EVS.EXEC_CMD, GS.EVS.NVSMI
        socket.emit(data.kind, data);
    },
    manifest: {
        local: null,
        remote: null,
        diff: {},
        compare: function(manifest) {
            if (typeof manifest == "string") { manifest = JSON.parse(manifest); }
            //console.log("manifest.compare(): typeof manifest:", typeof manifest);
            return new Promise((resolve, reject)=>{
                if(manifest.length > 0) console.log("got remote manifest:",manifest[0]+"...");
                //? resolve(false) - means that remote directory was empty
                else { resolve({is_diff:false}); return; }
                this.remote = manifest;
                //* get local files tree to compare with remote
                get_dir_manifest_ctol(GS.partner.folder, except=["controller"])
                .then(loc_manif => {
                    this.local = JSON.parse(JSON.stringify(loc_manif));

                    if ((this.remote) && (this.local)) {
                        //console.log("comparing manifests...");
                        //*this func() will call GS.ready_to_sync_dirs(copy_names)
                        let changes = compare_manifests_1rp1lp(this.local, this.remote);
                        let touch_partner_folder = false;
                        if((changes.copy_names.length > 0)||(changes.empty_dirs.length > 0)) {
                            console.log("COPY NAMES =", changes.copy_names);
                            console.log("EMPTY DIRS =", changes.empty_dirs);
                            GS.manifest.diff = changes;
                            if (changes.in_launcher_folder.length > 0) {
                                touch_partner_folder = true;
                            }
                            resolve({is_diff:true, is_touch_partner_folder:touch_partner_folder});
                        } else {
                            console.log("remote and local manifests are Match! Nothing to sync...");
                            resolve({is_diff:false, is_touch_partner_folder:touch_partner_folder});
                        }
                    }
                }).catch(ex => { reject("fail to get Local manifest: " + ex); });
            });
        }
    },
    partner: {
        count: 0,
        list:[], //{sid,pid, ppid, apid}
        is_started: false,
		is_under_update: false,
        file_name: 'launcher.js',
        folder: '../',
        file_path: '../launcher/launcher.js',
        save_identifiers: function(identifiers){
            //identifiers = [[],[]]; 
			//?next string need if master sent data with applying JSON.stringify()
            if(typeof identifiers == "string") { identifiers = JSON.parse(identifiers); }
            console.log("partner PIDS from master:", identifiers);
            if (typeof GS.partner.list == 'undefined') GS.partner.list = [];
            for (let i in identifiers) {
                //* check if Master give exactly only this MD5 =)
                if (identifiers[i][GS.MD5] == GS.identifiers[GS.MD5]) {
                    //* If it's not himself
                    if(identifiers[i][GS.SID] != GS.identifiers[GS.SID]) {
                        //* And not same type
                        if(identifiers[i][GS.TYPE] != GS.identifiers[GS.TYPE]) {
							GS.partner.list.push({
								pid: identifiers[i][GS.PID],
								ppid: identifiers[i][GS.PPID],
								apid: identifiers[i][GS.APID],
							});
                        }
                    }
                }
            }
            return this.list.length;
        },

        get_pids: function() {
            return new Promise((resolve, reject)=>{
                let pids = {};
                if (this.pid && this.ppid) resolve ({pid: this.pid, ppid: this.ppid});
                else {
                    GS.emtr.once("wait_contragent_ids", ids=>{
                        //* ids = []
                        if ((Array.isArray(ids))&&(ids.length > 0)){
                            resolve({pid: ids[0][GS.PID], ppid: ids[0][GS.PPID]});
                        } else { resolve({}); }
                    });
                    GS.io_to_master({kind: "request_info", titles: ["same_md5_agents"], from: "launcher", own_ids: GS.identifiers});
                    setTimeout(()=>{ resolve({}); }, 1000);
                }
            });
        },
        start: function(c_location, callback) {
            //TODO: CHECK IF FILE EXIST !!!
            let partner_path = path.normalize(GS.partner.file_path);
            fs.stat(partner_path, (err)=>{
                if (err) {
                    callback(err);
                    return;
                }
                console.log("Starting Launcher...");
                //var CMD = spawn('cmd');
                var CMD = exec('cmd');
                var stdout = '';
                var stderr = null;
                CMD.stdout.on('data', function (data) { stdout += data.toString(); });
                CMD.stderr.on('data', function (data) {
                    if (stderr === null) { stderr = data.toString(); }
                    else { stderr += data.toString(); }
                });
                CMD.on('exit', function () { callback(stderr, stdout || false);  });

                //CMD.stdin.write('wmic process get ProcessId,ParentProcessId,CommandLine \n');
                CMD.stdin.write('start cmd.exe @cmd /k "cd..\\launcher & node launcher.js '+process.pid+' '+1+'"\r\n');
                CMD.stdin.end();
            });
        },
        kill: function(list, callback) {
            let pending = list.length * 2;
            let err_pids = [];
            for (let i in list) 
            {
                if (list[i].pid) 
                {
                    console.log("Dropping Launcher Node process:", list[i].pid);
                    try { 
                        process.kill(list[i].pid);
                        if (!--pending) {callback(err_pids);}
                    }
                    catch(e) {
                        err_pids.push(list[i].pid);
                        console.log("Fail to kill Launcher Node process:", e.msg) 
                        if (!--pending) {callback(err_pids);}
                    }
                } 
                else { console.log("GS.partner.kill(): no PID(node.exe), nothing to kill..."); }

                if (list[i].ppid) 
                {
                    console.log("Dropping Launcher CMD process:", list[i].ppid);
                    try { process.kill(list[i].ppid);
                        if (!--pending) {callback(err_pids);}
                    }
                    catch(e) {
                        err_pids.push(list[i].ppid);
                        console.log("Fail to kill Launcher Node process:", e.msg) 
                        if (!--pending) {callback(err_pids);}
                    }
                } 
                else { console.log("GS.partner.kill(): no PPID(cmd.exe), nothing to kill..."); }
            }
            list = [];
        },
    },
    master: {
        update_folder: false,
        set_update_folder: function(update_folder){
            this.update_folder = update_folder;
        },
    },
}

//--------------------
// PS-NODE
//--------------------

// A simple pid lookup
function lookup_process_by_pid(pid) 
{
	return new Promise( (resolve, reject) => {
		
		ps.lookup({ pid: pid }, function(err, resultList ) {
			if (err) {
				reject(err);
				//throw new Error( err );
			}
 
			var process = resultList[ 0 ];
 
			if( process ){
				resolve (process);
				//console.log( 'PID: %s, COMMAND: %s, ARGUMENTS: %s', process.pid, process.command, process.arguments );
			}
			else { resolve ('No such process found!'); }
		});
	});
}

function kill_process_by_pid(pid)
{
	return new Promise( (resolve, reject) => {
		ps.kill( pid, function( err ) {
			if (err) {
				reject(err);
				//throw new Error( err );
			}
			else {
				resolve({pid: pid, done:true});
			}
		});
	});
}

function find_process_by_name(cname)
{
	return new Promise( (resolve, reject) => {
		//const prcs = [];
		ps.lookup({	command: cname, psargs: 'ux'}, 
            function(err, resultList ) {
                if (err) reject(err);
                else resolve(resultList);			
		});
	});
}

//--------------------
// UTIL FUNCTIONS
//--------------------

function DiffArrays(A,B)
{
    var M = A.length, N = B.length, c = 0, C = [];
    for (var i = 0; i < M; i++)
     { var j = 0, k = 0;
       while (B[j] !== A[ i ] && j < N) j++;
       while (C[k] !== A[ i ] && k < c) k++;
       if (j == N && k == c) C[c++] = A[ i ];
     }
   return C;
}

function IntersecArrays(A,B)
{
    var m = A.length, n = B.length, c = 0, C = [];
    for (var i = 0; i < m; i++)
     { var j = 0, k = 0;
       while (B[j] !== A[ i ] && j < n) j++;
       while (C[k] !== A[ i ] && k < c) k++;
       if (j != n && k == c) C[c++] = A[ i ];
     }
   return C;
}


function crc32(r)
{
    for(var a,o=[],c=0;c<256;c++){
        a=c;
        for(var f=0;f<8;f++)a=1&a?3988292384^a>>>1:a>>>1;o[c]=a
    }
    for(var n=-1,t=0;t<r.length;t++)n=n>>>8^o[255&(n^r.charCodeAt(t))];
    return ((-1^n)>>>0).toString(16).toUpperCase();
}

function MD5hash(d)
{
    d = d.toString(16);
    result = M(V(Y(X(d), 8 * d.length)));
    return result.toLowerCase()

    function M(d) {
        for (var _, m = "0123456789ABCDEF", f = "", r = 0; r < d.length; r++) _ = d.charCodeAt(r), f += m.charAt(_ >>> 4 & 15) + m.charAt(15 & _);
        return f
    }

    function X(d) {
        for (var _ = Array(d.length >> 2), m = 0; m < _.length; m++) _[m] = 0;
        for (m = 0; m < 8 * d.length; m += 8) _[m >> 5] |= (255 & d.charCodeAt(m / 8)) << m % 32;
        return _
    }

    function V(d) {
        for (var _ = "", m = 0; m < 32 * d.length; m += 8) _ += String.fromCharCode(d[m >> 5] >>> m % 32 & 255);
        return _
    }

    function Y(d, _) {
        d[_ >> 5] |= 128 << _ % 32, d[14 + (_ + 64 >>> 9 << 4)] = _;
        for (var m = 1732584193, f = -271733879, r = -1732584194, i = 271733878, n = 0; n < d.length; n += 16) {
            var h = m,
                t = f,
                g = r,
                e = i;
            f = md5_ii(f = md5_ii(f = md5_ii(f = md5_ii(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_hh(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_gg(f = md5_ff(f = md5_ff(f = md5_ff(f = md5_ff(f, r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 0], 7, -680876936), f, r, d[n + 1], 12, -389564586), m, f, d[n + 2], 17, 606105819), i, m, d[n + 3], 22, -1044525330), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 4], 7, -176418897), f, r, d[n + 5], 12, 1200080426), m, f, d[n + 6], 17, -1473231341), i, m, d[n + 7], 22, -45705983), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 8], 7, 1770035416), f, r, d[n + 9], 12, -1958414417), m, f, d[n + 10], 17, -42063), i, m, d[n + 11], 22, -1990404162), r = md5_ff(r, i = md5_ff(i, m = md5_ff(m, f, r, i, d[n + 12], 7, 1804603682), f, r, d[n + 13], 12, -40341101), m, f, d[n + 14], 17, -1502002290), i, m, d[n + 15], 22, 1236535329), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 1], 5, -165796510), f, r, d[n + 6], 9, -1069501632), m, f, d[n + 11], 14, 643717713), i, m, d[n + 0], 20, -373897302), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 5], 5, -701558691), f, r, d[n + 10], 9, 38016083), m, f, d[n + 15], 14, -660478335), i, m, d[n + 4], 20, -405537848), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 9], 5, 568446438), f, r, d[n + 14], 9, -1019803690), m, f, d[n + 3], 14, -187363961), i, m, d[n + 8], 20, 1163531501), r = md5_gg(r, i = md5_gg(i, m = md5_gg(m, f, r, i, d[n + 13], 5, -1444681467), f, r, d[n + 2], 9, -51403784), m, f, d[n + 7], 14, 1735328473), i, m, d[n + 12], 20, -1926607734), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 5], 4, -378558), f, r, d[n + 8], 11, -2022574463), m, f, d[n + 11], 16, 1839030562), i, m, d[n + 14], 23, -35309556), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 1], 4, -1530992060), f, r, d[n + 4], 11, 1272893353), m, f, d[n + 7], 16, -155497632), i, m, d[n + 10], 23, -1094730640), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 13], 4, 681279174), f, r, d[n + 0], 11, -358537222), m, f, d[n + 3], 16, -722521979), i, m, d[n + 6], 23, 76029189), r = md5_hh(r, i = md5_hh(i, m = md5_hh(m, f, r, i, d[n + 9], 4, -640364487), f, r, d[n + 12], 11, -421815835), m, f, d[n + 15], 16, 530742520), i, m, d[n + 2], 23, -995338651), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 0], 6, -198630844), f, r, d[n + 7], 10, 1126891415), m, f, d[n + 14], 15, -1416354905), i, m, d[n + 5], 21, -57434055), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 12], 6, 1700485571), f, r, d[n + 3], 10, -1894986606), m, f, d[n + 10], 15, -1051523), i, m, d[n + 1], 21, -2054922799), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 8], 6, 1873313359), f, r, d[n + 15], 10, -30611744), m, f, d[n + 6], 15, -1560198380), i, m, d[n + 13], 21, 1309151649), r = md5_ii(r, i = md5_ii(i, m = md5_ii(m, f, r, i, d[n + 4], 6, -145523070), f, r, d[n + 11], 10, -1120210379), m, f, d[n + 2], 15, 718787259), i, m, d[n + 9], 21, -343485551), m = safe_add(m, h), f = safe_add(f, t), r = safe_add(r, g), i = safe_add(i, e)
        }
        return Array(m, f, r, i)
    }

    function md5_cmn(d, _, m, f, r, i) {
        return safe_add(bit_rol(safe_add(safe_add(_, d), safe_add(f, i)), r), m)
    }

    function md5_ff(d, _, m, f, r, i, n) {
        return md5_cmn(_ & m | ~_ & f, d, _, r, i, n)
    }

    function md5_gg(d, _, m, f, r, i, n) {
        return md5_cmn(_ & f | m & ~f, d, _, r, i, n)
    }

    function md5_hh(d, _, m, f, r, i, n) {
        return md5_cmn(_ ^ m ^ f, d, _, r, i, n)
    }

    function md5_ii(d, _, m, f, r, i, n) {
        return md5_cmn(m ^ (_ | ~f), d, _, r, i, n)
    }

    function safe_add(d, _) {
        var m = (65535 & d) + (65535 & _);
        return (d >> 16) + (_ >> 16) + (m >> 16) << 16 | 65535 & m
    }

    function bit_rol(d, _) {
        return d << _ | d >>> 32 - _
    }
}

function retranslateEmitter(obj){
    if (obj != undefined) {
        let em = obj.emit;
        obj.emit = function(event/*arg2, arg3, ..*/){
            console.log("obj emit:: ",event);
            em.apply(obj, arguments);
        };
    }
}

