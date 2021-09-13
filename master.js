    //master.js
    'use sctrict';
    const path = require('path');
    const util = require('util');
    const url = require('url');
    const fs = require('fs');
    
	main();
	function main(){
        retranslate_logger();
        const SETTINGS	= read_json_sync("./m_settings.json");
        const JOBS_CONFIG = read_json_sync("jobs_config.json");
        if (SETTINGS.error || JOBS_CONFIG.error) {return console.log("Application not started")}
		else { new App().run(SETTINGS, JOBS_CONFIG); }
        //rewrite_config_test();
	}
    function retranslate_logger(){
        const log = require('./log.js');
        log.init(false, "master", "./log").then(res=>{    
            const consolelog = console.log.bind(console);
            const consoleerr = console.error.bind(console);
            console.log = function(...args){
                const args2 = convert_args(args);
                log.write(args2.join(" "),"","INFO");
                //consolelog.apply(this, arguments);
            }
            console.error = function(...args){
                const args2 = convert_args(args);
                log.write(args2.join(" "),"","ERROR");
                consoleerr.apply(this,arguments);
            }
        }).catch(err=>{
            console.log("log error:",err)
        })
    }
    function convert_args(args){
        const args2 = args.map(arg=>{
            let result = arg;
            if ((typeof arg=='object')&&(!Array.isArray(arg))){
                if(arg instanceof Error){
                    result = arg.message;
                }else{
                    try{
                        result = JSON.stringify(arg);
                    }catch(err){}
                }
            }
            return result;
        });
        return args2;
    }
    function App(){
        this.run=(SETTINGS, JOBS_CONFIG)=>{
            new ZooKeeper(
                new IoServer(
                    new HttpServer(
                        new WebRequest(
                            new Pages()
                                .with("/", new Page("/"))
                                .with("/io_address", new Page(
                                    "/io_address", 
                                    new IoConfig(SETTINGS).io_address()
                                ))
                                .with("/socket.js", new Page("/socket.js"))
                                .with("/engine.js", new Page("/engine.js"))
                                .with("/core.js", new Page("/core.js"))
                                .with("/browser_detect.js", new Page("/browser_detect.js"))
                                .with("/mytable.js", new Page("/mytable.js"))
                                .with("/src/app.js", new Page("/src/app.js"))
                        ),
                        SETTINGS
                    )
                ),
                new BrowserIoClients(),
                new ExternalSource(),
                new UpdatableHostCluster(
                    new Manifest(new DirStructure(), new DirsComparing()),
                    new HostCluster(
                        new HostAsPair(
                            new Launcher({}),
                            new Controller(
                                new CurrentControllerMode(),
                                new Jobs(
                                    new SpecialControllerMode(),
                                    new NormalControllerMode(),
                                    JOBS_CONFIG
                                ),
                                {stub:true}
                            ),
                            new ConnectedAgentsThrottle(
                                new RedundantAgentsReservation()
                            ),
                            //@ host pass this object to Agents through run-method
                            new AgentUpdateChain()
                        ),
                        new AgentRecognizing()
                    ),
                    JOBS_CONFIG
                ),
                SETTINGS
            ).run();
        }
	}

    function ZooKeeper(ioServer, browserIoClients, externalSource, updatableHostCluster, SETTINGS){
        this.ioServer=ioServer;
        this.browserIoClients=browserIoClients;
        this.externalSource=externalSource;
        this.updatableHostCluster=updatableHostCluster;
        this.run=()=>{
            const stringEndSlash = new StringEndSlash();
            const update_path_with_slash = stringEndSlash.add(SETTINGS.update_folder);
            SETTINGS.update_folder = update_path_with_slash;
            this.browserIoClients.run(this.updatableHostCluster);
            this.externalSource.run(this.updatableHostCluster);
            this.updatableHostCluster.run(this.browserIoClients, externalSource, SETTINGS);
            this.ioServer.run(this.updatableHostCluster, this.browserIoClients, this.externalSource);
        }
    }
    function StringEndSlash(){
    this.check=(str)=>{
        if(!str || typeof str != "string"){throw new Error("StringEndSlash.check() arg must be a String type!");}
        else{
            const is_end1 = str.endsWith("\\");
            const is_end2 = str.endsWith("/");
            console.log("StringEndSlash.check() is_end1=",is_end1,",is_end2=",is_end2);
            if(is_end1 || is_end2){return true}
            else return false;
        }
    }
    this.add=(str)=>{
        if(!str || typeof str != "string"){return str}
        else if(this.check(str)) return str;
        else return str + '/';
    }
}
    function ExternalSource(){
        this.run=(updatableHostCluster)=>{
            this.updatableHostCluster=updatableHostCluster;
        }
        //@ some external source connected by socket io
        this.welcomeAgent=(io_srv_msg)=>{
            //@ io_srv_msg = {agent_socket, browser_or_agent}
            console.log("ExternalSource.welcomeAgent(): socket id =", io_srv_msg.agent_socket.id);
            this.socket = io_srv_msg.agent_socket;
            this.socket.on('connect', ()=>{
                console.log("ExternalSource connection: "+this.socket.id);
            })
            this.socket.on('disconnect', ()=>{
                console.log("ExternalSource disconnection: "+this.socket.id);
            })
            //@ msg from external source to host cluster
            this.socket.on('kick', (msg)=>{
                //console.log("ExternalSource control_msg: ",msg);
                this.updatableHostCluster.gui_ctrl(msg, true);
            })
        }
        //@ msg from inside host cluster to external source
        this.outcome_burp=(data)=>{
            //@ from HostCluster: data={ msg:'host_table', table: [{md5:""},{md5:""}] };
            if(this.socket){
                this.socket.emit('burp', data);
            }
        }
        this.gui_news=(data)=>{
            //@ from HostCluster: data={ msg:'host_table', table: [{md5:""},{md5:""}] };
            if(this.socket){
                this.socket.emit('burp', data);
            }
        }
    }
    function BrowserIoClients(){
        this.updatableHostCluster=undefined;//run
        this.socket = undefined;
        this.run=(updatableHostCluster)=>{
            this.updatableHostCluster=updatableHostCluster;
        }
        //@ browser connected by socket io
        this.welcomeAgent=(io_srv_msg)=>{
            //@ io_srv_msg = {agent_socket, browser_or_agent}
            console.log("BrowserIoClients.welcomeAgent(): socket id =", io_srv_msg.agent_socket.id);
            this.socket = io_srv_msg.agent_socket;
            this.socket.on('connect', ()=>{
                console.log("BrowserIoClients connection: "+this.socket.id);
            })
            this.socket.on('disconnect', ()=>{
                console.log("BrowserIoClients disconnection: ",this.socket.id, "eventNames=", this.socket.eventNames());
                //@ socket.eventNames()
                //@ socket.listeners(event)
                //@ socket.removeAllListeners([event]) 
            })
            this.socket.on('gui_ctrl', (msg)=>{
                console.log("BrowserIoClients control_msg: ",msg);
                const socketMsg = new SocketMsg(msg);
                this.updatableHostCluster.gui_ctrl(msg);
            })
        }
        //@ msg from inside host cluster to outside Browser
        this.gui_news=(data)=>{
            //@ from HostCluster: data={ msg:'host_table', table: [{md5:""},{md5:""}] };
            console.log("BrowserIoClients.gui_news(): data =", JSON.stringify(data))
            if(this.socket){
                //console.error("AAAAAAAAAAAAA", data)
                this.socket.emit('gui_news', data);
            }
        }
        function SocketMsg(msg){
            this.msg = msg;
        }
    }

    function IoServer(httpServer){
        this.httpServer = httpServer;
        this.updatableHostCluster=undefined;
        this.browserIoClients=undefined;
        this.externalSource=undefined;
        this.run=(updatableHostCluster, browserIoClients, externalSource)=>{
            this.updatableHostCluster = updatableHostCluster;
            this.browserIoClients = browserIoClients;
            this.externalSource = externalSource;
            require('socket.io')(this.httpServer.run().http).on('connection', (socket) => {
                //@ exist and looks like {:3,polling,NbISECy,1}
                console.log("IoServer2.run() query=", Object.values(socket.handshake.query).join("|"));
                const io_srv_msg = { 
                    agent_socket: socket,
                    browser_or_agent: socket.handshake.query.browser_or_agent,
                    agent_identifiers: new ParsedJSON(socket.handshake.query.agent_identifiers).run()
                }
                if(io_srv_msg.browser_or_agent == "agent"){
                    this.updatableHostCluster.welcomeAgent(io_srv_msg);
                }else if(io_srv_msg.browser_or_agent == "browser"){
                    console.log("UpdatableHostCluster.socketConnected() Browser connected!");
                    this.browserIoClients.welcomeAgent(io_srv_msg);
                }else{
                    console.log("UpdatableHostCluster.socketConnected(): nor browser or agent:", JSON.stringify(socket.handshake.query));
                    this.externalSource.welcomeAgent(io_srv_msg);
                }
            });
        }
    }	

    function ParsedJSON(stringifiedJson){
        this.stringifiedJson = stringifiedJson;
        this.run=()=>{return (this.stringifiedJson) ? JSON.parse(this.stringifiedJson) : {}}
    }

    function UpdatableHostCluster(manifest, hostCluster, JOBS_CONFIG){
        this.manifest = manifest;
        this.hostCluster = hostCluster;
        this.JOBS_CONFIG = JOBS_CONFIG;
        this.SETTINGS = undefined; //run
        this.browserIoClients = undefined; //run
        this.run=(browserIoClients, externalSource, SETTINGS)=>{
            this.browserIoClients = browserIoClients;
            this.SETTINGS = SETTINGS;
            this.hostCluster.run(browserIoClients, externalSource, SETTINGS);
            this.manifest.run(this.hostCluster, SETTINGS);
        }
        //@ new socket (new host launcher or controller) connection from IoServer
        this.welcomeAgent=(io_srv_msg)=>{
            this.hostCluster.welcomeAgent(
                io_srv_msg, 
                this.manifest.current(),
                this.manifest.mapped()
            );
        }
        //@ new manifest, means there was changes in update folder
        this.propagateManifestDiff=(mans_diff)=>{
            this.hostCluster.propagateManifestDiff(mans_diff);
        }
        //@ command from outside browser or another external source
        //@param {Object dto} msg - e.g. {type: 'list_future_jobs',host_id: '6e8bc6f1e3ef10adf9dd98617c133110'}
        //@param {Boolean} is_ext_kick - menas its not from browser, but from another one external source
        this.gui_ctrl=(msg, is_ext_kick)=>{
            console.error("UpdatableHostCluster.gui_ctrl(): msg=", msg);  
            if(msg.type == "switch_manifest_off"){
                this.manifest.switch_off();
            }else if(msg.type == "jobs_config"){
                if(msg.concrete_agent){
                    this.hostCluster.gui_ctrl(msg, is_ext_kick)
                }else{
                    this.browserIoClients.gui_news({"jobs_config": this.JOBS_CONFIG, "caller_id": msg.caller_id})
                }
            }else{
                this.hostCluster.gui_ctrl(msg, is_ext_kick);
            }
        }
    }

    //@ ready=1
	function Manifest(dirStructure, dirsComparing){
        this.main_update_paths = []; //run
        this.mapped_paths = {};//run
        this.dirStructure=dirStructure;
        this.dirsComparing=dirsComparing;
        this.hostCluster=undefined;//run
        this.timer = 60000;
        this.switch_on_flag = true;
        this.prev_mans = {};//run
        this.mapped_mans = {};//run
        this.mapped=()=>{return this.mapped_mans;};
		this.current = ()=>{ return this.prev_mans };
        this.run = function(hostCluster, SETTINGS){
            init_by_settings(SETTINGS);
            console.log("Manifest.run(): main_update_paths=",this.main_update_paths);
            this.mapped_paths = SETTINGS.mapped_paths;
            this.hostCluster=hostCluster;
            this.prev_mans = this.dirStructure.allMansSync(this.main_update_paths); //sync
            console.log("Manifest.run(): this.prev_mans=",this.prev_mans);
            //@ mapped_mans = {"x":{dst_path:"C:/Temp", man:[[...],[...]]}, "y":{...}}
            this.mapped_mans = this.dirStructure.allMappedMansSync(filterExistingMappedPaths(SETTINGS));
            console.log("Manifest.run(): this.mapped_mans=",this.mapped_mans);
            setTimeout(()=>{
                this.nextManifest();
                this.nextMappedMans(SETTINGS);
            }, this.timer);
            return this;
        }
        const init_by_settings=(SETTINGS)=>{
            console.log("Manifest.init_by_settings() SETTINGS=", SETTINGS);
            this.timer = SETTINGS.update_folder_watch_timer || 60000;
            const glob_update_path = SETTINGS.update_folder || "update/";
            const launcher_update_path = glob_update_path + "launcher";
            const controller_update_path = glob_update_path + "controller";
            const other_update_path = glob_update_path + "other";
            this.main_update_paths = [
                {name:"launcher", path:launcher_update_path},
                {name:"controller", path:controller_update_path},
                {name:"other", path:other_update_path}];
        }
        this.switch_off=()=>{
            this.switch_on_flag = false;
        }
        this.nextManifest = function(){
            this.dirStructure.allMansAsync(this.main_update_paths).then(next_mans=>{
                console.log("Manifest.nextManifest(): next_mans=",next_mans);
                const dirs_compare_diff = this.dirsComparing.compare(next_mans, this.prev_mans);
                console.log("Manifest.nextManifest(): dirs_compare_diff=",dirs_compare_diff);
                //@ e.g.: dirs_compare_diff = { launcher: { new_files: [], files_to_change: [ [Array] ], old_files: [] } }
                if(dirs_compare_diff) {
                    console.log("Manifest.nextManifest():CHANGES EXIST!");
                    this.prev_mans = next_mans;
                    this.hostCluster.propagateManifestDiff(dirs_compare_diff);
                }else{
                    console.log("Manifest.nextManifest(): No changes!");
                }
            }).catch(err=>{
                console.error("Manifest: nextManifest() Error:"+err);
            }).finally(()=>{
                console.log("Manifes.tnextManifest(): finally: new manifest check will after "+this.timer+ " ms...");
                setTimeout(()=>{this.nextManifest()}, this.timer);
            })
        }
        this.nextMappedMans = function(SETTINGS){
            //@ mapped_paths looks like: {"dst_path":[["filename.txt",<date>,<size>], [...]], "x":[[],[]]}
            this.dirStructure.allMappedMansAsync(SETTINGS).then(next_mapped_mans=>{
                console.log("Manifest.nextMappedMans() after allMappedMansAsync()...");
                const dirs_compare_diff = this.dirsComparing.compare_mapped(next_mapped_mans, this.mapped_mans);
                if(dirs_compare_diff) {
                    console.log("Manifest.nextManifest(): dirs_compare_diff=",dirs_compare_diff);
                    this.mapped_mans = next_mapped_mans;
                    this.hostCluster.propagateMappedMansDiff(dirs_compare_diff);
                }else{
                    console.log("Manifest.nextMappedMans(): No changes!");
                }
            }).catch(err=>{
                console.error("Manifest.nextMappedMans() after allMappedMansAsync Error:", err);
            }).finally(()=>{
                console.log("Manifes.tnextManifest(): finally: new manifest check will after "+this.timer+ " ms...");
                setTimeout(()=>{this.nextMappedMans(SETTINGS)}, this.timer);
            })
        }
        const filterExistingMappedPaths=(SETTINGS)=>{
            Object.keys(SETTINGS.mapped_paths).forEach(key=>{
                const local_path  = SETTINGS.update_folder + key;
                console.log("filterExistingMappedPaths local_path = ",local_path);
                try{
                    const stat = fs.statSync(local_path);
                    if (stat && stat.isDirectory()){
                        console.log("mapped path '"+key+"' exists...");
                    }else{
                        console.log("Warning: mapped path '"+local_path+"' is not a directory!");
                        delete SETTINGS.mapped_paths[key];
                    }
                }catch(err){
                    console.log("Warning: mapped path '"+local_path+"' does not exist!");
                    delete SETTINGS.mapped_paths[key];
                }
            });
            return SETTINGS;
        }
    }
    function DirStructure(){
        //@ returns manifests of a several dirs. Type object {'launcher':[], 'controller':[]}
        this.allMansSync=(paths_data)=>{
            const result = {};
            paths_data.forEach(path_data=>{
                try{
                    result[path_data.name] = this.manOfDirSync(path_data.path);
                    console.log("DirStructure.allMansSync(): result=", result[path_data.name]);
                }catch(err){
                    console.error("DirStructure.allMansSync() ERROR: ", err);
                }
            });
            return result;
        }
        //@ returns manifests of a several dirs. Type object {'launcher':[], 'controller':[]}
        this.allMansAsync=(paths_data)=>{
            return new Promise((resolve,reject)=>{
                const result = {};
                let pending = paths_data.length;
                if(pending == 0){return resolve(result)};
                paths_data.forEach(path_data=>{
                    this.manOfDirAsync(path_data.path).then(res=>{
                        console.log()
                        result[path_data.name] = res;
                        if(!--pending){resolve(result)}
                    }).catch(err=>{
                        console.error("DirStructure.allMansAsync() ERROR: ", err);
                        if(!--pending){resolve(result)}
                    })
                });
                setTimeout(()=>{reject("DirStructure.allMansAsync(): timeout Error!")},10000);
            });
        }
        //@ return  {"x":{dst_path:"C:/Temp", man:[[...],[...]]}, "y":{...}}
        this.allMappedMansSync=(SETTINGS)=>{
            //@ mapped_paths = { 'update/x': 'C:/Pics', "y": "..."}
            console.log("Manifest.allMappedMansSync() mapped_paths=",SETTINGS.mapped_paths);
            const result = {};
            const mapped_paths_keys = Object.keys(SETTINGS.mapped_paths);
            mapped_paths_keys.forEach(src_path=>{
                const local_path  = SETTINGS.update_folder + src_path;
                result[src_path] = {};
                result[src_path].dst_path = SETTINGS.mapped_paths[src_path];
                try{
                    result[src_path].man = this.manOfDirSync(local_path);
                    //const dst_path = mapped_paths[src_path];
                    //result[dst_path] = this.manOfDirSync(src_path);
                }catch(err){
                    console.error("DirStructure.allMappedMansSync() ERROR: ", err);
                }
            });
            return result;
        }
        this.allMappedMansAsync=(SETTINGS)=>{
            return new Promise((resolve,reject)=>{
                const result = {};
                let pending = Object.keys(SETTINGS.mapped_paths).length;
                if(pending == 0){return resolve(result)}
                Object.keys(SETTINGS.mapped_paths).forEach(src_path=>{
                    const local_path  = SETTINGS.update_folder + src_path;
                    this.manOfDirAsync(local_path).then(man=>{
                        result[src_path] = {};
                        result[src_path].dst_path = SETTINGS.mapped_paths[src_path];
                        result[src_path].man = man;
                        //const dst_path = mapped_paths[src_path];
                        //result[dst_path] = man;
                        if(!--pending){resolve(result)}
                    }).catch(err=>{
                        console.error("DirStructure.allMappedMansAsync() ERROR: ", err);
                        if(!--pending){resolve(result)}
                    });
                });
                setTimeout(()=>{reject("DirStructure.allMappedMansAsync(): timeout Error!")},10000);
            });
        }
        //@ returns manifest of one directory. Type Array ['f1', 'f2']
        this.manOfDirSync=(look_dir)=>{
            look_dir = look_dir || "\\update";
            return walk(look_dir, look_dir);
            function walk(cur_path, root_path){
                var results = [];
                const cur_path_without_root = (cur_path.length > root_path.length) ? cur_path.slice(root_path.length) : "";
                var list;
                try{list = fs.readdirSync(cur_path);}
                catch(err){
                    console.error("DirStructure.manOfDirSync() ERROR: ",err);
                }
                list.forEach(function(file){
                    const file_path_without_root = cur_path_without_root + "\\" + file;
                    const file_path = cur_path + "\\" + file;
                    const stat = fs.statSync(file_path);
                    if (stat && stat.isDirectory()){
                        const sub_res = walk(file_path, root_path);
                        if(sub_res.length==0){ 
                            results.push([file_path_without_root+"\\"]); 
                        }else results = results.concat(sub_res);
                    }else{
                        results.push([file_path_without_root,stat.size,stat.mtime]);
                    }
                });
                return results;
            }
        }
        //@ returns manifest of one directory. Type Array ['f1', 'f2']
        this.manOfDirAsync=(look_dir)=>{
            return new Promise((resolve, reject)=>{
                look_dir = look_dir || "\\update"
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
                                if(err){
                                    console.error("DirStructure.manOfDirAsync() fs.stat Error: ",err);
                                    if (!--pending) cbDone(err);
                                }else if (stat && stat.isDirectory()) {
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
    }
    function DirsComparing(){
        this.compareResult=undefined;
        this.compare_mapped=(next_mapped, prev_mapped)=>{
            //@ next_mapped = {"x":{dst_path:"C:/Temp", man:[[...],[...]]}, "y":{...}}
            const result = {};
            for(let src_path in next_mapped){
                console.log("DirsComparing.compare_mapped(): next_mapped[src_path]=",next_mapped[src_path]);
                const comparedDirs = this.compare2Dirs(next_mapped[src_path].man, prev_mapped[src_path].man);
                let is_really_some_changes = false;
                for(const part in comparedDirs){
                    if(comparedDirs[part].length>0){ is_really_some_changes = true; }
                }
                if(is_really_some_changes) {
                    result[src_path] = {};
                    result[src_path].comparing = comparedDirs;
                    result[src_path].dst_path = next_mapped[src_path];
                }
            }
            return Object.keys(result).length>0 ? result : undefined;
        }
        this.compare=(next_mans, prev_mans)=>{
            const result = {};
            for(let man in next_mans){
                const comparedDirs = this.compare2Dirs(next_mans[man], prev_mans[man]);
                //@ -----Warning: Procedural code: result can be kinda: { new_files: [], files_to_change: [], old_files: [] }
                let is_really_some_changes = false;
                for(const part in comparedDirs){
                    if(comparedDirs[part].length>0){ is_really_some_changes = true; }
                }
                if(is_really_some_changes) result[man] = comparedDirs;
                //@ ---------------------------------------
            }
            return Object.keys(result).length>0 ? result : undefined;
        }
        this.compare2Dirs=(next_man, prev_man)=>{
            //@ next_man = {controller:[], launcher:[], other:[]}
            console.log("DirsComparing.comparing(): next_man=",next_man);
            const new_files = find_new_files(next_man, prev_man);
            const files_to_change = find_files_to_change(next_man, prev_man);
            const old_files = find_old_files(next_man, prev_man);
            return {new_files, files_to_change, old_files};
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
                    console.error("Converting Date to Ms ERROR: Unknown type of input date: ", date);
                    return 0;
                }
            }
        }
    }
	
	function HostCluster(hostAsPair, agentRecognizing){
        this.hostAsPair = hostAsPair;
        this.browserIoClients=undefined;//run
        this.externalSource=undefined;//run
        this.SETTINGS=undefined;//run
        const _hosts_list = [];
        //this.acceptable_commands = ["welcomeAgent", "guiControl"];
		this.run = (browserIoClients, externalSource, SETTINGS)=>{
            this.browserIoClients = browserIoClients;
            this.externalSource = externalSource;
            this.SETTINGS = SETTINGS;
            return this;
        }
		this.welcomeAgent = (io_conn, manifest_snapshot, mapped_mans_snapshot)=>{
			//@ conn = {agent_socket: socket, browser_or_agent: "agent" || "browser", agent_identifiers: {agent_identifiers}
            //const ag_present = Object.values(io_conn.agent_identifiers).join("|");
			agentRecognizing.instance(io_conn.agent_identifiers).run(io_conn.agent_socket).then(agent_ids=>{
                this.hostByMd5(agent_ids).welcomeAgent(io_conn.agent_socket, agent_ids, manifest_snapshot, mapped_mans_snapshot)
            }).catch(err=>{
                console.error("HostCluster.welcomeAgent() agent recognizing Error:",err);
            })
            return this;
		}
		this.propagateManifestDiff = (mans_diff)=>{
            if(this.SETTINGS.apply_updates){
                _hosts_list.forEach(host=>{
                    host.propagateManifestDiff(mans_diff);
                });
            }
		}
        this.propagateMappedMansDiff=(mans_diff)=>{
            if(this.SETTINGS.apply_updates){
                _hosts_list.forEach(host=>{
                    host.propagateMappedMansDiff(mans_diff);
                });
            }
        }
		this.host_by_md5_only_read = (agent_ids)=>{
            let host_index = -1;
			console.log("_hosts_list length="+_hosts_list.length);
			for(let i=0; i<_hosts_list.length; i++){
				if(_hosts_list[i].commonMd5() == agent_ids.md5){
					host_index = i;
					break;
				}
			}
            if(host_index > -1){return _hosts_list[host_index]}
            else return false;
        }
		this.hostByMd5 = (agent_ids)=>{
			let host_index = -1;
			console.log("_hosts_list length="+_hosts_list.length);
			for(let i=0; i<_hosts_list.length; i++){
				if(_hosts_list[i].commonMd5() == agent_ids.md5){
					host_index = i;
					break;
				}
			}
			if(host_index > -1) return _hosts_list[host_index];
			else {
                return this.addHost(this.hostAsPair.instance(agent_ids, this).run(this.browserIoClients, this.externalSource, this.SETTINGS));
            }
		}
		this.addHost = (agentObj)=>{
            _hosts_list.push(agentObj);
            return agentObj;
        }
        //@ command from outside browser or another external source
        //@param {Object dto} msg - e.g. {type: 'list_future_jobs',host_id: '6e8bc6f1e3ef10adf9dd98617c133110'}
        //@param {Boolean} is_ext_kick - menas its not from browser, but from another one external source
        this.gui_ctrl=(msg, is_ext_kick)=>{
            const recipient = (is_ext_kick) ? this.externalSource : this.browserIoClients;
            if(typeof msg != "object"){
                return console.error("HostCluster.gui_ctrl() msg is not an Object: ",msg);
            }
            if(msg.type=='host_table'){
                const result = _hosts_list.map(host=>{
                    let res = {};
                    res.md5 = host.commonMd5();
                    const add_info = host.gui_ctrl(msg);
                    res = Object.assign(res, add_info);
                    return res;
                });
                recipient.gui_news({msg:'host_table', table: result});
            }else if(msg.type=="jobs_config"){
                const AGENT_MD5 = msg.concrete_agent;
                let host_matched = _hosts_list.filter(host=>{
                    return host.commonMd5() == AGENT_MD5;
                });
                if(host_matched.length ==1){
                    host_matched[0].gui_ctrl(msg, is_ext_kick);
                }else{
                    console.error("HostCluster.gui_ctrl(): msg type 'jobs_config': host_matched length=", host_matched.length);
                }
            }else if(msg.type=="apply_updates"){
                if(msg.value == "check"){
                    recipient.gui_news({msg:'apply_updates', value: this.SETTINGS.apply_updates});
                }else{
                    let is_apply = this.SETTINGS.apply_updates;
                    if(msg.value == "off"){
                        is_apply = false;
                    }else if(msg.value == "on"){
                        is_apply = true;
                    }
                    console.log("HostCluster.gui_ctrl() is_apply=", is_apply, "SETTINGS.apply_updates=", this.SETTINGS.apply_updates);
                    if(is_apply != this.SETTINGS.apply_updates){
                        this.SETTINGS.apply_updates = is_apply;
                        fs.writeFile('m_settings.json', JSON.stringify(this.SETTINGS, null, '    '), (err)=>{
                            if (err){
                                console.log("HostCluster.gui_ctrl(): fail to rewrite settings file:",err);
                            }
                            recipient.gui_news({msg:'apply_updates', value: this.SETTINGS.apply_updates});
                        });
                    }
                }
            }else if(msg.type=="list_future_jobs"||msg.type=="drop_future_jobs"){    
                let host_matched = _hosts_list.filter(host=>{
                    return host.commonMd5() == msg.host_id;
                });
                if(host_matched.length == 0){
                    const existing_hosts = _hosts_list.map(host=>host.commonMd5());
                    console.error("HostCluster.gui_ctrl(): no matches hosts by md5, existing_hosts =", existing_hosts);}
                if(host_matched.length > 1){console.error("HostCluster.gui_ctrl(): on external cmd about future jobs there are more than one match with md5=", msg.host_id);}
                console.log("HostCluster.gui_ctrl(): host_matched=",host_matched);
                host_matched.forEach(host=>{
                    host.gui_ctrl(msg, is_ext_kick);
                });
            }
        }
        //@ host says that all his agents was disconnected, so its equal like host must be recycled
        this.host_destroyed=(host_md5)=>{
            let host_index = -1;
            for(let i=0; i<_hosts_list.length; i++){
                if(_hosts_list[i].commonMd5() == host_md5){
                    host_index = i;
                }
            }
            console.log("HostCluster.host_destroyed() _hosts_list length before=", _hosts_list.length);
            if(host_index > -1) _hosts_list.splice(host_index, 1);
            console.log("HostCluster.host_destroyed() _hosts_list length after=", _hosts_list.length);
        }
	}

    function AgentRecognizing(agent_identifiers){
        this.agent_identifiers = agent_identifiers;
		this.instance=(agent_identifiers)=>{
            return new AgentRecognizing(agent_identifiers);
        }
		this.run = (socket)=>{
			return new Promise((resolve, reject)=>{
                if(this.agent_identifiers) {
                    resolve(this.agent_identifiers);
                }else{
                    console.log("AgentRecognizing.identifiers(): emit 'identifiers' event");
                    const socket_handler=function(identifiers){
                        //@ identifiers = {agent_type, sid, md5, ip, pid, ppid, apid}
                        console.log("AgentRecognizing.identifiers() as is",identifiers);
                        resolve(identifiers?identifiers:{});
                    }
                    socket.emit('identifiers').once('identifiers',socket_handler);
                    setTimeout(()=>{
                        socket.removeListener('identifiers', socket_handler);
                        reject(new Error("AgentRecognizing.run() timeout Error"));
                    }, 5000);
                }
			});
		}
	}

    function RedundantAgentsReservation(workWithAgents){
        this.workWithAgents = workWithAgents;
        this.is_timeout = false;
        this.launcher = undefined;
        this.controller = undefined;
        this.was_called_once = false;
        this.reserve_agents = [];
        this.run=(launcher, controller)=>{
            this.launcher = launcher;
            this.controller = controller;
            this.workWithAgents = workWithAgents.run(launcher, controller);
            return this;
        }
        this.welcomeAgent=(a,b,c)=>{
            if(this.was_called_once){this.reserve_agents.push([a,b,c])}
            else{workWithAgents.firstWorkSinceRestart(a,b,c);}
        }
    }

	function HostAsPair(launcher, controller, connectedAgentsThrottle, agentUpdateChain, creator_ids, hostCluster){
        //@ HostAsPair object instantiates by one of Launcher or Controller, so on creation stage we allready know about one of agents and his states
        this.launcher = launcher;
		this.controller = controller;
        this.connectedAgentsThrottle = connectedAgentsThrottle;
        this.agentUpdateChain = agentUpdateChain;
        this.creator_ids = creator_ids;
        this.browserIoClients = undefined; //run()
        this.externalSource=undefined;//run()
        this.SETTINGS = undefined; //run
        this.hostCluster = hostCluster;
		this.is_host_first_time_created_flag = true;
        this.manifest_snapshot = undefined;//welcomeAgent
        this.mapped_mans_snapshot = undefined;//welcomeAgent
        this.is_init_timeout_flag = false;
        this.last_manifest_snapshot=()=>{return this.manifest_snapshot}
        this.commonMd5=()=>{return this.creator_ids.md5}
        this.creatorType=()=>{return this.creator_ids.ag_type}
        this.creatorPid=()=>{return this.creator_ids.pid}
        this.creatorPpid=()=>{return this.creator_ids.ppid}
        this.creatorApid=()=>{return this.creator_ids.apid}
        //@ creator_ids = {ag_type: "launcher", ag_pid:3245, ...} - это идентификаторы того агента, который подключился первым отностилеьно конкретного хоста-машины
		this.instance = function(creator_ids, hostCluster){
            console.log("HostAsPair.instance(): creator=",creator_ids.ag_type);
            const ag_type = creator_ids.ag_type;
			return new HostAsPair(
				this.launcher.instance((ag_type==="launcher"?creator_ids:undefined), this),
				this.controller.instance((ag_type==="controller"?creator_ids:undefined), this),
				this.connectedAgentsThrottle.instance(),
                this.agentUpdateChain.instance(),
                creator_ids,
                hostCluster
			);
		}
        //@param {Object dto} msg - e.g. {type: 'host_table',host_id: '6e8bc6f1e3ef10adf9dd98617c133110'}
        //@param {Boolean} is_ext_kick - if this event come from some external source or from browser
        this.gui_ctrl=(msg, is_ext_kick)=>{
            if(msg.type == 'host_table'){
                const result = {};
                if(this.launcher.isOnline()){
                    result.launcher = {}
                    result.launcher.agent_type = this.launcher.agentType();
                    result.launcher.agent_pid = this.launcher.agentPid();
                    result.launcher.agent_ppid = this.launcher.agentPpid();
                    result.launcher.agent_apid = this.launcher.agentApid();
                }
                if(this.controller.isOnline()){
                    result.controller = {}
                    result.controller.agent_type = this.controller.agentType();
                    result.controller.agent_pid = this.controller.agentPid();
                    result.controller.agent_ppid = this.controller.agentPpid();
                    result.controller.agent_apid = this.controller.agentApid();
                }
                return result;
            }else if(msg.type=="jobs_config"){
                //@msg = {type: event_type, caller_id: <some id from external Object>, concrete_agent: <agent md5>}
                console.log("HostAspair.gui_ctrl(): '"+msg.type+"'-type msg")
                this.controller.gui_ctrl(msg)
            }else if(msg.type=="list_future_jobs"||msg.type=="drop_future_jobs"){
                console.error("HostAsPair.gui_ctrl(): msg=",util.inspect(msg));
                if(this.controller){
                    this.controller.gui_ctrl(msg, is_ext_kick);
                }
            }else {
                console.error("HostAsPair.gui_ctrl(): unhandled msg type:", msg.type)
                return {};
            }
        }
        //@ param data = {msg:"", ag_type:"launcher", obj:<object of Launcher or Controller>}
        this.gui_news=(data)=>{
            if(!this.browserIoClients){ return console.error("HostAspair.gui_news(): No browserIoClients object "); }
            if(data.msg == "host_born"){
                data.creator_type = this.creatorType();
                data.creator_pid = this.creatorPid();
                data.creator_apid = this.creatorApid();
            }
            data.md5 = this.commonMd5();
            this.browserIoClients.gui_news(data);
            this.externalSource.outcome_burp(data);
        }
        this.run=(browserIoClients, externalSource, SETTINGS)=>{
            this.SETTINGS = SETTINGS;
            this.browserIoClients = browserIoClients;
            this.externalSource = externalSource;
            this.gui_news({msg: "host_born"});
            this.launcher.run(this.browserIoClients, this, this.agentUpdateChain);
            this.controller.run(this.browserIoClients, this, this.agentUpdateChain);
            //this.start_init_timeout(3000);
            this.connectedAgentsThrottle.run(this.launcher, this.controller, this.hostCluster);
            return this;
        }
        this.agent_by_type=(ag_type)=>{
            if(ag_type=="launcher"){return this.launcher}
            else if(ag_type=="controller"){return this.controller}
        }
        this.is_init_timeout=()=>{ return this.is_init_timeout_flag; }
        //@ Здесь решаем, нужно ли обновлять контроллера, если тот  на спец.задании
        this.decide_if_need_update_partner=(connected, partner)=>{
            if(partner == "controller" && this[partner].isSpecialMode()){
                //@ TODO: to plan a delayed update
            }else{
                this.compareCurManifest(connected);
            }
        }
        //@ Сравнить Манифест включает в себя также и обновление партнёра, если есть различия в Манифесте
        this.compareCurManifest=(ag_type)=>{
            this[ag_type].compareCurManifest(this.last_manifest_snapshot()).then(res=>{
                //@res = {compare:false, kill:false, update:false, start:true}
                if(ag_type == "controller"){
                    this[ag_type].doWork();
                }
            }).catch(err=>{
                console.error("HostAsPair: this.launcher.compareCurManifest() Error 1: ",err);
            })
        }
		this.welcomeAgent = (agent_socket, agent_ids, manifest_snapshot, mapped_mans_snapshot)=>{
            this.manifest_snapshot = manifest_snapshot;
            this.mapped_mans_snapshot = mapped_mans_snapshot;
            //@ 1) Проверяем, не происходит ли лишних подключений агентов
            if(this.connectedAgentsThrottle.check(agent_ids).isAllowed()){
                //@ Три компоненты исключающие все коллизии: 1. Есть ли apid 2. Есть ли log 3. находится ли сейчас онлайн агент-партнер?
                const partner_type = (agent_ids.ag_type == "launcher") ? "controller" : "launcher";
                //@ Последний аргумент this.mapped_mans_snapshot нужен только для контроллера
                this[agent_ids.ag_type].welcomeAgent(agent_socket, agent_ids, manifest_snapshot, this[partner_type], this.mapped_mans_snapshot)
                if(this[partner_type].isOnline()){
                    //@ Если партнёр был онлайн, значит осталось скомандовать обновить партнёра(если это нужно), но если партнёр - контроллер и контроллер в спец. режиме, то отложить его обновление
                    this.decide_if_need_update_partner(agent_ids.ag_type, partner_type) //т.е. здесь агент сравнивает манифесты, если надо прибивает, апдейтит, стартует. Но прежде проверяем если это контроллер и он на спец задании, то делаем ему отложенное обновление.
                }else{
                    //@ Такое может быть, если: 
                    //@     а) это начало жизни объекта Хоста, когда человек запустил агента и партнёр не включится без команды мастера
                    //@     б) ВТорой агент вот-вот будет онлайн(имеется ввиду что он просто вторым подключился по сокету)
                    //@     Поэтому: Ждём 1 секунду(для нивелирования рассинхрона по сокету), затем спрашиваем находится ли партнёр на этот раз онлайн. Если нет, значит, смотрим есть ли у агента apid или log. Если есть, то ждём ещё секунду. Если партнёр не появился в сети, значит, надо давать команду на запуск партнёра.
                    setTimeout(()=>{
                        if(this[partner_type].isOnline()){
                            this.decide_if_need_update_partner(agent_ids.ag_type, partner_type);
                        }else{
                            //@ Если через полсекунды партнер НЕ онлайн, то говорим агенту запустить партнера
                            this.compareCurManifest(agent_ids.ag_type)
                        }
                    }, 1000);
                }
            }                
		}
        this.propagateManifestDiff = (mans_diff)=>{
            this.manifest_regular = mans_diff;
            //@ 1) Look For WHom updates intended: manifest looks for 3 dirs: [controller, launcher, other]
            //@ 2.1)  Either for both agents updates
            //@ 2.2)  Or a somebody one
            if(mans_diff.controller && mans_diff.launcher){
                console.log("HostAsPair.propagateManifestDiff() new files in LAUNCHER and CONTROLLER folders");
                this.launcher.propagateManifestDiff(mans_diff).then(res=>{
                    //@res = {is_cnahges:false, is_killed:false, is_updated:false, is_started:true}
                    if(!res.error){
                        this.controller.propagateManifestDiff(mans_diff).then(res=>{
                            console.log("after propagateManifest both agents has updates each other");
                        }).catch(err=>{
                            console.error("HostAsPair: run_agents_after_first_host_init_timeout(): this.controller.propagateManifestDiff() Error 1: ",err);
                        })
                    }else{
                        console.error("HostAsPair.propagateManifestDiff() after launcher propagating error:",res.error);
                    }
                }).catch(err=>{
                    console.error("HostAsPair: run_agents_after_first_host_init_timeout(): this.launcher.propagateManifestDiff() Error 1: ",err);
                })
            }else if(mans_diff.controller || mans_diff.other){
                console.log("HostAsPair.propagateManifestDiff() new files in CONTROLLER or OTHER folders");
                //@ 2.2)  launcher must update controller
                this.launcher.propagateManifestDiff(mans_diff).then(res=>{
                    console.log("HostAsPair: run_agents_after_first_host_init_timeout(): this.launcher.propagateManifestDiff() OK: ",res);
                }).catch(err=>{
                    console.error("HostAsPair: run_agents_after_first_host_init_timeout(): this.launcher.propagateManifestDiff() Error 2: ",err);
                });
            }else if(mans_diff.launcher){
                console.log("HostAsPair.propagateManifestDiff() new files in LAUNCHER folder");
                //@ 2.3)  controller must update launcher
                this.controller.propagateManifestDiff(mans_diff).then(res=>{
                    console.log("HostAsPair: run_agents_after_first_host_init_timeout(): this.controller.propagateManifestDiff() OK: ",res);
                }).catch(err=>{
                    console.error("HostAsPair: run_agents_after_first_host_init_timeout(): this.controller.propagateManifestDiff() Error 2: ",err);
                });
            }else{
                console.error("HostAsPair: run_agents_after_first_host_init_timeout(): this.propagateManifestDiff() Unknown Error!");
            }
            
        }
        this.propagateMappedMansDiff=(mans_diff)=>{
            this.controller.propagateMappedMansDiff(mans_diff).then(res=>{
                console.log("HostAsPair: run_agents_after_first_host_init_timeout(): this.controller.propagateMappedMansDiff() OK: ",res);
            }).catch(err=>{
                console.error("HostAsPair: run_agents_after_first_host_init_timeout(): this.controller.propagateMappedMansDiff() Error 2: ",err);
            });
        }
        this.agent_disconnected=(ag_type, reason)=>{
            if((!this.launcher.isOnline())&&(!this.controller.isOnline())){
                this.hostCluster.host_destroyed(this.commonMd5());
            }else if(ag_type=="controller" && this.launcher.isOnline()){
                this.launcher.partner_offline(reason);
            }else if(ag_type=="launcher" && this.controller.isOnline()){
                this.controller.partner_offline(reason);
            }
        }
	}
    function ConnectedAgentsThrottle(){
        this.redundantAgentsArray=[];
        this.launcher=undefined;
        this.controller=undefined;
        this.current_ids = undefined;
        //@--------------------
        this.is_current_agent_allowed = true;
        this.isAllowed=()=>{
            console.log("ConnectedAgentsThrottle.isAllowed(): is_current_agent_allowed = ", this.is_current_agent_allowed)
            if(this.is_current_agent_allowed == false){
                const host = this.hostCluster.host_by_md5_only_read(this.current_ids);
                const agent = host.agent_by_type(this.current_ids.ag_type)
                if(agent){ console.log("ConnectedAgentsThrottle.isAllowed(): finded agent:", agent.agentPid(), agent.agentPpid(), agent.agentApid()) }
                agent.kill_similar_outcasts();
            }
            return this.is_current_agent_allowed;
        }
        this.switchCurrentAgentAllowed=(is_allowed)=>{this.is_current_agent_allowed=is_allowed}
        //@--------------------
        this.instance=()=>{return new ConnectedAgentsThrottle()}
        this.run=(launcher, controller, hostCluster)=>{
            this.launcher=launcher;
            this.controller=controller;
            this.hostCluster=hostCluster;
        }
        this.check=(agent_ids)=>{
            this.current_ids = agent_ids;
            const ag_type = agent_ids.ag_type;
            if(["launcher", "controller"].includes(ag_type)){
                //@ so if one Agent already exist and there is coming one more the same Agent, In fact, we prohibit duplicates.
                if(this[ag_type].isOnline()){
                    this.switchCurrentAgentAllowed(false);
                    console.error("ConnectedAgentsThrottle: Agent dublicated: ", Object.values(agent_ids).join("|"));
                }else{
                    this.switchCurrentAgentAllowed(true);
                }
            }else{
                this.switchCurrentAgentAllowed(false);
                console.error("ConnectedAgentsThrottle: Unknow Agent type: ",agent_ids);
                return this;
            }
            return this;
        }
    }
    //@------------------Launcher-----------------------
    function Launcher(agent_ids){
        this.agent_ids = agent_ids;
        this.partner = undefined;//welcomeAgent
        this.agentUpdateChain = undefined;//run
        this.agent_socket = undefined;
        this.manifest_snapshot = undefined;
        this.browserIoClients =undefined; //run
        this.host =undefined; //run
        this.flags = {}//add_flags
        //@ input param 'msg' must be String type
        this.gui_news=(data)=>{
            if(this.host){
                data.agent_type = this.agentType();
                if(data.msg == 'agent_online'){
                    data.agent_pid = this.agentPid();
                    data.agent_ppid = this.agentPpid();
                    data.agent_apid = this.agentApid();
                }
                this.host.gui_news(data);
            }
        }
        this.run=function(browserIoClients, host, agentUpdateChain){
            this.browserIoClients = browserIoClients;
            this.agentUpdateChain = agentUpdateChain.instance();
            this.host = host;
        }
        //@----------------------------
        this.agentType=()=>{return (this.agent_ids) ? this.agent_ids.ag_type : "launcher"}
        this.agentPid=()=>{return (this.agent_ids) ? this.agent_ids.pid : undefined}
        this.agentPpid=()=>{return (this.agent_ids) ? this.agent_ids.ppid : undefined}
        this.agentApid=()=>{return (this.agent_ids) ? this.agent_ids.apid : undefined}
        this.socketio=()=>{return this.agent_socket}
        //@----------------------------
        this.is_online_flag = false;
		this.isOnline=function(){return this.is_online_flag}
		this.switchOnline=function(is_online){this.is_online_flag=is_online}
        //@----------------------------
        this.is_update_mode_flag=false;
        this.isUpdateMode=()=>{return this.is_update_mode_flag}
        this.switchUpdateMode=(is_update_mode)=>{this.is_update_mode_flag = is_update_mode}
        //@----------------------------
		this.add_flags=function(flags){ 
            Object.keys(flags).forEach(key=>{
                this.flags[key] = flags[key];
                if(key == "partner_killed_by_reason" && flags[key] == "update"){
                    partner.add_flags({"me_was_killed_by_reason": flags[key]});
                }
            })
        }
		this.instance=function(agent_ids){ return new Launcher(agent_ids); }
		//@ this in fact not some kind of initialization, but simply pass the object
        this.welcomeAgent=(agent_socket, agent_ids, manifest_snapshot, partner)=>{
            this.agent_socket = agent_socket;
            this.agent_ids = agent_ids;//{ag_type, md5, ip, pid, ppid, apid} 
            this.manifest_snapshot = manifest_snapshot;
            this.partner = partner;
            console.log("Launcher.welcomeAgent(): partner online:",partner.isOnline());
            //@------------------------------------
            this.switchOnline(true);
            this.gui_news({msg:"agent_online"});
			this.listenForDisconnect();
		}
        this.listenForDisconnect=()=>{
            this.agent_socket.once('disconnect', (reason)=>{
                console.log("Launcher.listenForDisconnect(): disconnect: reason =", reason);
                this.switchOnline(false);
                this.gui_news({msg:"agent_offline"});
                this.host.agent_disconnected(this.agent_ids.ag_type, this.flags["me_was_killed_by_reason"]);
                this.agent_socket = undefined;
            });
        }
        this.compareCurManifest=(man)=>{
            console.log("Launcher.compareCurManifest(): man=", man);
            return new Promise((resolve,reject)=>{
                this.switchUpdateMode(true);
                this.gui_news({msg:"update_mode", value:"on"});
                const man_for_launcher = {};
                man_for_launcher.controller = man.controller;
                man_for_launcher.other = man.other;
                console.log("Launcher.compareCurManifest(): man_for_launcher=", man_for_launcher);
                this.agentUpdateChain.instance(this, man_for_launcher).run(this.socketio(), this.partner).then(res=>{
                    resolve(res);
                }).catch(err=>{
                    reject(err);
                }).finally(()=>{
                    this.switchUpdateMode(false);
                    this.gui_news({msg:"update_mode", value:"off"});
                })
            });
        }
        //@ launher must check controller's work Mode (normal or special ?)
        this.propagateManifestDiff=(mans_diff)=>{
            //@ Special Mode - E.g. COntroller Doing a Render
            return new Promise((resolve,reject)=>{
                if(this.partner && !this.partner.isSpecialMode()){
                    this.switchUpdateMode(true);
                    this.gui_news({msg:"update_mode", value:"on"});
                    const mans_diff_for_launcher = {};
                    mans_diff_for_launcher.controller = mans_diff.controller;
                    mans_diff_for_launcher.other = mans_diff.other;
                    console.log("-----Launcher.propagateManifestDiff() mans_diff_for_launcher=",mans_diff_for_launcher);
                    new AgentUpdateWithoutCompare(this, mans_diff_for_launcher).run(this.socketio(), this.partner).then(res=>{
                        resolve({is_patched: true});
                    }).catch(err=>{
                        reject({is_patched: false, error: err});
                    }).finally(()=>{
                        this.switchUpdateMode(false);
                        this.gui_news({msg:"update_mode", value:"off"});
                    })
                }else{
                    console.log("Launcher.propagateManifestDiff(): can not update the Controller in Special mode");
                    this.gui_news({msg:"agent_work", value:"can not update the Controller in Special mode"});
                    resolve({is_patched: false, details: "special mode"});
                }
            });
        }
        //@ then partner disconnected - he says it to host - and then host say to partner that partner is offline
        this.partner_offline=(reason)=>{
            this.agent_socket.emit("partner_offline", reason);
        }
        this.kill_similar_outcasts=()=>{
            this.socketio().emit("kill_similar_outcasts", this.agent_ids);
        }
    }
    //@------------------Controller-----------------------
	function Controller(currentControllerMode, jobs, agent_ids, agent){
        this.currentControllerMode = currentControllerMode;
        this.jobs = jobs;
        this.agent_ids = agent_ids;
        this.agent = agent;
        this.partner = undefined;//welcome_agent()
        this.agentUpdateChain = undefined;//init()
        this.agent_socket = undefined;
        this.manifest_snapshot = undefined;
        this.browserIoClients = undefined; //run
        this.host = undefined; //run
        this.flags = {};//add_flags
        this.instance=function(agent_ids){
            return new Controller(
                this.currentControllerMode,
                this.jobs, 
                agent_ids,
                new Agent(agent_ids)
            );
        }
        //@----------------------------
        this.agentType=()=>{return (this.agent_ids) ? this.agent_ids.ag_type : "controller"}
        this.agentPid=()=>{return (this.agent_ids) ? this.agent_ids.pid : undefined}
        this.agentPpid=()=>{return (this.agent_ids) ? this.agent_ids.ppid : undefined}
        this.agentApid=()=>{return (this.agent_ids) ? this.agent_ids.apid : undefined}
        this.socketio=()=>{return this.agent_socket}
        //@----------------------------
        this.is_online_flag = false;
		this.isOnline=function(){return this.is_online_flag}
		this.switchOnline=function(is_online){this.is_online_flag=is_online;}
        //@----------------------------
        this.is_update_mode_flag=false;
        this.isUpdateMode=()=>{return this.is_update_mode_flag}
        this.switchUpdateMode=(is_update_mode)=>{this.is_update_mode_flag = is_update_mode}
        //@----------------------------
        this.is_special_mode_flag=false;
        this.isSpecialMode=()=>{return this.is_special_mode_flag;}
        this.switchSpecialMode=(is_special_mode)=>{this.is_special_mode_flag = is_special_mode;}
        //@----------------------------
		
        this.run=function(browserIoClients, host, agentUpdateChain){
            this.browserIoClients = browserIoClients;
            this.agentUpdateChain = agentUpdateChain.instance();
            //this.normalControllerMode = this.normalControllerMode.instance()
            this.jobs.run();
            this.host = host;
        }
		this.welcomeAgent = (agent_socket, agent_ids, manifest_snapshot, partner, mapped_mans_snapshot)=>{
            console.log("Controller.welcomeAgent(): partner online:",partner.isOnline());
			this.agent_socket = agent_socket;
			this.agent_ids = agent_ids;//{ag_type, md5, ip, pid, ppid, apid} 
			this.manifest_snapshot = manifest_snapshot;
            this.mapped_mans_snapshot = mapped_mans_snapshot;
            this.partner = partner;
            this.switchOnline(true);
            this.gui_news({msg:"agent_online"});
            this.listenForDisconnect();
            this.firstComparingMappedMans(agent_socket, mapped_mans_snapshot).then(res=>{
                console.log("Controller.firstComparingMappedMans() res =", res);
            }).catch(err=>{
                console.error("Controller.firstComparingMappedMans() Error:", err);
            });
		}
        this.add_flags=function(flags){ 
            Object.keys(flags).forEach(key=>{
                this.flags[key] = flags[key];
                if(key == "partner_killed_by_reason" && flags[key] == "update"){
                    this.partner.add_flags({"me_was_killed_by_reason": flags[key]});
                }
            })
        }
        this.listenForDisconnect=()=>{
            this.agent_socket.once('disconnect', (reason)=>{
                this.switchOnline(false);
                console.log("Controller.listenForDisconnect(): disconnect: reason =", reason);
                //@ Todo: higher at the host level - notify externalSource object
                this.gui_news({msg:"agent_offline"});
                this.host.agent_disconnected(this.agent_ids.ag_type, this.flags["me_was_killed_by_reason"]);
                this.jobs.drop_future_jobs();
                //this.specialControllerMode.drop_future_jobs();
                console.log("Controller.listenForDisconnect(): eventNames=", this.agent_socket.eventNames());
                //@ socket.eventNames()
                //@ socket.listeners(event)
                //@ socket.removeAllListeners([event])
                this.agent_socket.removeAllListeners();
                this.agent_socket = undefined;
            });
        }
        this.gui_news=(data, payload)=>{
            if(this.host){
                data.payload = payload;
                data.agent_type = this.agentType();
                if(data.msg == 'agent_online'){
                    data.agent_pid = this.agentPid();
                    data.agent_ppid = this.agentPpid();
                    data.agent_apid = this.agentApid();
                }
                this.host.gui_news(data);
            }
        }
        this.gui_ctrl=(msg, is_ext_kick)=>{
            //console.log("Controller.gui_ctrl(): msg=", msg);
            if(msg.type=="list_future_jobs"){
                this.jobs.list_future_jobs(list=>{
                    console.log("Controller.gui_ctrl(): list_future_jobs=",list);
                    this.gui_news({msg:"list_future_jobs", value:list});
                });
            }else if(msg.type=="drop_future_jobs"){
                this.jobs.drop_future_jobs(msg);
            }else if(msg.type=="jobs_config"){
                //@msg = {type: event_type, caller_id: <some id from external Object>, concrete_agent: <agent md5>}
                console.log("Controller.gui_ctrl(): '"+msg.type+"'-type msg")
                this.jobs.jobs_config(config=>{
                    console.log("Controller.gui_ctrl(): returning jobs config from jobs object")
                    this.gui_news({"jobs_config": config, "caller_id": msg.caller_id});
                });
            }
        }
        //@ this comparing promote, when master first time welcome the Agent
        this.compareCurManifest=(man)=>{
            console.log("Controller.compareCurManifest(): man=", man);
            return new Promise((resolve,reject)=>{
                this.switchUpdateMode(true);
                this.gui_news({msg:"update_mode", value:"on"});
                const man_for_controller = {};
                man_for_controller.launcher = man.launcher;
                this.agentUpdateChain.instance(this, man_for_controller).run(this.socketio(), this.partner).then(res=>{
                    resolve(res);
                }).catch(err=>{
                    reject(err);
                }).finally(()=>{
                    this.switchUpdateMode(false);
                    this.gui_news({msg:"update_mode", value:"off"});
                    //this.doNormalWork();
                })
            });
        }
        this.propagateManifestDiff=(mans_diff)=>{
            return new Promise((resolve,reject)=>{
                this.switchUpdateMode(true);
                this.gui_news({msg:"update_mode", value:"on"});
                const mans_diff_for_controller = {};
                mans_diff_for_controller.launcher = mans_diff.launcher;
                new AgentUpdateWithoutCompare(this, mans_diff_for_controller).run(this.socketio(), this.partner).then(res=>{
                    resolve({is_patched: true});
                }).catch(err=>{
                    reject({is_patched: false, error: err});
                }).finally(()=>{
                    this.switchUpdateMode(false);
                    this.gui_news({msg:"update_mode", value:"off"});
                    //this.doNormalWork();
                })
            });
        }
        this.firstComparingMappedMans=(agent_socket, mapped_mans_snapshot)=>{
            //@ {"x":{dst_path:"C:/Temp", man:[[f1], [f2]]}}
            return new Promise((resolve,reject)=>{
                this.gui_news({msg:"agent_work", value:"first doing mapped manifestos changes"});
                const EV_NAME = "firstComparingMappedMans";
                const resolve_handler = function(res){resolve(res);}
                agent_socket.emit(EV_NAME, mapped_mans_snapshot).once(EV_NAME, resolve_handler);
                setTimeout(()=>{
                    agent_socket.removeListener(EV_NAME, resolve_handler);
                    reject(EV_NAME+" timeout. ");
                }, 5000);
            });
        }
        this.propagateMappedMansDiff=(mans_diff)=>{
            return new Promise((resolve,reject)=>{
                this.gui_news({msg:"agent_work", value:"doing mapped manifestos changes"});
                const EV_NAME = "updateMappedPaths";
                const resolve_handler = function(res){resolve(res);}
                this.agent_socket.emit(EV_NAME, mans_diff).once(EV_NAME, resolve_handler);
                setTimeout(()=>{
                    this.agent_socket.removeListener(EV_NAME, resolve_handler);
                    reject(EV_NAME+" timeout. ");
                }, 5000);
            });
        }
        this.doWork=()=>{
            if(this.currentControllerMode.mode() == 'special'){
                //@ Special Mode: for example some Render operation.
                this.gui_news({msg:"agent_work", value:"resume doing work in a special mode"});
                //this.specialControllerMode.run(this, this.agent_socket);
            }else if(this.currentControllerMode.mode() == 'normal'){
                //@ Normal Mode: 'diskSpace' and so on...
                this.gui_news({msg:"agent_work", value:"resume doing work in a normal mode"});
                //this.normalControllerMode.run(this, this.agent_socket);
            }else{
                this.gui_news({msg:"agent_work", value:"UNKNOWN working mode"}); 
            }
            this.jobs.doWork();
        }
        //@ then partner disconnected - he says it to host - and then host say to partner that partner is offline
        this.partner_offline=(reason)=>{
            this.agent_socket.emit("partner_offline", reason);
        }
        this.kill_similar_outcasts=()=>{
            this.socketio().emit("kill_similar_outcasts", this.agent_ids);
        }
    }
    function CurrentControllermode(){}
    function Agent(agent_ids){
        this.agent_ids = agent_ids;
        this.partner = undefined;//welcome_agent()
        this.agentUpdateChain = undefined;//init()
        this.agent_socket = undefined;
        this.manifest_snapshot = undefined;
        this.browserIoClients = undefined; //run
        this.host = undefined; //run
        this.flags = {};//add_flags
        //this.agentType=()=>{return (this.agent_ids) ? this.agent_ids.ag_type : "controller"}
        this.agentPid=()=>{return (this.agent_ids) ? this.agent_ids.pid : undefined}
        this.agentPpid=()=>{return (this.agent_ids) ? this.agent_ids.ppid : undefined}
        this.agentApid=()=>{return (this.agent_ids) ? this.agent_ids.apid : undefined}
        this.socketio=()=>{return this.agent_socket}
        this.is_online_flag = false;
        this.isOnline=function(){return this.is_online_flag}
        this.switchOnline=function(is_online){this.is_online_flag=is_online;}
        //@----------------------------
        this.is_update_mode_flag=false;
        this.isUpdateMode=()=>{return this.is_update_mode_flag}
        this.switchUpdateMode=(is_update_mode)=>{this.is_update_mode_flag = is_update_mode}
        //this.is_special_mode_flag=false; //@controller
        this.run=function(browserIoClients, host, agentUpdateChain){
            this.browserIoClients = browserIoClients;
            this.agentUpdateChain = agentUpdateChain.instance();
            this.host = host;
            //this.normalControllerMode = this.normalControllerMode.instance() //@controller
        }
        this.gui_news=(data, payload)=>{
			if(this.host){
					data.payload = payload;
					data.agent_type = this.agentType();
					if(data.msg == 'agent_online'){
							data.agent_pid = this.agentPid();
							data.agent_ppid = this.agentPpid();
							data.agent_apid = this.agentApid();
					}
					this.host.gui_news(data);
			}
	    }
        //@ then partner disconnected - he says it to host - and then host say to partner that partner is offline
        this.partner_offline=(reason)=>{
                this.agent_socket.emit("partner_offline", reason);
        }
        this.kill_similar_outcasts=()=>{
                this.socketio().emit("kill_similar_outcasts", this.agent_ids);
        }
    }
    //@----------------AgentUpdateChain------------------------
    function AgentUpdateChain(creator, manifest){
        this.manifest=manifest;
        this.instance=(creator, manifest)=>{return new AgentUpdateChain(creator, manifest)}
        this.short_names = ["start", "update", "kill", "compare"];
        this.run=(socket, partner)=>{
            return new Promise((resolve,reject)=>{
                new StartingPartner(
                    new UpdatingFiles(
                        new KillingPartner(
                            new CompareManifest()
                        )
                    )
                ).run(socket, creator, partner, this.manifest).then(res=>{
                    resolve(res);
                }).catch(err=>{
                    reject(err);
                })
            });
        }
    }
    function AgentUpdateWithoutCompare(creator, mans_diff){
        this.mans_diff=mans_diff;
        this.instance=(mans_diff)=>{return new AgentUpdateWithoutCompare(creator, mans_diff)}
        this.run=(socket, partner)=>{
            return new Promise((resolve,reject)=>{
                new StartingPartner(
                    new UpdatingDiffFiles(
                        new KillingPartnerWithoutComparing()
                    )
                ).run(socket, creator, partner, this.mans_diff).then(res=>{
                    resolve(res);
                }).catch(err=>{
                    reject(err);
                })
            });
        }
    }
    function StartingPartner(updatingFiles){
        this.updatingFiles=updatingFiles;
        //this.instance=()=>{return new StartingPartner(this.updatingFiles.instance())}
        this.run=(socket, creator, partner, man_or_mans_diff)=>{
            console.log("StartingPartner.run() creator is ", creator.agentType());
            return new Promise((resolve,reject)=>{
                this.updatingFiles.run(socket, creator, partner, man_or_mans_diff).then(chain_msg=>{
                    console.log("StartingPartner.run(): after updatingFiles chain_msg= ",JSON.stringify(chain_msg));
                    if(chain_msg.is_updated){
                        if(partner && partner.isOnline()){
                            //@ TODO: May be TIMEOUT HERE on 100 ms ???
                            const extended_msg = Object.assign(chain_msg, {updated_msg:"partner is already started"});
                            creator.gui_news({msg:"agent_work", value:"partner is already started"});
                            resolve(extended_msg);
                        }else{
                            creator.gui_news({msg:"agent_work", value:"starting the partner..."});
                            this.start_partner(socket).then(start_msg=>{
                                console.log("StartingPartner.run(): start_partner().then: res= ",start_msg);
                                const extended_msg = Object.assign(chain_msg, start_msg);
                                creator.gui_news({msg:"agent_work", value:"the partner is started"});
                                resolve(extended_msg);
                            }).catch(err=>{
                                creator.gui_news({msg:"agent_work", value:"fail to start the partner: "+err});
                                reject("StartingPartner: cant start partner. "+err);
                            });
                        }
                    }else{
                        if(chain_msg.is_error){
                            console.error("StartingPartner.run(): after updatingFiles error: ", chain_msg.error);
                        }else if(chain_msg.err_names && chain_msg.err_names.length){
                            console.error("StartingPartner.run(): after updatingFiles AGENT CANT COPY FILES: ", chain_msg.err_names);
                        }else{
                            console.log("StartingPartner.run(): after updatingFiles chain_msg(2)=", JSON.stringify(chain_msg));
                        }
                        reject("StartingPartner: fail after updatingFiles, chain_msg=", chain_msg);
                    }
                }).catch(err=>{
                    reject("StartingPartner: error on prev step 'updatingFiles': "+err);
                })
            });
        }
        this.start_partner=(socket)=>{
            return new Promise((resolve,reject)=>{
                const resolve_handler = function(start_msg){resolve(start_msg);}
                socket.emit("startPartner").once("startPartner", resolve_handler);
                setTimeout(()=>{
                    socket.removeListener("startPartner",resolve_handler);
                    reject("startPartner timeout. ");
                }, 5000);
            })
        }
    }
    function UpdatingDiffFiles(killingPartner){
        this.killingPartner=killingPartner;
        //this.instance=()=>{return new UpdatedDiffFiles(this.killingPartner.instance())}
        this.run=(socket, creator, partner, mans_diff)=>{
            console.log("UpdatedDiffFiles.run() creator is ", creator.agentType());
            return new Promise((resolve,reject)=>{
                this.killingPartner.run(socket, creator, partner, mans_diff).then(chain_msg=>{
                    creator.gui_news({msg:"agent_work", value:"Starting update the files"});
                    console.log("UpdatedDiffFiles.run() before update_files() calling");
                    this.update_diff_files(socket, mans_diff).then(update_msg=>{
                        console.log("UpdatedDiffFiles.run() after update_files update_msg=",update_msg);
                        creator.gui_news({msg:"agent_work", value:"the updating files was replaced"});
                        //@ expect that update_msg will be equals {is_updated:true}
                        const extended_msg = Object.assign(chain_msg, update_msg);
                        console.log("UpdatedDiffFiles.run() extended_msg=",extended_msg);
                        resolve(extended_msg);
                    }).catch(err=>{
                        creator.gui_news({msg:"agent_work", value:"fail to update the files: "+err});
                        reject("UpdatedDiffFiles: "+err);
                    });
                }).catch(err=>{
                    reject("UpdatedDiffFiles->killingPartner rejected: "+err);
                })
            });
        }
        this.update_diff_files=(socket, mans_diff)=>{
            return new Promise((resolve,reject)=>{
                const EV_NAME = "updateDiffFiles";
                const resolve_handler = function(res){resolve(res);}
                socket.emit(EV_NAME, mans_diff).once(EV_NAME, resolve_handler);
                setTimeout(()=>{
                    socket.removeListener(EV_NAME, resolve_handler);
                    reject(EV_NAME+" timeout. ");
                }, 5000);
            })
        }
    }
    function UpdatingFiles(killingPartner){
        this.killingPartner=killingPartner;
        //this.instance=()=>{return new UpdatingFiles(this.killingPartner.instance())}
        this.run=(socket, creator, partner, manifest)=>{
            console.log("UpdatingFiles.run() creator is ", creator.agentType());
            return new Promise((resolve,reject)=>{
                this.killingPartner.run(socket, creator, partner, manifest).then(chain_msg=>{
                    if(chain_msg.is_changes){
                        creator.gui_news({msg:"agent_work", value:"Starting update the files"});
                        console.log("UpdatingFiles.run() before update_files() calling");
                        this.update_files(socket, manifest).then(update_msg=>{
                            console.log("UpdatingFiles.run() after update_files update_msg=",update_msg);
                            creator.gui_news({msg:"agent_work", value:"the updating files was replaced"});
                            const extended_msg = Object.assign(chain_msg, update_msg);
                            console.log("UpdatingFiles.run() extended_msg=",extended_msg);
                            resolve(extended_msg);
                        }).catch(err=>{
                            creator.gui_news({msg:"agent_work", value:"fail to update the files: "+err});
                            reject("UpdatingFiles: "+err);
                        });
                    } else{
                        const extended_msg = Object.assign(chain_msg, {is_updated:true});
                        resolve(extended_msg);
                    }
                }).catch(err=>{
                    reject("UpdatingFiles: error on prev step 'killingPartner': "+err);
                })
            });
        }
        this.update_files=(socket, manifest)=>{
            return new Promise((resolve,reject)=>{
                const EV_NAME = "updateFiles";
                const resolve_handler = function(res){resolve(res);}
                socket.emit(EV_NAME, manifest).once(EV_NAME, resolve_handler);
                setTimeout(()=>{
                    socket.removeListener(EV_NAME, resolve_handler);
                    reject(EV_NAME+" timeout. ");
                }, 5000);
            })
        }
    }
    function OperationWithAttempts(operation, attempts){
        this.operation=operation;
        this.attempts=attempts;
        this.instance=(operation, attempts)=>{
            return new OperationWithAttempts(operation, attempts);
        }
        this.run=(args)=>{
            return new Promise((resolve,reject)=>{
                this.attempt(args, (err,res)=>{
                    if(err)reject(err);
                    else resolve(res)
                });
            });
        }
        this.attempt=(man, socket, cb)=>{
            killingPartner.run(man, socket).then(res=>{
                cb(undefined, res);
            }).catch(err=>{
                if(--this.attempts>0){
                    this.attempt(man, socket, cb);
                }
            })
        }
    }
    function KillingPartnerWithoutComparing(){
        this.run=(socket, creator, partner, manifest)=>{
            console.log("KillingPartnerWithoutComparing.run() creator is ", creator.agentType());
            return new Promise((resolve,reject)=>{
                console.log("KillingPartnerWithoutComparing.run(): creator=", creator);
                const cond2 = (partner) ? partner.isOnline() : false; //partner must be online, otherwise nothing to kill
                const cond3 = (creator.agentType()=="launcher") ? partner.isSpecialMode() : false; // if special mode kinda 'render' when we can't kill
                if(cond2 & !cond3){
                    creator.gui_news({msg:"agent_work", value:"sending kill signal with pid "+partner.agentPid()});
                    console.log("KillingPartner: sending kill signal, pid=",partner.agentPid());
                    this.kill_partner(socket, partner.agentPid(), partner.agentPpid()).then(kill_msg=>{
                        creator.gui_news({msg:"agent_work", value:"the partner was killed"});
                        resolve(kill_msg);
                        //resolve(Object.assign(kill_msg, {is_changes: true}));
                    }).catch(err=>{
                        creator.gui_news({msg:"agent_work", value:"fail to kill the partner: "+err});
                        reject(err);
                    })
                }else{
                    resolve({})
                }
            });
        }
        this.kill_partner=(socket, pid, ppid)=>{
            return new Promise((resolve,reject)=>{
                const resolve_handler = function(res){
                    console.log("KillingPartnerWithoutComparing.kill_partner() answer=", res);
                    resolve(res||{is_killed:true});
                }
                socket.emit("killPartner", {pid, ppid}).once("killPartner", resolve_handler);
                setTimeout(()=>{
                    socket.removeListener("kill_partner",resolve_handler);
                    reject("KillingPartner: kill_partner timeout. ");
                }, 5000);
            })
        }
    }
    function KillingPartner(compareManifest){
        //@ must deside 3 things: 1) is partner exist 2) is need to update him 3) if partner is controller and is it in special mode
        this.compareManifest=compareManifest;
        //this.instance=()=>{return new KillingPartner(this.compareManifest.instance())}
        this.run=(socket, creator, partner, manifest)=>{
            return new Promise((resolve,reject)=>{
                this.compareManifest.run(socket, creator, partner, manifest).then(compare_msg=>{
                    if(compare_msg.is_error){
                        return reject(compare_msg.error); // agent cant compare normally
                    }
                    const cond1 = compare_msg.is_changes; //changes must exist, otherwise no need to kill
                    const cond2 = (partner) ? partner.isOnline() : false; //partner must be online, otherwise nothing to kill
                    const cond3 = (creator.agentType()=="launcher") ? partner.isSpecialMode() : false; // if special mode kinda 'render' when we can't kill
                    console.log("KillingPartner: conditions:",cond1,cond2,!cond3);
                    if(cond1 && cond2 && !cond3){
                        creator.gui_news({msg:"agent_work", value:"sending kill signal with pid "+partner.agentPid()});
                        console.log("KillingPartner: sending kill signal, pid=",partner.agentPid());
                        this.kill_partner(socket, partner.agentPid(), partner.agentPpid()).then(kill_msg=>{
                            //@ TODO: data like 'is_error' can get lost by next chained msg
                            creator.gui_news({msg:"agent_work", value:"the partner was killed"});
                            creator.add_flags({partner_killed_by_reason:"update"});
                            const extended_msg = Object.assign(compare_msg, kill_msg);
                            resolve(extended_msg);
                        }).catch(err=>{
                            creator.gui_news({msg:"agent_work", value:"fail to kill the partner: "+err});
                            reject(err);
                        })
                    }else{
                        console.log("KillingPartner: No nedd to Kill");
                        resolve(compare_msg);
                    }
                }).catch(err=>{
                    reject("KillingPartner: error on prev step 'comparing': "+err);
                }).finally(()=>{
                    
                })
            });
        }
        this.kill_partner=(socket, pid, ppid)=>{
            return new Promise((resolve,reject)=>{
                const resolve_handler = function(res){resolve(res||{is_killed:true});}
                socket.emit("killPartner", {pid, ppid}).once("killPartner", resolve_handler);
                setTimeout(()=>{
                    socket.removeListener("kill_partner",resolve_handler);
                    reject("KillingPartner: kill_partner timeout. ");
                }, 5000);
            })
        }
    }
    function CompareManifest(){
        //this.instance=()=>{ return new CompareManifest() }
        this.run=(socket, creator, partner, manifest)=>{
            console.log("CompareManifest.run()...");
            return new Promise((resolve,reject)=>{
                let is_ok = false;
                const resolve_handler = function(compare_msg){
                    //@ compare_msg = {is_error: false, is_changes: true}
                    console.log("CompareManifest.run(): compare_msg=",JSON.stringify(compare_msg));
                    is_ok = true;
                    resolve(compare_msg);
                }
                creator.gui_news({msg:"agent_work", value:"sending Manifest to compare..."});
                socket.emit('compareManifest', manifest).once('compareManifest', resolve_handler);
                setTimeout(()=>{
                    if(!is_ok){ 
                        creator.gui_news({msg:"agent_work", value:"CompareManifest: timeout while comparing the Manifest"}); 
                        socket.removeListener("compareManifest",resolve_handler);
                        reject("CompareManifest timeout. ");
                    }
                }, 5000);
            })
        }
    }    
    //@--------------------------------------
    function SpecialControllerMode(){
        this.run=(controller, agent_socket)=>{
            console.log("SpecialControllerMode.run()...");
        }
    }
    function NormalControllerMode(jobs){
        this.jobs=jobs;
        this.agent_socket=undefined; //run()
        this.instance=()=>{return new NormalControllerMode(jobs)}
        this.drop_future_jobs=(msg, cb)=>{
            this.jobs.drop_future_jobs(msg, is_ok=>{
                if(cb){cb(is_ok)}
            });
        }
        this.list_future_jobs=(cb)=>{
            this.jobs.list_future_jobs(list=>{
                //@ answer to Controller.gui_ctrl()
                if(typeof cb=='function'){cb(list)}
            });
        }
        this.jobs_config=(cb)=>{
            console.log("NormalControllerMode.jobs_config()...")
            if(typeof cb=='function'){
                cb(this.jobs.jobs_config());
            }
        }
        this.run=(controller, agent_socket)=>{
            this.agent_socket =agent_socket;
            console.log("NormalControllerMode.run()...");
            this.jobs = this.jobs.instance().run(controller, this.agent_socket);
        }
    }
    //@ ----CONTROLLER'S JOBS--------------
    function Jobs(specialControllerMode, normalControllerMode, _schedule){
        this.schedule = _schedule;
        this.specialControllerMode = specialControllerMode;
        this.normalControllerMode = normalControllerMode;
        this.jobsSchedule = undefined;
        this.agent_socket=undefined; //run()
        this.controller=undefined;//run
        this.jobsChaining=undefined;//run
        this.jobChainsFromInitJobs=undefined;//go
		this.jobs_config=()=>{
            console.log("Jobs.jobs_config(): returning schedule...")
            return this.schedule;
        }
		this.instance=()=>{
            if(this.jobsSchedule){
                return new Jobs(this.jobsSchedule.clone())
            }else if(this.schedule){
                return new Jobs(JSON.parse(JSON.stringify(this.schedule)))
            }else{console.error("Jobs.instance(): NO SCHEDULE!!!")}
        }
		this.run=(controller, agent_socket)=>{
            this.jobsSchedule = new JobsSchedule(this.schedule).run();
            this.agent_socket = agent_socket;
            this.controller = controller;
            if(this.schedule){
                this.go();
            }else{
                console.error("No schedule!");
                return [];
            }
            return this;
		}
        this.go=()=>{
            this.jobChainsFromInitJobs = new JobChainsFromInitJobs(
                new InitialJobChain(),
                new ExtendedJob(),
                new IntervalJobs(),
                new DelayedJobs().init()
            ).run(this.jobsSchedule, this.controller, this.agent_socket);
        }
        this.drop_future_jobs=(msg, cb_ok)=>{
            if(this.jobChainsFromInitJobs){
                this.jobChainsFromInitJobs.drop_future_jobs(msg, (ok)=>cb_ok(ok));
            }else{
                console.error("Jobs.drop_future_jobs() NO jobChainsFromInitJobs")
            }
        }
        this.list_future_jobs=(cb)=>{
            //console.error("Jobs.list_future_jobs() jobChainsFromInitJobs =", this.jobChainsFromInitJobs)
            if(this.jobChainsFromInitJobs){
                this.jobChainsFromInitJobs.list_future_jobs(list=>{
                    //@ answer to 'NormalControllerMode' object
                    if(typeof cb=='function'){cb(list)}
                });
            }else{
                console.error("Jobs.list_future_jobs() NO jobChainsFromInitJobs")
            }
        }
        function JobsSchedule(schedule){
            this.schedule = schedule;
            this.run=()=>{
                return this;
            }
            this.clone=()=>{
                if(this.schedule){
                    return JSON.parse(JSON.stringify(this.schedule))
                }
            }
            this.initJobs=()=>{
                if(this.schedule){
                    return this.schedule.init.filter(job_id=>typeof job_id=="string" && job_id != "");
                }else{
                    console.error("JobsSchedule.initJobs(): NO SCHEDULE!")
                    return [];
                }
            }
            //@param {Array} job_ids = <array of unique jobs ids>
            this.del_jobs=(job_ids)=>{
                if(!Array.isArray(job_ids)){
                    job_ids = [job_ids];
                }
                job_ids.forEach(job_id=>{
                    delete this.schedule.jobs[job_id];
                })
            }
            //@ param {String} job_id = e.g. "disk_space_lte_25" || "nvidia_exist"
            this.tuple_by_job_id=(job_id)=>{
                return this.schedule.jobs[job_id];
            }
        }
	}
    function JobChainsFromInitJobs(initialJobChain, extendedJob, intervalJobs, delayedJobs){
        this.jobsSchedule = undefined;//run
        this.run=(jobsSchedule, controller, agent_socket)=>{
            this.jobsSchedule = jobsSchedule;
            jobsSchedule.initJobs().forEach(job_id=>{
                initialJobChain.instance(job_id, extendedJob, intervalJobs, delayedJobs).run(this.jobsSchedule, controller, agent_socket);
            });
            return this;
        }
        this.drop_future_jobs=(msg)=>{
            //@ Остановка конкретной работы или всех будущих работ.
            if(msg&&msg.job_info){
                if(msg.job_info.interval){
                    intervalJobs.drop_future_jobs(msg.job_info.job_id);
                }else if(msg.job_info.delay){
                    delayedJobs.drop_delayed_jobs(msg.job_info.job_id);
                }else{console.error("JobsChaining.drop_future_jobs(): 'interval' or 'delay' expected")}
                this.jobsSchedule.del_jobs([msg.job_info.job_id])
            }else{
                this.jobsSchedule.del_jobs(intervalJobs.drop_future_jobs().last_dropped_jobs());
                this.jobsSchedule.del_jobs(delayedJobs.drop_delayed_jobs().last_dropped_jobs())
            }
        }
        //this.drop_future_jobs=(msg)=>{}
        this.list_future_jobs=(cb)=>{
            const interval_list = intervalJobs.list_future_jobs();
            const delayed_list = delayedJobs.list_delayed_jobs();
            const list = interval_list.concat(delayed_list);
            console.log("JobsChaining.list_future_jobs(): interval and delay list lengths=",list.length);
            //@ answer to 'Jobs' object
            if(typeof cb == 'function'){cb(list)}
            else{console.error("JobsChaining.list_future_jobs(): cb is not a function!")}
        }
    }
    function InitialJobChain(job_id, extendedJob, intervalJobs, delayedJobs){
        this.job_id = job_id;
        this.jobsSchedule = undefined;//run
        this.instance=(job_id, extendedJob, intervalJobs, delayedJobs)=>{
            return new InitialJobChain(job_id, extendedJob, intervalJobs, delayedJobs);
        }
        this.run=(jobsSchedule, controller, agent_socket)=>{
            this.jobsSchedule = jobsSchedule;
            this.controller = controller;
            this.agent_socket = agent_socket;
            send_next_job(this.job_id);
        }
        const send_next_job=(next_job_id)=>{
            //@ e.g. next_job_id = 'stop_lte_25'
            //@ e.g. job_tuple = "stop_lte_25": {"type":"stop", "target_job_id":"disk_space_lte_25"}
            //const job_tuple = this.schedule.jobs[next_job_id];
            const job_tuple = this.jobsSchedule.tuple_by_job_id(next_job_id);
            if(!job_tuple) return console.error("JobsChaining.send_next_job(): No such job",next_job_id );
            if(job_tuple.type == "stop"){
                //@ delete this.schedule.jobs[job_tuple.target_job_id].interval;
                console.log("JobsChaining.send_next_job() stop-type job:",job_tuple);
                const job_id_to_stop = job_tuple.target_job_id;
                const job_to_stop = this.jobsSchedule.tuple_by_job_id(job_id_to_stop);
                if(typeof job_to_stop == 'object'){
                    //delete job_to_stop.interval;                    
                    intervalJobs.stopIntervalJob(job_id_to_stop);
                }else console.error("JobsChaining.send_next_job() no such job in jobs_config:", job_to_stop);
            }
            else if(job_tuple.type != "stop"){
                console.log("JobsChaining.send_next_job(): job id:",next_job_id);
                if(intervalJobs.exist(next_job_id)){
                    console.error("JobsChaining.send_next_job() Error: such interval jobs already exist:", next_job_id);
                }else{
                    const new_job = extendedJob.instance()
                    .init(next_job_id, job_tuple, this.controller, this.agent_socket, intervalJobs, delayedJobs);
                    if(new_job){
                        new_job.onAnswer(ans=>{
                            if(ans.is_socket_answered){
                                if(ans.next_action){
                                    console.log("JobsChaining.send_next_job(): next action=", ans.next_action);
                                    send_next_job(ans.next_action);
                                }
                            }else{
                                //@ most likely - socket response timeout
                                console.error("JobsChaining.send_next_job() error:", ans, ", on job_id:",next_job_id);
                            }
                        }).run();
                    }else{
                        console.error("JobsChaining.send_next_job(): next job was not created for: ", next_job_id);
                    }
                }
            }
        }
    }
    function JobsChaining(jobsInit, extendedJob, intervalJobs, delayedJobs){
        this.jobsInit = jobsInit;
        this.extendedJob = extendedJob;
        this.intervalJobs = intervalJobs;
        this.delayedJobs = delayedJobs;
        this.jobConditionChecking = new JobConditionChecking();
        this.schedule = undefined;//run
        this.controller = undefined;//run
        this.agent_socket = undefined;//run
        this.run=(schedule, controller, agent_socket)=>{
            this.schedule = schedule;
            this.controller = controller;
            this.agent_socket = agent_socket;
            this.jobsInit.run(schedule, controller, agent_socket, this.extendedJob, this.intervalJobs).onNext((next_job_id, chain_finish_job_id)=>{
                console.log("JobsChaining.run(): onNext(): next_job_id=",next_job_id);
                if(next_job_id){
                    send_next_job(next_job_id);
                }else{
                    console.log("JobsChaining.run() onNext: chain has finished for:", chain_finish_job_id)
                }
            });
            return this;
        }
        this.drop_future_jobs=(msg)=>{
            console.error("NormalControllerMode.drop_future_jobs(): msg=",util.inspect(msg));
            if(msg&&msg.job_info){
                if(msg.job_info.interval){
                    this.intervalJobs.drop_future_jobs(msg.job_info.job_id);
                }else if(msg.job_info.delay){
                    this.delayedJobs.drop_delayed_jobs(msg.job_info.job_id);
                }else{console.error("JobsChaining.drop_future_jobs(): 'interval' or 'delay' expected")}
            }else{
                this.intervalJobs.drop_future_jobs();
                this.delayedJobs.drop_delayed_jobs();
            }
        }
        this.list_future_jobs=(cb)=>{
            const interval_list = this.intervalJobs.list_future_jobs();
            const delayed_list = this.delayedJobs.list_delayed_jobs();
            console.log("JobsChaining.list_future_jobs(): delayed_list=",delayed_list, "typeof=", typeof delayed_list);
            console.log("JobsChaining.list_future_jobs(): interval and delay list lengths=",interval_list.length, delayed_list.length);
            const list = interval_list.concat(delayed_list);
            console.log("JobsChaining.list_future_jobs(): future jobs list=",list);
            //@ answer to 'Jobs' object
            if(typeof cb == 'function'){cb(list)}
            else{console.error("JobsChaining.list_future_jobs(): cb is not a function!")}
        }
        const send_next_job=(next_job_id)=>{
            //@ e.g. next_job_id = 'stop_lte_25'
            //console.log("JobsChaining.send_next_job(): next_job_id=",next_job_id);
            //@ e.g. next_job_tuple = "stop_lte_25": {"type":"stop", "target_job_id":"disk_space_lte_25"}
            const next_job_tuple = this.schedule.jobs[next_job_id];
            if(!next_job_tuple) return console.error("JobsChaining.send_next_job(): No such job",next_job_id );
            if(next_job_tuple.type == "stop"){
                //@ delete this.schedule.jobs[next_job_tuple.target_job_id].interval;
                console.log("JobsChaining.send_next_job() stop-type job:",next_job_tuple);
                const job_id_to_stop = next_job_tuple.target_job_id;
                const job_to_stop = this.schedule.jobs[job_id_to_stop];
                if(typeof job_to_stop == 'object'){
                    //delete job_to_stop.interval;                    
                    this.intervalJobs.stopIntervalJob(job_id_to_stop);
                }else console.error("JobsChaining.send_next_job() no such job in jobs_config:", job_to_stop);
            }
            else if(next_job_tuple.type != "stop"){
                console.log("JobsChaining.send_next_job(): calling job:",next_job_id);
                if(this.intervalJobs.exist(next_job_id)){
                    console.error("JobsChaining.send_next_job() Error: such interval jobs already exist:", next_job_id);
                }else{
                    const new_job = this.extendedJob.instance()
                    .init(next_job_id, next_job_tuple, this.controller, this.agent_socket, this.intervalJobs, this.delayedJobs);
                    if(new_job){
                        new_job.onAnswer(ans=>{
                            if(ans.is_socket_answered){
                                if(ans.next_action){
                                    console.log("JobsChaining.send_next_job(): next action=", ans.next_action);
                                    send_next_job(ans.next_action);
                                }
                            }else{
                                //@ most likely - socket response timeout
                                console.error("JobsChaining.send_next_job() error:", ans, ", on job_id:",next_job_id);
                            }
                        }).run();
                    }else{
                        console.error("JobsChaining.send_next_job(): next job was not created for: ", next_job_id);
                    }
                }
            }
        }
    }
    function JobsInit(){
        this.schedule=undefined;//run
        this.controller=undefined;//run
        this.agent_socket=undefined;//run
        this.extendedJob=undefined;//run
        this.intervalJobs=undefined;//run
        this.jobConditionChecking = new JobConditionChecking();
        this.cbNext=()=>{console.error("JobsInit.cbNext() not implemented")}
        this.run=(schedule, controller, agent_socket, extendedJob, intervalJobs)=>{
            this.schedule = schedule;
            this.controller = controller;
            this.agent_socket = agent_socket;
            this.extendedJob = extendedJob;
            this.intervalJobs = intervalJobs;
            start_initial_jobs(schedule, controller, agent_socket, extendedJob, intervalJobs);
            return this;
        }
        this.onNext=(cb)=>{
            if(typeof cb == 'function'){this.cbNext = cb;}
            else{console.error("JobsInit.onNext(): callback is not a function!");}
        }
        const start_initial_jobs=(schedule, controller, agent_socket, extendedJob, intervalJobs)=>{
            if(!Array.isArray(schedule.init)) return console.error("ERROR: NO 'init' key in jobs_config! ");
            schedule.init.forEach(job_id=>{
                console.log("JobsInit.start_initial_jobs() schedule.jobs[job_id]=", schedule.jobs[job_id]);
                //@ Может вернуть объект работы или undefined.
                const new_job = extendedJob.instance().init(job_id, schedule.jobs[job_id], controller, agent_socket, intervalJobs);
                if(new_job){
                    new_job.onAnswer(ans=>{
                        if(ans.is_socket_answered){
                            if(ans.next_action){
                                console.log("JobsInit.start_initial_jobs(): next action=", ans.next_action);
                                this.cbNext(ans.next_action);
                            }else{
                                this.cbNext(false, job_id);
                            }
                        }else{
                            console.error("JobsInit.start_initial_jobs(): '",job_id,"' job error:", ans.err_type);
                        }
                    }).run();
                }else{
                    console.log("JobsInit.start_initial_jobs()")
                }
            });
        }
    }
    function JobsAdding(){
        this.add=(job, is_run_immediatly)=>{
            cbArray.forEach(cb=>{
                cb(job, is_run_immediatly);
            });
        }
        const cbArray = [];
        this.onAdd=(cb)=>{
            cbArray.push(cb);
        }
    }
    function ExtendedJob(){
        this.instance=()=>{
            return new ExtendedJob();
        }
        this.init=(job_id, job_tuple, controller, agent_socket, intervalJobs, delayedJobs)=>{
            if(!job_tuple) return console.error("ExtendedJob.run(): No such job_name",job_id);
            console.log("ExtendedJob.run() job_id=", job_id);
            console.log("ExtendedJob.run() job_tuple=", job_tuple);
            let delayedOrIntervalJob;
            if(job_tuple.interval){
                //@ Todo: add a check that if such Interval Job(with same id) already spin, do not start a new one. OR! delete old and start renewed one, with new conditions !?
                if(intervalJobs.exist(job_id)){
                    console.error("ExtendedJob.init() Error: such interval job already exist:", job_id);
                }else{
                    delayedOrIntervalJob = new OneIntervalJob(job_id, job_tuple, controller, agent_socket);
                    intervalJobs.add(job_id, delayedOrIntervalJob);
                }
            }else if(!job_tuple.interval){
                delayedOrIntervalJob = new OneJob(job_id, job_tuple, controller, agent_socket);
                //@ if job in jobs_config.json has a 'delay' key
                if(job_tuple.delay){
                    //@ Философская проблема заключается в том, что сейчас мы позволяем добавлять бесконечное число отложенных работ с одинаковым id. Тогда, если в delayedJobs будут добавляться такие дубликаты, то мы будем добавлять к их id-шнику инкрементое число через решетку типа disk_25#2
                    console.log("ExtendedJob.init() adding '"+ job_id+"' job to delayedJobs");
                    delayedJobs.add(job_id, delayedOrIntervalJob);
                }
            }
            return delayedOrIntervalJob;
        }
    }
    //@ object through which we store an array of interval jobs and can control them
    function IntervalJobs(){
        const _interval_jobs = {};
        var _last_dropped_jobs = [];
        this.add=(job_key, intervalJob)=>{
            _interval_jobs[job_key] = intervalJob;
        }
        this.stopIntervalJob=(job_id)=>{
            console.log("IntervalJobs.stopIntervalJob() job_id:",job_id);
            if(_interval_jobs[job_id]){
                _interval_jobs[job_id].break_interval();
                delete _interval_jobs[job_id];
                //console.error("IntervalJobs.stopIntervalJob(): now interval_jobs=", Object.keys(_interval_jobs));
            }else{
                //console.error("IntervalJobs.stopIntervalJob(): no such interval_job:", job_id, "interval_jobs=", Object.keys(_interval_jobs));
            }
        }
        this.exist=(job_key)=>{
            if(_interval_jobs[job_key]) return true;
            else return false;
        }
        this.last_dropped_jobs=()=>{return _last_dropped_jobs}
        this.drop_future_jobs=(job_id)=>{
            _last_dropped_jobs = [];
            if(job_id){
                console.error("IntervalJobs.drop_future_jobs() job_id=", job_id)
                _interval_jobs[job_id].break_interval();
                delete _interval_jobs[job_id];
                _last_dropped_jobs = [job_id];
            }else{
                Object.keys(_interval_jobs).forEach(job_id=>{
                    _last_dropped_jobs.push(job_id);
                    _interval_jobs[job_id].break_interval();
                    delete _interval_jobs[job_id];
                });
            }
            return this;
            //console.log("IntervalJobs.drop_future_jobs(): _interval_jobs=",JSON.stringify(_interval_jobs));
        }
        this.list_future_jobs=()=>{
            //console.log("IntervalJobs.list_future_jobs(): _interval_jobs=",JSON.stringify(_interval_jobs));
            const out_list = [];
            for (var prop in _interval_jobs) {
                const interval_now = _interval_jobs[prop].interval_now();
                const out_obj = {"interval": interval_now};
                out_obj.job_id = prop;
                out_list.push(out_obj);
            }
            return out_list;
        }
    }
    function DelayedJobs(){
        let _delayed_jobs = {};
        const check_interval = 5000;
        var _last_dropped_jobs = [];
        this.last_dropped_jobs=()=>{return _last_dropped_jobs}
        this.init=()=>{
            setInterval(()=>{
                console.log("DelayedJobs.init() _delayed_jobs = ", Object.keys(_delayed_jobs))
                for(let i in _delayed_jobs){
                    if(_delayed_jobs[i].delay_now() < 0){
                        delete _delayed_jobs[i];
                    }
                }
            }, check_interval);
            return this;
        }
        this.add=(job_key, Job)=>{
            const cur_keys = Object.keys(_delayed_jobs);
            if(cur_keys.includes(job_key)){
                job_key = _generate_new_job_key(job_key, cur_keys)
            }
            _delayed_jobs[job_key] = Job;
        }
        this.list_delayed_jobs=()=>{
            const out_list = [];
            for (var prop in _delayed_jobs) {
                const delay_now = _delayed_jobs[prop].delay_now();
                const out_obj = {"delay": delay_now};
                out_obj.job_id = prop;
                out_list.push(out_obj);
            }
            return out_list;
        }
        this.drop_delayed_jobs=(job_id)=>{
            _last_dropped_jobs = [];
            //@ if passed concrete job id, then delete only this job
            if(job_id){
                if(_delayed_jobs[job_id]){
                    _delayed_jobs[job_id].break_delay_timeout();
                    delete _delayed_jobs[job_id];
                    _last_dropped_jobs.push(job_id);
                }else{
                    console.error("DelayedJobs.drop_delayed_jobs(): no such '"+job_id+"' job. ")
                }
            }
            //@ else if not passed concrete job id, then delete all delayed jobs
            else{
                Object.keys(_delayed_jobs).forEach(job_id=>{
                    _last_dropped_jobs.push(job_id);
                    _delayed_jobs[job_id].break_delay_timeout();
                    delete _delayed_jobs[job_id];
                });
            }
            return this;
        }
        const _generate_new_job_key=(job_key, cur_keys, next_index)=>{
            const index = next_index || 2;
            const try_job_key = job_key + "#" + index;
            if(cur_keys.includes(try_job_key)){
                return _generate_new_job_key=(job_key, cur_keys, index+1)
            }else{
                return try_job_key;
            }
        }
    }
    //function OneIntervalJob(job_id, job, controller, agent_socket){}
    function OneIntervalJob(job_id, job_tuple, controller, agent_socket){
        this.job_id = job_id;
        let _job_timeout_ref = undefined;
        let _interval_start_date = undefined;
        let _cbAnswer=()=>{console.error("OneJob.cbAnswer() not implemented")}
        this.oneJob = new OneJob().instance(job_id, job_tuple, controller, agent_socket)
            //return new OneIntervalJob(job_id, job_tuple, controller, agent_socket);
        this.break_interval=()=>{
            console.log("OneIntervalJob.break_interval() job id =", this.job_id);
            clearInterval(_job_timeout_ref);
        }
        this.interval_now=()=>{
            const timelapse = new Date().getTime() - _interval_start_date;
            return job_tuple.interval - timelapse;
        }
        this.run=()=>{
            console.log("OneIntervalJob.run():");
            _interval_start_date = new Date().getTime();
            this.oneJob.instance(job_id, job_tuple, controller, agent_socket).onAnswer(_cbAnswer).run();
            _job_timeout_ref = setInterval(()=>{
                _interval_start_date = new Date().getTime();
                this.oneJob.instance(job_id, job_tuple, controller, agent_socket).onAnswer(_cbAnswer).run();
            }, job_tuple.interval)
            return this;
        }
        this.onAnswer=(cb)=>{
            _cbAnswer = cb;
            return this;
        }
    }
    //@ oneJob object is binding to one job from jobs_config.json by its id
    function OneJob(job_id, job_tuple, controller, agent_socket){
        this.job_id = job_id;
        this.job_tuple = job_tuple;
        this.controller = controller;
        this.agent_socket = agent_socket;
        this.is_job_minimal_done = false;
        this.delay_timeout=undefined;
        this.socket_silence_timeout = 5000;
        let _timeout_start_date = undefined;
        console.log("OneJob: job_tuple=", job_tuple);
        this.answer_handler = (res)=>{
            const job_type = this.job_tuple.type;
            console.log("OneJob.run(): controller answer =", res, ", job_tuple =",job_tuple);
            //@ this.job_id - this is unique job id like 'disk_space_lte_25'
            if(typeof this.controller.gui_news != 'function'){
                console.error("OneJob.answer_handler(): this.controller.gui_news =", this.controller.gui_news);
            }
            const msg_for_controller = "'"+this.job_id+"' job done";
            this.controller.gui_news({msg:"agent_work", value:msg_for_controller});
            console.log("OneJob.run(): this.is_job_minimal_done =", this.is_job_minimal_done);
            this.is_job_minimal_done = true;
            console.log("OneJob.run(): this.is_job_minimal_done(2) =", this.is_job_minimal_done);
            const jobConditionChecking = new JobConditionChecking();
            if(jobConditionChecking.check(this.job_tuple, res)){
                console.log("OneJob.run(): job with type:", job_type, "PASS condition:", this.job_tuple.condition);
                //@ Если в action одно строковое значение - значит одна следющая задача
                if(typeof this.job_tuple.action == "string"){
                    this.cbAnswer({is_socket_answered: true, next_action: this.job_tuple.action});
                }
                //@ Если в action массив строковых значений - значит несколько следующих задач
                else if(Array.isArray(this.job_tuple.action)){
                    this.job_tuple.action.forEach(nact=>{
                        this.cbAnswer({is_socket_answered: true, next_action: nact});
                    })
                }
                else{
                    this.cbAnswer({is_socket_answered: true, next_action: nact});
                }
            }else{
                console.log("OneJob.run(): job with type:", job_type, "MISMATCH condition:", this.job_tuple.condition);
                this.cbAnswer({is_socket_answered: true});
            }
        }
        this.cbAnswer=()=>{console.error("OneJob.cbAnswer() not implemented")}
        this.instance=(job_id, job_tuple, controller, agent_socket)=>{
            return new OneJob(job_id, job_tuple, controller, agent_socket);
        }
        this.onAnswer=(cb)=>{
            this.cbAnswer = cb;
            return this;
        }
        this.break_delay_timeout=()=>{
            clearTimeout(this.delay_timeout);
        }
        this.delay_now=()=>{
            if(this.job_tuple.delay){
                const timelapse = new Date().getTime() - _timeout_start_date;
                console.log("OneJob: delay_now(): _timeout_start_date=",_timeout_start_date,"timelapse=",timelapse,"this.job_tuple.delay=",this.job_tuple.delay);
                return this.job_tuple.delay - timelapse;
            }else{
                return 0;
            }
        }
        this.run=()=>{
            const job_type = this.job_tuple.type;
            const job_tuple = this.job_tuple;
            console.log("OneJob.run(): emitting event=", JSON.stringify(job_tuple));
            if(Object.keys(job_tuple).length == 0){
                console.error("OneJob.run() Error: Empty job");
                return this.cbAnswer("OneJob.run() Error: Empty job");
            }
            if(this.job_tuple.delay){
                _timeout_start_date = new Date().getTime();
            }
            this.delay_timeout = setTimeout(()=>{
                this.agent_socket.emit(job_type, job_tuple).once(job_type, this.answer_handler);
            }, this.job_tuple.delay||0);
            this.socket_silence_timeout = (this.job_tuple.delay || 0) + 5000;
            setTimeout(()=>{
                if(this.is_job_minimal_done == false){
                    console.log("OneJob.run(): timeout of job:", this.job_tuple.type);
                    //@ socket.eventNames()
                    //@ socket.listeners(event)
                    //@ socket.removeListener(event, listener)
                    //this.agent_socket.removeListener(this.job_tuple.type, this.answer_handler);
                    this.agent_socket.removeAllListeners(this.job_tuple.type);
                    this.cbAnswer({is_socket_answered: false, err_type: "timeout"});
                }
            }, this.socket_silence_timeout)
            return this;
        }
    }
    function JobConditionChecking(){
        this.check=(job, res)=>{
            const job_type = job.type;
            console.log("JobConditionChecking.check() job=", JSON.stringify(job));
            if(!job.action){
                return false;
            }
            else if(job_type=='disk_space'){
                const lowercase_condition = job.condition.toLowerCase();
                const condition_arr = lowercase_condition.split(' ').filter(el=>Boolean(el));
                if(condition_arr.length != 3){
                    return console.error("JobConditionChecking.check() condition must consist of 3 elements, e.g. 'lte 10 gb' in job type: ", job_type);
                }
                if(!['mb','gb','tb'].includes(condition_arr[2])){
                    return console.error("JobConditionChecking.check(): size value must be on of [mb, gb, tb]");
                }
                if(!['lte','gte'].includes(condition_arr[0])){
                    return console.error("JobConditionChecking.check(): comparison value must be on of [lte, gte]");
                }
                const SIZES = {mb: 1000000, gb:1000000000, tb:1000000000000}
                const VALUE = SIZES[condition_arr[2]] * condition_arr[1];
                if(typeof VALUE != 'number'){
                    return console.error("JobConditionChecking.check(): something wrong when getting value:",VALUE);
                }
                console.log("JobConditionChecking.check() VALUE=",VALUE);
                if(condition_arr[0] == 'lte'){
                    console.log("res.free < VALUE:",res.free < VALUE);
                    console.log("typeof res.free:",typeof res.free);
                    console.log("typeof VALUE:",typeof VALUE);
                    if(res.free < VALUE) return true;
                    else return false;
                }else if(condition_arr[0] == 'gte'){
                    if(res.free >= VALUE) return true;
                    else return false;
                }else{
                    console.error("JobConditionChecking.check(): something wrong in comparison value:",condition_arr);
                }
            }
            else if(job_type=='nvidia_smi'){
                if(job.condition == 'is_exist'){
                    return Boolean(res.is_exist);
                }else return true;
            }
            else if(job_type == 'do_render'){
                if(job.condition == 'is_started_render'){
                    return Boolean(res.is_started_render);
                }
            }
            else if(job_type == 'proc_count'){
                console.log("JobConditionChecking.check(): job:",job_type, "res:", res)
                if(job.condition == 'is_1'){
                    if(res.count == 1){return true;}
                    else{return false;}
                }
            }
            else if(job_type == 'exec_cmd'){
                return true;
            }
            else if(job_type == 'my_job1'){
                //@ res - this is the controller's answer through socket.io
                if(res == 5){
                    return true;
                }else{
                    return false;
                }
            }
            else{
                return true;
            }
        }
    }
    //@------------------------------------
    function Microtask(name){
        this.name = name;
        this.done=false;
        this.details="";
        this.detail=(msg)=>{
            this.details=msg;
            return msg;
        }
        this.end=(res)=>{
            this.done=true;
            this.details=res||"no_changes";
            return res;
        }
        this.isDone=()=>{
            return this.done;
        }
    }
    function Interval(fn, time) {
        var timer = false;
        this.start = function () {
            if (!this.isRunning())
                timer = setInterval(fn, time);
        };
        this.stop = function () {
            clearInterval(timer);
            timer = false;
        };
        this.isRunning = function () {
            return timer !== false;
        };
    }

	//@ ready=1
	function HttpServer(webRequest, settings){
        this.http = undefined;
		this.run = ()=>{
            webRequest.init();
			this.http = require('http').createServer(webRequest.handler.bind(webRequest)).listen(settings.port);
			return this;
		}
	}

    function IoConfig(SETTINGS){
        let io_addr;
        this.io_address =()=>{ 
            if(!io_addr){
                io_addr = (SETTINGS)?("http://"+SETTINGS.host+":"+SETTINGS.port):("http://localhost:55999");
            }
            return io_addr;
        }
    }

    function Pages(){
        const _map = {};
        this.with=(req_path, page)=>{
            _map[req_path] = page;
            return this;
        }
        this.asText=async function(request_path, response){
            let _body = "404: page not found";
            for(let r in _map){
                if(request_path === r){
                    _body = await _map[r].asText(response);
                    break;
                }
            }
            return _body;
        }
    }
    function Page(page_type, data){   
        console.log("new Page '"+page_type+"'");
        const file_html = new FileFromFs();
        this.asText=async function(response){
            response.statusCode = 200;
            //response.setEncoding('utf8'); //not a function
            response.setHeader("Content-Type", "text/html");
            let html;
            if(page_type === '/'){
                html = await file_html.file(__dirname+ "/visualizer/index.html").catch(er=>{
                    console.error("ERR: Page.asHtml(): cant read file:"+er);
                    response.statusCode = 404;
                });   
            }
            else if(page_type === '/io_address'){
                html = data;
            }
            else if (page_type.endsWith(".js")){
                response.setHeader("Content-Type", "application/json");
                html = await file_html.file(__dirname+ "/visualizer"+page_type).catch(er=>{
                    console.error("ERR: Page.asHtml(): cant read file:"+er);
                    response.statusCode = 404;
                });  
			}
            return(html)?(html):"404: page not found";
        }
    } 

    function FileFromFs(){
        this.cache = undefined;
        this.file=(filepath)=>{
            return new Promise((resolve,reject)=>{
                // if(this.cache){
                //     console.log("return cached file "+filepath);
                //     resolve(this.cache)}
                // else{
                    fs.readFile(path.normalize(filepath), (err, res)=>{
                        if (err) { reject("Server file read error:",err);}
                        else{
                            this.cache = res;
                            resolve(res);
                        }
                    });
                // }
            });
        }
    }
	
	//@ ready=1
	function WebRequest(pages){
        this.a = 5;
        this.io_address = "";
        this.init=()=>{
            return this;
        }
		this.handler = async function(request, response){
            this.a--;
			let parts = url.parse(request["url"], true);
			//@ parts.pathname = "/" || "/some.js" || "/route1" 
            const body = await pages.asText(parts.pathname, response);
            response.end(body);
		}
	}
    

	
    
	function Logger(){
        const logger = {};

        logger.run = function(admin){
            
        }
        logger.log = function(msg){
            console.log(">>>" + msg);
        }
        return logger;
    }
    

// ----------- TEST -----------
function mainTest(){
    const http = require('http').createServer(webRequest).listen(55999);
    this.io = require('socket.io')(http);
    this.io.on('connection', agent => {
        console.log("io.connection event: agent="+Object.keys(agent));
    });
}
function dirStructureSyncTest(){
    const dirStructure = new DirStructure();
    const res = dirStructure.manOfDirSync("./update");
    console.log(res);
}
function dirsComparingTest(){
    const glob_update_path = SETTINGS.update_folder || "./update";
    const launcher_update_path = glob_update_path + "\\launcher";
    const controller_update_path = glob_update_path + "\\controller";
    const other_update_path = glob_update_path + "\\other";
    const dirStructure = new DirStructure();
    const res= dirStructure.allMansSync([
        {name:"controller", path:controller_update_path},
        {name:"launcher", path:launcher_update_path},
        {name:"other", path:other_update_path}
    ]);
    setTimeout(()=>{console.log("res=",res);}, 1000)
}

  




//------------------------------
// EXTERNAL FUNCTIONS
//------------------------------

function req_res_func(request, response)
{
	console.log('request ', request.url);
	var filePath = '.' + request.url;
    if (filePath == './') {
        filePath = './index.html';
    }
	var mimeTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.woff': 'application/font-woff', '.ttf': 'application/font-ttf', '.eot': 'application/vnd.ms-fontobject', '.otf': 'application/font-otf', '.wasm': 'application/wasm' };
	var extname = String(path.extname(filePath)).toLowerCase();
	var contentType = mimeTypes[extname] || 'application/octet-stream';
	fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT') {
                fs.readFile('./404.html', function(error, content) {
                    response.writeHead(404, { 'Content-Type': 'text/html' });
                    response.end(content, 'utf-8');
                });
            }
            else {
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
            }
        }
        else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
}

function config_app(app)
{
	app.disable('x-powered-by');
	app.use(function (req, res, next)
	{
		res.setHeader("Access-Control-Allow-Origin", WEB_FULL_NAME);
		res.setHeader('Access-Control-Allow-Credentials', true);
		res.setHeader("X-Frame-Options", "DENY");
		res.setHeader("X-XSS-Protection", "1");
		res.setHeader("Cache-Control", "no-store");
		res.setHeader("default-src", "none");
		next();
	});
}

function read_json_sync(json_path)
{
	try	{
        json_path = path.normalize(json_path);
		//const json = fs.readFileSync(json_path, "utf8");
		let settings = JSON.parse(fs.readFileSync(json_path, "utf8"));
		if (settings) return settings;
		else {
			console.error("read_json_sync(): wrong settings data in ", json_path)
			return {error: "wrong settings data"};
		}
	}
	catch (e) {
		console.error("read_json_sync(): JSON PARSE ERROR: ", e);
		return {error: e};
	}
}
