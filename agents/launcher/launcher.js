//launcher.js ('shems/shems_1.js' example)
'use sctrict';
// requires
const fs = require('fs');
const path = require('path');
const os = require('os');
const {spawn, exec} = require('child_process');
const EventEmitter = require('events');

const sett_path = __dirname+"/../c_settings.json";
console.log("sett_path = ", path.normalize(sett_path));
const SETT	= read_settings(path.normalize(sett_path));
//const socket = require('socket.io-client')(SETT.client_socket);
const io = require('socket.io-client');
var socket;


//main();

function main(){
    const controller_channel = require('../controller/controller.js');
    
    if(controller_channel.emit){
        //console.log("controller_channel emit = "+controller_channel.emit);
        controller_channel.on('online',(p1)=>{
            console.log("ControllerChannel say: "+p1);
        })
        controller_channel.emit('is_online')
    }
    else{console.log("ControllerChannel = "+controller_channel);}
}

// Launcher global Structure
const GS = {
    main: function() {
        //*1) SET IO LGSTENERS
        console.log("GS.main()");
        GS.socket_io_init();   
    },
    emtr: new EventEmitter(),
    identifiers: false,
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
    prepare_identifiers: function()
    {
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

        function get_mac(callback)
        {
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
    TYPE: 0, SID: 1, MD5: 2, IP: 3, PID: 4, PPID: 5, APID: 6, TASKS: 7,
    socket_io_init: function() {
        //? 'connect' and 'disconnect' practically not used
        socket = io(SETT.client_socket).on('connect', function(){
            console.log("connected to master !");
            //socket.emit("test", true);
            //* prepare identifiers and SEND to master!
            setTimeout(()=>{
                GS.prepare_identifiers().then(arr => {
                    GS.io_to_master({title:"identifiers", kind: "report", done: true, payload: arr});
                    setTimeout(()=>{
                        GS.partner.start(undefined, (err,res)=>{
                            if(err)console.log("Err",err);
                            else console.log("Res",res);
                        });
                    }, 2000);
                }).catch(ex => {
                    console.log("fail to prepare own identifiers:", ex);
                    GS.io_to_master({title:"identifiers", kind: "report", done: false, cause: ex});
                });
            }, 300);
        });
        socket.on('disconnect', function(){
            console.log("DISCONNECTED");
        });
        socket.on('identifiers', function(){});
        //? Master pass Update Directory Manifest at the begining and everytime when it changes
        socket.on('manifest', function(data){ 
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            //console.log("manifest data Object keys=", Object.keys(data));
            if (typeof tid == 'undefined') { console.log("ERR: Master wasn't pass task ID !"); }
            if (payload) {
                GS.manifest.compare(payload).then(obj_bool => {
                    console.log("res_obj=", JSON.stringify(obj_bool));
                    //?e.g.: res_obj = {is_diff: true, is_touch_partner_folder: false}
                    let parcel = {kind: "report", done: true, title: 'manifest', answer: obj_bool, tid: tid, jid: jid};
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
        //? After Launcher has send "identifiers" to Master, Master pass "same Pids" guys
        socket.on('same_md5_agents', function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log("same_md5_agents data Object keys=", Object.keys(data));
            if (typeof tid == 'undefined') { console.log("WARN: Master wasn't pass task ID !"); }
            if (payload) {
                let partners_count = GS.partner.save_identifiers(payload);
                let is_partner_exist = (partners_count > 0) ? true : false;

                let parcel = {kind: "report", done: true, title: "same_md5_agents", answer: is_partner_exist, tid: data.tid};
                GS.io_to_master(parcel);
            } else { 
                let err_msg = "ERR: 'same_md5_agents' socket event: no payload !";
                console.log(err_msg);
                let parcel = {kind: "report", done: false, title: "same_md5_agents", cause: err_msg, tid: data.tid};
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
        socket.on('sync_dirs', function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log("<<EVENT sync_dirs !");
            sync_dirs(GS.manifest.diff, (errlist, str_res) => {
                if (errlist.length > 0) {
                    console.log("ERR: fail to sync dirs:", errlist.length);
                    let parcel = {kind: "report", done: false, title: "sync_dirs", cause: errlist, tid: tid, jid: jid};
                    GS.io_to_master(parcel);
                }
                else {
                    console.log("sync dirs:", str_res);
                    let parcel = {kind: "report", done: true, title: "sync_dirs", answer: str_res, tid: tid, jid: jid};
                    GS.io_to_master(parcel);
                }
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
            console.log("<< kill_agent EVENT ! data=", data);
            GS.partner.kill(GS.partner.list, (res) => {
                GS.partner.list = [];
                GS.partner.is_under_update = true;

                //* answer = [<count of killed pids>, <count of killed ppids>]
                let parcel = {kind: "report", done: true, title: "kill_agent", answer: res, tid: tid, jid: jid};
                GS.io_to_master(parcel);
            });
        });
        //* just in case! If launcher can't load settings file - then Master pass update folder
        socket.on('update_folder', function(update_folder){
            GS.master.set_update_folder(update_folder);
        });
		socket.on('void_all', function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log("'void_all' event, params:", tid, jid, payload);
            GS.io_to_master({kind: "report", done: true, title: "void_all", answer: true, tid: tid, jid: jid});
        });
		socket.on('void_launcher', function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log("'void_launcher' event, params:", tid, jid, payload);
            GS.io_to_master({kind: "report", done: true, title: "void_launcher", answer: true, tid: tid, jid: jid});
        });
		//check_same_md5
		socket.on('check_same_md5', function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);

			const PARTNER = 'controller';
            let res = {partners_count:0,
                is_partner_under_update: GS.partner.is_under_update, 
                is_partner_exist:false};

            //payload = same_md5 array [[GS.TYPE, GS.MD5, GS.SID, GS.IP, GS.PID, GS.PPID, GS.APID], [...], [...]]
            if (Array.isArray(payload)) {
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
                        //- count of partners
                        res.partners_count++;
                    }
                });						
            }
            GS.io_to_master({kind: "report", done: true, title: "check_same_md5", answer: res, tid: tid, jid: jid});
        });
		
		socket.on('arbitrary_cmd', function(data){
            let {tid, jid, payload} = GS.extract_socketio_data(data);
            console.log("socket 'exec_cmd' event: data=", tid, jid, payload);
            let {command, agent} = payload;
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

        socket.on('exec_cmd', function(data){
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
        if(data){
            //* NOTE: IN Controller Code 'data.from' will be equal to "controller"
            if(!data.from) {data.from = "launcher"}
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
    },
    manifest: {
        local: null,
        remote: null,
        diff: null,
                
        compare: function(manifest) {
            //? it was stringified with JSON.stringify(Array)
            if (typeof manifest == "string") { manifest = JSON.parse(manifest); }
            return new Promise((resolve, reject)=>{
                if(manifest.length > 0) console.log("got remote manifest:",manifest[0]+"...");
                //? resolve(false) - means that remote directory was empty
                else { resolve({is_diff:false}); return; }
                this.remote = manifest;
                //* get local files tree to compare with remote
                get_dir_manifest(GS.partner.folder, prefix="controller")
                .then(loc_manif => {
                    //this.local = loc_manif;
                    this.local = JSON.stringify(loc_manif);
                    this.local = JSON.parse(this.local);
                    
                    console.log("LOCAL MANIFEST=", this.local);
                    console.log("REMOTE MANIFEST=", this.remote);
                    console.log("typeof LOCAL 2=", typeof this.local[0][2]);
                    console.log("typeof REMOTE 2=", typeof this.remote[0][2]);
                    
                    if ((this.remote) && (this.local)) {
                        console.log("comparing manifests...");
                        //*this func() will call GS.ready_to_sync_dirs(copy_names)
                        let changes = compare_manifests_1rp1lp(this.local, this.remote);
                        if((changes.copy_names.length > 0)||(changes.empty_dirs.length > 0)) {
                            GS.manifest.diff = changes;
                            //is_touch_partner_folder Always is True, because Launcher only look for Updates in Controller folder
                            resolve({is_diff:true});
                        } else {
                            console.log("remote and local manifests are Match! Nothing to sync...");
                            resolve({is_diff:false});
                        }
                    }
                }).catch(ex => { reject("fail to get Local manifest: " + ex); });
            });
        }
    },
    partner: {
        count: 0,
		list:[], // list of {sid, pid, ppid, apid}
        is_started: false,
		is_under_update: false,
        file_name: 'controller.js',
        folder: '../controller',
        file_path: '../controller/controller.js',
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
            //TODO: CHECK IF FILE EXGST !!!
            let partner_path = path.normalize(GS.partner.file_path);
            fs.stat(partner_path, (err)=>{
                if (err) {
                    callback(err);
                    return;
                }
                console.log("Starting Controller...");
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
                CMD.stdin.write('start cmd.exe @cmd /k "cd..\\controller & node controller.js '+process.pid+' '+1+'"\r\n');
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
                    console.log("Dropping Controller Node process:", list[i].pid);
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
                    console.log("Dropping Controller CMD process:", list[i].ppid);
                    try { process.kill(list[i].ppid);
                        if (!--pending) {callback(err_pids);}
                    }
                    catch(e) {
                        err_pids.push(list[i].ppid);
                        console.log("Fail to kill Launcher Node process:", e.msg);
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

//==================================================
//==================================================
GS.main();
//==================================================
//==================================================



//------------------------------------------
//----------EXTERNAL FUNCTIONS--------------
//------------------------------------------
//* same code as in controller.js
function sync_dirs(changes, mcb)
{
    //* changes = {copy_names:[[],[]], empty_dirs:[]}
    let loc_root = "..";
    let rem_root = GS.master.update_folder || SETT.update_folder;
    console.log("LOC ROOT=", loc_root);
    console.log("REM ROOT=", rem_root);

    let err_names = [];
    //** independently we trying to copy files    
    copy_files(loc_root, rem_root, changes.copy_names)
    .then(res=>{ 
        console.log("FILES COPIED: ERR FILES =", res);
        err_names = err_names.concat(res);
        //** even if emtpy folder copy will ended with error
        create_empty_dirs(loc_root, changes.empty_dirs)
        .then(res=>{ 
            console.log("EMPTY DIRS CREATED: ERR DIRS =", res);
            err_names = err_names.concat(res);
            mcb(err_names, "sync_dirs OK!");
        }).catch(ex=>{ 
            console.log("ERR: sync_dirs(): create_empty_dirs():", ex); 
            mcb(err_names, "fail to create empty dirs");
        });
    }).catch(ex=>{ 
        console.log("ERR: sync_dirs(): create_empty_dirs():", ex);
        mcb(err_names, "fail to copy files");
    });
    
}
//* same code as in controller.js
function copy_files(loc_root, rem_root, copy_names)
{
    console.log("COPY NAMES =", copy_names)
    return new Promise((resolve, reject) => {
        if (!Array.isArray(copy_names))
        {
            copy_names = [];
        }
        let pending = copy_names.length;
        let err_names = [];
        if (pending > 0) 
        {
            copy_names.forEach((item, ind) => {
                console.log("copying from:", rem_root+item, " to:", loc_root+item);
                let loc_file = loc_root+item;
                console.log("LOC FILE =", loc_file);
                //check_or_create_dir(loc_file, err => {
                //fs.mkdir(loc_root, { recursive: true }, (err) => {
                create_dir_if_need(loc_file, (err, path_dir) => {
                    if (err) {
                        err_names.push(path_dir);
                        if (!--pending) { resolve(err_names); }
                            //if (is_empty_dirs) mcb(err_names, "ok"); }
                    }
                    else {
                        fs.copyFile(rem_root+item, loc_root+item, (err)=>{
                            if (err) {
                                console.log("copy err=", err);
                                err_names.push(item);
                                if (!--pending) { resolve(err_names); }
                                    //if (is_empty_dirs) mcb(err_names, "ok");
                            }   
                            else {
                                if (!--pending) { resolve(err_names); }
                                    //if (is_empty_dirs) mcb(err_names, "ok");
                            }
                        });
                    }
                });
            });
        }
        else { resolve(err_names); }
    });
}
//* same code as in controller.js
function create_empty_dirs(loc_root, empty_dirs) 
{
    return new Promise((resolve, reject) => {
        let pending = empty_dirs.length;
        let err_names = [];
        if (empty_dirs.length > 0) {
            empty_dirs.forEach((item, ind) => {
                let loc_dir = loc_root+item;
                fs.mkdir(loc_dir, { recursive: true }, (err) => {
                    if(err) {
                        err_names.push(loc_dir);
                        if (!--pending) { resolve(err_names); }
                    }
                    else {
                        if (!--pending) { resolve(err_names); }
                    }
                });
            });
        }
        else { resolve(err_names); }
    });
}

function execute_command(command_)
{
    let command = command_+"\r\n" || "tasklist";
    return new Promise((resolve,reject)=>{
        console.log("EXECUTE_COMMAND: ", command);
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

function create_dir_if_need(path_, cb)
{
    fs.stat(path_, (err, stats) => {
        if ((err)&&(err.code == "ENOENT")) {
            let file_index = path_.lastIndexOf("\\");
            let path_dir = path_.slice(0, file_index);
            console.log("path_dir=", path_dir);
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

//get_dir_manifest("../controller", prefix="controller")
function get_dir_manifest(look_path, suffix)
{
    //look_path = path.normalize(look_path);
    //if(look_path.startsWith('.')) look_path = path.resolve(look_path);
    return new Promise((resolve, reject) => {
        var walk = function(dir, root_path, suffix, done) {
            var results = [];
            fs.readdir(dir, function(err, list) {
                if (err) return done(err);
                let rel_path = (dir.length > root_path.length) ? dir.slice(root_path.length) : "";
                rel_path = (suffix) ? ("\\" + suffix + rel_path) : rel_path;
                var pending = list.length;
                if (!pending) return done(null, results);
                list.forEach(function(file) {
                    let rel_file_path = rel_path + "\\" + file;
                    file = dir + "\\" + file;
                    //file = path.resolve(dir, file);
                    fs.stat(file, function(err, stat) {
                        //console.log("FILE=",file);
                        if (stat && stat.isDirectory()) {
                            walk(file, root_path, suffix, function(err, res) {
                                //* that's it empty directory
                                if (res.length == 0) { 
                                    let dir_res = [];
                                    dir_res.push(rel_file_path);
                                    dir_res.push(stat.size);
                                    dir_res.push(stat.mtime);
                                    dir_res.push('empty_dir');
                                    console.log("EMPTY_DIR:", dir_res);
                                    results.push(dir_res);
                                }
                                else { results = results.concat(res); }
                                if (!--pending) done(null, results);
                            });
                        }
                        else {
                            let inner_res = [];
                            inner_res.push(rel_file_path);
                            inner_res.push(stat.size);
                            inner_res.push(stat.mtime);
                            results.push(inner_res);
                            if (!--pending) done(null, results);
                        }
                    });
                });
            });
        };
        walk(look_path, look_path, suffix, function(err, results) {
            //if (err) throw err;
            if (err) reject(err);
            else resolve(results);
        });
    });
}
//* sync
/*

*/

function compare_manifests_1rp1lp(local, remote)
{
    let copy_names = [];
    let empty_dirs = [];
    
    //1.1. Trim Big Manifest By Controller
    remote = reduce_remote_fold_to_controller_fold(remote);
    
    let local_empty_dirs = get_empty_dirs(local);
    let remote_empty_dirs = get_empty_dirs(remote);
    empty_dirs = DiffArrays(remote_empty_dirs, local_empty_dirs);
    
    local = trim_empty_dirs(local);
    remote = trim_empty_dirs(remote);
    
    //1.2. Extract flat Arrays with 'Names' from Arr2d
    const names = extract_flat_names(local, remote);
    //1.3. Find new Names in remote 'controller' Folder
    let diff_rl = DiffArrays(names.remote_names, names.local_names);
    copy_names = copy_names.concat(diff_rl);
    //console.log("new_remote_files =", diff_rl);

    //2. FIND DIFFER BY SIZE AND BY DATE (EXEC TIME = 0.5 ms)
    //2.1. Find Intersec by Name
    let intersec = IntersecArrays(names.local_names, names.remote_names);
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
    let names_diff_by_size = compare_intersec_by_size_or_date(local, remote);
    copy_names = copy_names.concat(names_diff_by_size);
//    console.log("copy_names ===", copy_names);
//    console.log("empty_dirs ===", empty_dirs);

    //4. COPY CHANGES
    return {copy_names:copy_names, empty_dirs:empty_dirs};

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
    function reduce_remote_fold_to_controller_fold(remote){
        // const folder = './controller';
        let trim_remote = new Array();
        for (let i in remote) {
            if (remote[i][0].startsWith("\\controller\\")) {
                trim_remote.push(remote[i]);
            }
        }
        return trim_remote;
    }
    //* sync
    function extract_flat_names(local, remote){
        let local_names = [], remote_names = [];
        for (let i in local) {local_names.push(local[i][0]); }
        for (let i in remote) {remote_names.push(remote[i][0]); }
        return {local_names:local_names, remote_names:remote_names }
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
}
//* sync
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


//--------------------------------
//---------TRASH------------------
//--------------------------------
const wait_file = path => {
	fs.readFile(path, 'utf-8', (err, data) => {
		if (err) {
			//throw err;
			//console.log('\x1Bc'); // clear console cmd
			console.log('no such file');
		}
		else {
			console.log('file exist! start watching...');
			clearInterval(ctrl_wtr);
			watch(path);
		}
		//console.log(data.length);
		console.log(data);
	});
};

const look_first = path => {
	return new Promise((resolve, reject) => {
		fs.readFile(path, 'utf-8', (err, data) => {
			if (err) {	reject('no such file'); }
			else { resolve(data); }
		});
	});
};

const watch = path => {
	let watcher = fs.watch(path, () => { 	look(path);	});
	retranslateEmitter(watcher);
	watcher.on('change', (data) => {
		console.log("change event: ", data);
	});
	watcher.on('close', (data) => {
		console.log("close event: ", data);
	});
	watcher.on('error', (data) => {
		console.log("error event: ", data);
	});
}

const look = path => {
	fs.readFile(path, 'utf-8', (err, data) => {
		if (err) {	console.log('no such file', err); }
		else { console.log("file changes: ", data); }
	});
};

const start_look = () => {
	look_first(path).then(res => {
		console.log('first check: file exist!');
		console.log('start watching...');
		 watch(path);

	}).catch(ex => {
		//* on first check file is absent
		ctrl_wtr = setInterval(() => {
			wait_file(path);
		}, INTERVAL);
	});
}

function async_await_example()
{
	function resolveAfter2Seconds(x) {
		return new Promise(resolve => {
			setTimeout(() => { resolve(x); }, 2000);
		});
	}

	async function add1(x) {
		const a = await resolveAfter2Seconds(20);
		const b = await resolveAfter2Seconds(30);
		return x + a + b;
	}
	add1(15).then(res=>{ console.log("add=",res); }).catch(ex=>{console.log("ex=",ex);})
}