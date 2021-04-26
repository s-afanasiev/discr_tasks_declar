    //master.js
    'use sctrict';
    const util = require('util');
    const path = require('path');
    const url = require('url');
    const fs = require('fs');
    const EventEmitter = require('events');
    const log = require('./log.js');
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
    //@ При включении сервера к нему должны сразу начать подключаться Лончеры и КОнтролеры, 
    //@ которые автоматические реконектятся. За исключением самого превого развертывания, когда 
    //@ Лончеров запускает человек и Контроллеры будут запущены после соотв. команды от сервера Лончеру
    //@ Хост создаётся, как только появляется хотя бы один из Агентов.
    //@ Затем ожидание 5 сек. - большая вилка - либо Контроллер подключился, либо нет.
    //@ Вывод из этой вилки такой: 
    //@ 1) Агент работает только один на машине. Варианты кем он запущен:
    //@     а) это агент запущенный человеком (более вероятно для Лончера) б) Агент запущен Партнером 
    //@     Оба эти варианты распознаются по apid. Если пустой - значит человеком, а если нет - Партнером
    //@ 2) Агенты работают оба. В каких они могут быть состояниях:
    //@     а) они работают штатно и хорошо. Просто мы перезапускали сервер.
    //@     б) они хранят свой статус, что они делали в последний раз, 
    //@         например: "получил команду kill" или "выполнил команду kill", "выполнил команду start"
    //@ Итого: Сервер спрашивает -> какой у тебя текущий статус?
    //@         Агент говорит: "выполнил команду kill" или "я запущен человеком и ещё ничего не делал"
    //@        статусы: "firstime_started manually", "firstime_started by <apid>"
    //@                 "doing_command compareManifest", "complete_command killPartner"
    //@        каждый Агент присылает сообщение, что он щас делает или сделал.
    //@        * соответственно можно общаться через один сокет:
    //@        ** сервер посылает "сравни" -> ответ "сравнил!" -> "kill" -> "killed" -> "update"
    //@        ** -> "updated" -> "start" -> "started". Партнер: "first_started by <apid>"
    //@ ---------------ПРАВИЛЬНЫЙ ВАРИАНТ:--------------------------------
    //@ ТОГДА при произвольном подключении следующий диалог:
    //@ * объект HostAsPair создаётся в момент когда приходит первый агент с данного Хоста.
    //@ ** Далее, он ничего не делает, скажем 5 секунд, набирает кандидатов, отдавая предпочтение
    //@ ** тем Агентам, которые включены не человеком, т.е. те, которые уже работали и чтото-делали
    //@ *** После 5 секунд: имеем на руках чётко 1 или 2 Агента (может быть 0, если подключившийся тутже отвалится)
    //@ ***--- Для этого у Хоста есть счётчик Агентов, который если упал до нуля, то объект Хоста существует просто для истории
    //@ **** Начинаем всегда с Лончера. Ищем его - if(this.launcher.online)
    //@ ***** Вызываем объект Launcher метод makeFullUpdate() и ждём от него Колбэк или Промис.
    //@ ***** Это значит что мы ждём от него полной цепочки по Обновлению, она может состоять от 1 до 4 шагов
    //@ ***** --- в минимальном наборе это: "compare"->"обновлять нечего"->"партнер уже онлайн"
    //@ ***** --- в максимуме: ->"compare"<-"is changes"->"kill"<-"killed"->"update"<-"updated"->"start"<-"started"
    //@ ***** --- вариант 3:   "compare"->"update"->"start" 
    //@ ***** --- вариант 4:   "compare"->"start"
    //@ ***** --- ВОЗВРАЩАЕТ ПРОМИС: Обновление завершено ИЛИ БРОСАЕТ ОШИБКУ: "на этапе 'start' произошёл таймаут при двух попытках"
    //@ ***** ------- СООБЩИТЬ АДМИНИСТРАТОРУ, ЧТО НА ХОСТЕ "X" ОШИБКА.
    //@ ****** Агент отрабатывает задачу по обновлению и возвращают управление Хосту. Тогда Хост говорит Контроллеру - "выполняй текущую работу"
    //@ ****** Если полное обновление совершил Лончер, то теперь говорим сделать тоже самое Контроллеру
    //@ ******* после обоюдного обновления, смотрим не появились ли за это время Регулярные обновления, которые были сложены в коробочку
    //@ ******* если обновлений больше нет, тогда говорим Контроллеру делать текущую работу.

	//@ Application
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
                        ),
                        {port:55999}
                    )
                ),
                new BrowserIoClients(),
                new UpdatableHostCluster(
                    new Manifest(new DirStructure(), new DirsComparing()),
                    new HostCluster(
                        new HostAsPair(
                            new Launcher({}),
                            new Controller(
                                new SpecialControllerMode(),
                                new NormalControllerMode(
                                    new Jobs(JOBS_CONFIG)
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
                    )
                ),
                SETTINGS
            ).run();
        }
	}

    function ZooKeeper(ioServer, browserIoClients, updatableHostCluster, SETTINGS){
        this.ioServer=ioServer;
        this.browserIoClients=browserIoClients;
        this.updatableHostCluster=updatableHostCluster;
        this.run=()=>{
            const stringEndSlash = new StringEndSlash();
            const update_path_with_slash = stringEndSlash.add(SETTINGS.update_folder);
            SETTINGS.update_folder = update_path_with_slash;
            this.browserIoClients.run(this.updatableHostCluster);
            this.updatableHostCluster.run(this.browserIoClients, SETTINGS);
            this.ioServer.run(this.updatableHostCluster, this.browserIoClients);
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

    function BrowserIoClients(){
        this.updatableHostCluster=undefined;
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
                console.log("BrowserIoClients disconnection: "+this.socket.id);
            })
            this.socket.on('gui_ctrl', (msg)=>{
                console.log("BrowserIoClients control_msg: ",msg);
                this.updatableHostCluster.gui_ctrl(msg);
            })
        }
        //@ msg from inside host cluster to outside Browser
        this.gui_news=(data)=>{
            //@ from HostCluster: data={ msg:'host_table', table: [{md5:""},{md5:""}] };
            if(this.socket){
                this.socket.emit('gui_news', data);
            }
        }
    }

    function IoServer(httpServer){
        this.httpServer = httpServer;
        this.updatableHostCluster=undefined;
        this.browserIoClients=undefined;
        this.run=(updatableHostCluster, browserIoClients)=>{
            this.updatableHostCluster = updatableHostCluster;
            this.browserIoClients = browserIoClients;
            require('socket.io')(this.httpServer.run().http).on('connection', (socket) => {
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
                    console.error("UpdatableHostCluster.socketConnected() error: nor browser or agent!");
                }
            });
        }
    }	

    function ParsedJSON(stringifiedJson){
        this.stringifiedJson = stringifiedJson;
        this.run=()=>{return (this.stringifiedJson) ? JSON.parse(this.stringifiedJson) : {}}
    }

    function UpdatableHostCluster(manifest, hostCluster){
        this.manifest = manifest;
        this.hostCluster = hostCluster;
        this.SETTINGS = undefined; //run
        this.run=(browserIoClients, SETTINGS)=>{
            this.hostCluster.run(browserIoClients, SETTINGS);
            this.manifest.run(this.hostCluster, SETTINGS);
            this.SETTINGS = SETTINGS;
        }
        //@ new socket connection from IoServer
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
        this.gui_ctrl=(msg)=>{
            if(msg == "switch_manifest_off"){
                this.manifest.switch_off();
            }else{
                this.hostCluster.gui_ctrl(msg);
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
        this.SETTINGS=undefined;//run
        const _hosts_list = [];
        //this.acceptable_commands = ["welcomeAgent", "guiControl"];
		this.run = (browserIoClients, SETTINGS)=>{
            this.browserIoClients = browserIoClients;
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
                return this.addHost(this.hostAsPair.instance(agent_ids, this).run(this.browserIoClients, this.SETTINGS));
            }
		}
		this.addHost = (agentObj)=>{
            _hosts_list.push(agentObj);
            return agentObj;
        }
        this.gui_ctrl=(msg)=>{
            if(typeof msg != "object"){
                return console.error("HostCluster.gui_ctrl() msg is not an Object: ",msg);
            }
            if(msg.type=='host_table'){
                const result = _hosts_list.map(host=>{
                    let res = {};
                    res.md5 = host.commonMd5();
                    const add_info = host.gui_ctrl(msg.type);
                    res = Object.assign(res, add_info);
                    return res;
                });
                this.browserIoClients.gui_news({msg:'host_table', table: result});
            }else if(msg.type=="apply_updates"){
                if(msg.value == "check"){
                    this.browserIoClients.gui_news({msg:'apply_updates', value: this.SETTINGS.apply_updates});
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
                            this.browserIoClients.gui_news({msg:'apply_updates', value: this.SETTINGS.apply_updates});
                        });
                    }
                }
            }
        }
        //@ host says that all his agents was disconnected, so its equal like host must be recycled
        this.agents_disconnected=(host_md5)=>{
            let host_index = -1;
            for(let i=0; i<_hosts_list.length; i++){
                if(_hosts_list[i].commonMd5() == host_md5){
                    host_index = i;
                }
            }
            console.log("HostCluster.agents_disconnected() _hosts_list length before=", _hosts_list.length);
            if(host_index > -1) _hosts_list.splice(host_index, 1);
            console.log("HostCluster.agents_disconnected() _hosts_list length after=", _hosts_list.length);
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
        this.gui_ctrl=(msg)=>{
            if(msg == 'host_table'){
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
            } else return {};
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
        }
        this.run=(browserIoClients, SETTINGS)=>{
            this.SETTINGS = SETTINGS;
            this.browserIoClients = browserIoClients;
            this.gui_news({msg: "host_born"});
            this.launcher.run(this.browserIoClients, this);
            this.controller.run(this.browserIoClients, this);
            this.start_init_timeout(3000);
            this.connectedAgentsThrottle.init(this.launcher, this.controller);
            return this;
        }
        this.is_init_timeout=()=>{ return this.is_init_timeout_flag; }
        this.start_init_timeout=(time_)=>{
            setTimeout(()=>{
                this.is_init_timeout_flag = true;
                this.run_agents_after_first_host_init_timeout();
            }, time_||3000);
        }
        this.run_agents_after_first_host_init_timeout=()=>{
            this.launcher.init(this.agentUpdateChain.instance());
            this.controller.init(this.agentUpdateChain.instance());
            //@like a first start on the remote machine, when a human starts the launcher
            const l_on = this.launcher.isOnline();
            const c_on = this.controller.isOnline();
            if(l_on && !c_on){
                console.log("HostAsPair: only launcher is online...");
                this.launcher.compareCurManifest(this.last_manifest_snapshot()).then(res=>{
                    //@res = {compare:false, kill:false, update:false, start:true}
                }).catch(err=>{
                    console.error("HostAsPair: this.launcher.compareCurManifest() Error 1: ",err);
                })
            //@ this situation can occur, when both agents was continued to work, but server was restarted.
            }else if(!l_on && c_on){
                console.log("HostAsPair: only controller is online...");
                this.controller.compareCurManifest(this.last_manifest_snapshot()).then(res=>{
                    this.controller.doNormalWork();
                }).catch(err=>{
                    console.error("HostAsPair: this.controller.compareCurManifest() Error 1: ",err);
                })
            }
            else if(l_on && c_on){
                if(this.SETTINGS.apply_updates){
                    console.log("HostAsPair: Launcher and Controller are online...");
                    this.launcher.compareCurManifest(this.last_manifest_snapshot()).then(msg=>{
                        console.log("HostAsPair: after Launcher's comparing result=",msg);
                        //@res = {compare:false, kill:false, update:false, start:true}
                        if(!msg.is_killed){
                            this.controller.compareCurManifest(this.last_manifest_snapshot()).then(res=>{
                                console.log("run_agents_after_first_host_init_timeout(): both agents has updates each other");
                                this.controller.doNormalWork();
                            }).catch(err=>{
                                console.error("HostAsPair: this.controller.compareCurManifest() Error: ",err);
                            })
                        }else{
                            console.error("HostAsPair: l and c was online, then l compared and killed c")
                        }
                    }).catch(err=>{
                        console.error("HostAsPair: this.launcher.compareCurManifest() Error 2: ",err);
                    })
                }else{
                    this.controller.doNormalWork();
                }
            //@-----------------------------------------------------------
            }else{
                console.error("HostAsPair: Unhandled situation! launcher state:", this.launcher.isOnline(), ", controller state:", this.controller.isOnline());
            }
        }
        //@ when first time calling this method
		this.welcomeAgent = (agent_socket, agent_ids, manifest_snapshot, mapped_mans_snapshot)=>{
            this.manifest_snapshot = manifest_snapshot;
            this.mapped_mans_snapshot = mapped_mans_snapshot;
            if(this.connectedAgentsThrottle.adaptConnectedAgent(agent_ids).isAllowed()){
                const ag_type = agent_ids.ag_type;
                if(ag_type=="launcher"){
                    this[ag_type].welcomeAgent(agent_socket, agent_ids, this.manifest_snapshot, this.controller);
                }else if(ag_type=="controller"){
                    this[ag_type].welcomeAgent(agent_socket, agent_ids, this.manifest_snapshot, this.launcher, this.mapped_mans_snapshot);
                }
                //@ first host init and agents update was finished.Now its a new agents connections and new singles comparings.
                if(this.is_init_timeout()){
                    if(this.SETTINGS.apply_updates){
                        this[ag_type].compareCurManifest(this.manifest_snapshot).then(res=>{
                            console.log("HostAsPair.welcomeAgent(): is_init_timeout()",res);
                            if(ag_type=="controller"){
                                this[ag_type].doNormalWork();
                            }
                        }).catch(err=>{
                            console.error("HostAsPair.welcomeAgent() after is_init_timeout() Error2: ", err);
                        });
                    }else{
                        if(ag_type=="controller"){
                            this[ag_type].doNormalWork();
                        }
                    }
                }
            }else{
                console.error("HostAsPair.welcomeAgent(): Throttle blocked the agent! ", Object.values(agent_ids).join("|"));
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
        this.agent_disconnected=(ag_type)=>{
            if((!this.launcher.isOnline())&&(!this.controller.isOnline())){
                this.hostCluster.agents_disconnected(this.commonMd5());
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
        this.isAllowed=()=>{return this.is_current_agent_allowed;}
        this.switchCurrentAgentAllowed=(is_allowed)=>{this.is_current_agent_allowed=is_allowed}
        //@--------------------
        this.instance=()=>{return new ConnectedAgentsThrottle()}
        this.init=(launcher, controller)=>{
            this.launcher=launcher;
            this.controller=controller;
        }
        this.adaptConnectedAgent=(agent_ids)=>{
            this.current_ids = agent_ids;
            const ag_type = agent_ids.ag_type;
            if(["launcher", "controller"].includes(ag_type)){
                this.switchCurrentAgentAllowed(true);
            }else{
                this.switchCurrentAgentAllowed(false);
                console.error("ConnectedAgentsThrottle: Unknow Agent type: ",agent_ids);
                return this;
            }
            //@ so if one Agent already exist and there is coming one more the same Agent, In fact, we prohibit duplicates.
            if(this[ag_type].isOnline()){
                this.switchCurrentAgentAllowed(false);
                console.error("ConnectedAgentsThrottle: Agent dublicated: ", Object.values(agent_ids).join("|"));
            }else{
                this.switchCurrentAgentAllowed(true);
            }
            return this;
        }
        
    }
    //@------------------Launcher-----------------------
    function Launcher(agent_ids){
        this.agent_ids = agent_ids;
        this.partner = undefined;
        this.agentUpdateChain = undefined;//init
        this.agent_socket = undefined;
        this.manifest_snapshot = undefined;
        this.browserIoClients =undefined; //run
        this.host =undefined; //run
        //@ input param 'msg' must be String type
        this.gui_news=(msg)=>{
            if(this.host){
                const agent_msg = {};
                agent_msg.msg = msg;
                agent_msg.agent_type = this.agentType();
                if(msg == 'agent_online'){
                    agent_msg.agent_pid = this.agentPid();
                    agent_msg.agent_ppid = this.agentPpid();
                    agent_msg.agent_apid = this.agentApid();
                }
                this.host.gui_news(agent_msg);
            }
        }
        this.run=function(browserIoClients, host){
            this.browserIoClients = browserIoClients;
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
		this.instance=function(agent_ids){ return new Launcher(agent_ids); }
		//@ this in fact not some kind of initialization, but simply pass the object
        this.init=(agentUpdateChain)=>{
            this.agentUpdateChain = agentUpdateChain;
            return this;
        }
        this.welcomeAgent=(agent_socket, agent_ids, manifest_snapshot, partner)=>{
            this.agent_socket = agent_socket;
            this.agent_ids = agent_ids;//{ag_type, md5, ip, pid, ppid, apid} 
            this.manifest_snapshot = manifest_snapshot;
            this.partner = partner;
            console.log("Launcher.welcomeAgent(): partner online:",partner.isOnline());
            //@------------------------------------
            this.switchOnline(true);
            this.gui_news("agent_online");
			this.listenForDisconnect();
		}
        this.listenForDisconnect=()=>{
            this.agent_socket.once('disconnect', ()=>{
                this.switchOnline(false);
                console.log("LAUNCHER DISCONNECTED");
                this.gui_news("agent_offline");
                this.host.agent_disconnected(this.agent_ids.ag_type);
                this.agent_socket = undefined;
            });
        }
        this.compareCurManifest=(man)=>{
            console.log("Launcher.compareCurManifest(): man=", man);
            return new Promise((resolve,reject)=>{
                this.switchUpdateMode(true);
                this.gui_news("update mode on");
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
                    this.gui_news("update mode off");
                })
            });
        }
        //@ launher must check controller's work Mode (normal or special ?)
        this.propagateManifestDiff=(mans_diff)=>{
            //@ Special Mode - E.g. COntroller Doing a Render
            return new Promise((resolve,reject)=>{
                if(this.partner && !this.partner.isSpecialMode()){
                    this.switchUpdateMode(true);
                    this.gui_news("update mode on");
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
                        this.gui_news("update mode off");
                    })
                }else{
                    console.log("Launcher.propagateManifestDiff(): can not update the Controller in Special mode");
                    this.gui_news("can not update the Controller in Special mode");
                    resolve({is_patched: false, details: "special mode"});
                }
            });
        }
    }
    //@------------------Controller-----------------------
	function Controller(specialControllerMode, normalControllerMode, agent_ids){
        this.specialControllerMode = specialControllerMode;
        this.normalControllerMode = normalControllerMode;
        this.agent_ids = agent_ids;
        this.partner = undefined;//welcome_agent()
        this.agentUpdateChain = undefined;//init()
        this.agent_socket = undefined;
        this.manifest_snapshot = undefined;
        this.browserIoClients = undefined; //run
        this.host = undefined; //run
        this.gui_news=(msg)=>{
            if(this.host){
                const agent_msg = {};
                agent_msg.msg = msg;
                agent_msg.agent_type = this.agentType();
                if(msg == 'agent_online'){
                    agent_msg.agent_pid = this.agentPid();
                    agent_msg.agent_ppid = this.agentPpid();
                    agent_msg.agent_apid = this.agentApid();
                }
                this.host.gui_news(agent_msg);
            }
        }
        this.run=function(browserIoClients, host){
            this.browserIoClients = browserIoClients;
            this.host = host;
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
		this.instance=function(agent_ids){
            return new Controller(
                this.specialControllerMode,
                this.normalControllerMode, 
                agent_ids
            );
        }
        //@ this in fact not some kind of initialization, but simply pass the object
		this.init =(agentUpdateChain)=>{
            this.agentUpdateChain = agentUpdateChain;
            return this;
        }
		this.welcomeAgent = (agent_socket, agent_ids, manifest_snapshot, partner, mapped_mans_snapshot)=>{
            console.log("Controller.welcomeAgent(): partner online:",partner.isOnline());
			this.agent_socket = agent_socket;
			this.agent_ids = agent_ids;//{ag_type, md5, ip, pid, ppid, apid} 
			this.manifest_snapshot = manifest_snapshot;
            this.mapped_mans_snapshot = mapped_mans_snapshot;
            this.partner = partner;
            this.switchOnline(true);
            this.gui_news("agent_online");
            this.listenForDisconnect();
            this.firstComparingMappedMans(agent_socket, mapped_mans_snapshot).then(res=>{
                console.log("Controller.firstComparingMappedMans() res =", res);
            }).catch(err=>{
                console.error("Controller.firstComparingMappedMans() Error:", err);
            });
		}
        this.listenForDisconnect=()=>{
            this.agent_socket.once('disconnect', ()=>{
                this.switchOnline(false);
                console.log("CONTROLLER DISCONNECTED");
                this.gui_news("agent_offline");
                this.host.agent_disconnected(this.agent_ids.ag_type);
                this.agent_socket = undefined;
            });
        }
        //@ this comparing promote, when master first time welcome the Agent
        this.compareCurManifest=(man)=>{
            console.log("Controller.compareCurManifest(): man=", man);
            return new Promise((resolve,reject)=>{
                this.switchUpdateMode(true);
                this.gui_news("update mode on");
                const man_for_controller = {};
                man_for_controller.launcher = man.launcher;
                this.agentUpdateChain.instance(this, man_for_controller).run(this.socketio(), this.partner).then(res=>{
                    resolve(res);
                }).catch(err=>{
                    reject(err);
                }).finally(()=>{
                    this.switchUpdateMode(false);
                    this.gui_news("update mode off");
                    //this.doNormalWork();
                })
            });
        }
        this.propagateManifestDiff=(mans_diff)=>{
            return new Promise((resolve,reject)=>{
                this.switchUpdateMode(true);
                this.gui_news("update mode on");
                const mans_diff_for_controller = {};
                mans_diff_for_controller.launcher = mans_diff.launcher;
                new AgentUpdateWithoutCompare(this, mans_diff_for_controller).run(this.socketio(), this.partner).then(res=>{
                    resolve({is_patched: true});
                }).catch(err=>{
                    reject({is_patched: false, error: err});
                }).finally(()=>{
                    this.switchUpdateMode(false);
                    this.gui_news("update mode off");
                    //this.doNormalWork();
                })
            });
        }
        this.firstComparingMappedMans=(agent_socket, mapped_mans_snapshot)=>{
            //@ {"x":{dst_path:"C:/Temp", man:[[f1], [f2]]}}
            return new Promise((resolve,reject)=>{
                this.gui_news("first doing mapped manifestos changes");
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
                this.gui_news("doing mapped manifestos changes");
                const EV_NAME = "updateMappedPaths";
                const resolve_handler = function(res){resolve(res);}
                this.agent_socket.emit(EV_NAME, mans_diff).once(EV_NAME, resolve_handler);
                setTimeout(()=>{
                    this.agent_socket.removeListener(EV_NAME, resolve_handler);
                    reject(EV_NAME+" timeout. ");
                }, 5000);
            });
        }
        this.doNormalWork=()=>{
            if(this.isSpecialMode()){
                //@ Special Mode: for example some Render operation.
                this.gui_news("resume doing work in a special mode");
                this.specialControllerMode.run(this, this.agent_socket);
            }else{
                //@ Normal Mode: 'diskSpace' and so on...
                this.gui_news("resume doing work in a normal mode");
                this.normalControllerMode.run(this, this.agent_socket);
            }
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
                            creator.gui_news("partner is already started");
                            resolve(extended_msg);
                        }else{
                            creator.gui_news("starting the partner...");
                            this.start_partner(socket).then(start_msg=>{
                                console.log("StartingPartner.run(): start_partner().then: res= ",start_msg);
                                const extended_msg = Object.assign(chain_msg, start_msg);
                                creator.gui_news("the partner is started");
                                resolve(extended_msg);
                            }).catch(err=>{
                                creator.gui_news("fail to start the partner: "+err);
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
                    reject("StartingPartner: updatingFiles throw err: "+err);
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
                    creator.gui_news("Starting update the files");
                    console.log("UpdatedDiffFiles.run() before update_files() calling");
                    this.update_diff_files(socket, mans_diff).then(update_msg=>{
                        console.log("UpdatedDiffFiles.run() after update_files update_msg=",update_msg);
                        creator.gui_news("the updating files was replaced");
                        //@ expect that update_msg will be equals {is_updated:true}
                        const extended_msg = Object.assign(chain_msg, update_msg);
                        console.log("UpdatedDiffFiles.run() extended_msg=",extended_msg);
                        resolve(extended_msg);
                    }).catch(err=>{
                        creator.gui_news("fail to update the files: "+err);
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
                        creator.gui_news("Starting update the files");
                        console.log("UpdatingFiles.run() before update_files() calling");
                        this.update_files(socket, manifest).then(update_msg=>{
                            console.log("UpdatingFiles.run() after update_files update_msg=",update_msg);
                            creator.gui_news("the updating files was replaced");
                            const extended_msg = Object.assign(chain_msg, update_msg);
                            console.log("UpdatingFiles.run() extended_msg=",extended_msg);
                            resolve(extended_msg);
                        }).catch(err=>{
                            creator.gui_news("fail to update the files: "+err);
                            reject("UpdatingFiles: "+err);
                        });
                    } else{
                        const extended_msg = Object.assign(chain_msg, {is_updated:true});
                        resolve(extended_msg);
                    }
                }).catch(err=>{
                    reject("UpdatingFiles->killingPartner rejected: "+err);
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
                    creator.gui_news("sending kill signal with pid "+partner.agentPid());
                    console.log("KillingPartner: sending kill signal, pid=",partner.agentPid());
                    this.kill_partner(socket, partner.agentPid(), partner.agentPpid()).then(kill_msg=>{
                        creator.gui_news("the partner was killed");
                        resolve(kill_msg);
                        //resolve(Object.assign(kill_msg, {is_changes: true}));
                    }).catch(err=>{
                        creator.gui_news("fail to kill the partner: "+err);
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
                    if(cond1 & cond2 & !cond3){
                        creator.gui_news("sending kill signal with pid "+partner.agentPid());
                        console.log("KillingPartner: sending kill signal, pid=",partner.agentPid());
                        this.kill_partner(socket, partner.agentPid(), partner.agentPpid()).then(kill_msg=>{
                            //@ TODO: data like 'is_error' can get lost by next chained msg
                            creator.gui_news("the partner was killed");
                            const extended_msg = Object.assign(compare_msg, kill_msg);
                            resolve(extended_msg);
                        }).catch(err=>{
                            creator.gui_news("fail to kill the partner: "+err);
                            reject(err);
                        })
                    }else{
                        console.log("KillingPartner: No nedd to Kill");
                        resolve(compare_msg);
                    }
                }).catch(err=>{
                    reject("KillingPartner: previous step 'compare' failed. "+err);
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
                creator.gui_news("sending Manifest to compare...");
                socket.emit('compareManifest', manifest).once('compareManifest', resolve_handler);
                setTimeout(()=>{
                    if(!is_ok){ 
                        creator.gui_news("CompareManifest: timeout while comparing the Manifest"); 
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
        this.run=(controller, agent_socket)=>{
            this.agent_socket =agent_socket;
            console.log("NormalControllerMode.run()...");
            this.jobs.run(controller, this.agent_socket);
        }
    }
    //@ ----CONTROLLER'S JOBS--------------
    function Jobs(jobs_schedule){
        this.schedule = jobs_schedule;
        this.agent_socket=undefined; //run()
        this.controller=undefined;//run
		this.run=(controller, agent_socket)=>{
            this.agent_socket = agent_socket;
            this.controller = controller;
            if(!this.schedule){
                console.error("No schedule!");
                return [];
            }else{
                new JobsChaining(
                    new JobsInit(),
                    new JobsAdding(),
                    new ExtendedJob(),
                    new IntervalJobs()
                ).run(this.schedule, this.controller, this.agent_socket);
            }
		}
	}
    function JobsChaining(jobsInit, jobsAdding, extendedJob, intervalJobs){
        this.jobsInit = jobsInit;
        this.jobsAdding = jobsAdding;
        this.extendedJob = extendedJob;
        this.intervalJobs = intervalJobs;
        this.jobConditionChecking = new JobConditionChecking();
        this.schedule = undefined;//run
        this.controller = undefined;//run
        this.agent_socket = undefined;//run
        this.run=(schedule, controller, agent_socket)=>{
            this.schedule = schedule;
            this.controller = controller;
            this.agent_socket = agent_socket;
            this.jobsAdding.onAdd((job, is_run_immediatly)=>{});
            this.jobsInit.run(schedule, controller, agent_socket, this.extendedJob, this.intervalJobs).onNext(next_job_id=>{
                console.log("JobsChaining.run(): onNext(): next_job_id=",next_job_id);
                send_next_job(next_job_id);
            });
        }
        const send_next_job=(next_job_id)=>{
            console.log("JobsChaining.send_next_job(): next_job_id=",next_job_id);
            const next_job_tuple = this.schedule.jobs[next_job_id];
            console.log("JobsChaining.send_next_job(): next_job_tuple=",next_job_tuple);
            if(!next_job_tuple) return console.error("JobsChaining.send_next_job(): No such job",next_job_id );
            if(next_job_tuple.type == "stop"){
                //@ delete this.schedule.jobs[next_job_tuple.type_param].interval;
                const job_id_to_stop = next_job_tuple.type_param;
                const job_to_stop = this.schedule.jobs[job_id_to_stop];
                if(typeof job_to_stop == 'object'){
                    delete job_to_stop.interval;
                    this.intervalJobs.stopIntervalJob(next_job_id);
                }else console.error("JobsChaining.send_next_job()");
            }else{
                console.log("JobsChaining.send_next_job(): calling to new job...");
                this.extendedJob.instance()
                .run(next_job_id, this.schedule.jobs[next_job_id], this.controller, this.agent_socket, this.intervalJobs)
                .onAnswer(ans=>{
                    if(ans.is_socket_answered){
                        if(ans.next_action){
                            send_next_job(ans.next_action);
                        }
                    }else{
                        //@ most likely - socket response timeout
                        console.error("JobsChaining.send_next_job(): oneJob.onAnswer() error:", ans.err_type);
                    }
                });
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
            if(typeof cb == 'function'){
                this.cbNext = cb;
            }else{
                console.error("JobsInit.onNext(): callback is not a function!");
            }
        }
        const start_initial_jobs=(schedule, controller, agent_socket, extendedJob, intervalJobs)=>{
            if(!Array.isArray(schedule.init)) return console.error("ERROR: NO 'init' key in jobs_config! ");
            schedule.init.forEach(job_id=>{
                //console.log("JobsInit.start_initial_jobs() job_id=", job_id);
                extendedJob.instance()
                .run(job_id, schedule.jobs[job_id], controller, agent_socket, intervalJobs)
                .onAnswer(ans=>{
                    if(ans.is_socket_answered){
                        console.log("JobsInit.start_initial_jobs(): socket answered");
                        if(ans.next_action){
                            console.log("JobsInit.start_initial_jobs(): next action=", ans.next_action);
                            this.cbNext(ans.next_action);
                        }
                    }else{
                        console.error("JobsInit.start_initial_jobs(): oneJob.onAnswer() error:", ans.err_type);
                    }
                });
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
        this.run=(job_id, job_tuple, controller, agent_socket, intervalJobs)=>{
            console.log("ExtendedJob.run() job_id=", job_id);
            console.log("ExtendedJob.run() job_tuple=", job_tuple);
            let oneTypedJob;
            if(job_tuple.interval){
                oneTypedJob = new OneIntervalJob(job_id, job_tuple, controller, agent_socket);
                intervalJobs.add(job_id, oneTypedJob);
            }else{
                oneTypedJob = new OneJob(job_id, job_tuple, controller, agent_socket);
            }
            console.log("ExtendedJob.run() returning oneJob=", oneTypedJob);
            return oneTypedJob.run();
        }
    }
    function IntervalJobs(){
        const _interval_jobs = {};
        this.add=(job_key, oneJob)=>{
            _interval_jobs[job_key] = job;
        }
        this.stopIntervalJob=(job_id)=>{
            if(_interval_jobs[job_id]){
                _interval_jobs[job_id].break_interval();
            }
        }
    }
    //function OneIntervalJob(job_id, job, controller, agent_socket){}
    function OneIntervalJob(oneJob){
        this.job_id = job_id;
        let _job_timeout_ref = undefined;
        this.oneJob = new OneJob();
        this.instance=(job_id, job, controller, agent_socket)=>{
            return new OneIntervalJob(job_id, job, controller, agent_socket);
        }
        this.break_interval=()=>{
            clearTimeout(_job_timeout_ref);
        }
        this.run=()=>{
            this.oneJob.instance(job_id, job, controller, agent_socket).run();
            _job_timeout_ref = setTimeout(()=>{
                this.oneJob.instance(job_id, job, controller, agent_socket).run();
            }, job_info.interval)
            return this;
        }
        this.onAnswer=(cb)=>{
            this.oneJob.onAnswer(cb);
            return this;
        }
    }
    //@ oneJob object is binding to one job from jobs_config(aka schedule) by its id
    function OneJob(job_id, job_tuple, controller, agent_socket){
        this.job_id = job_id;
        this.job_tuple = job_tuple;
        this.controller = controller;
        this.agent_socket = agent_socket;
        this.is_job_minimal_done = false;
        this.cbUnit = new CbUnit();
        this.instance=(job_id, job, controller, agent_socket)=>{
            return new OneJob(job_id, job, controller, agent_socket);
        }
        this.onAnswer=(cb)=>{
            this.cbUnit.mem(cb);
            return this;
        }
        this.run=()=>{
            const job_type = this.job_tuple.type;
            console.log("OneJob.run(): emitting event=", job_type);
            this.agent_socket.emit(job_type).once(job_type, res=>{
                console.log("OneJob.run(): controller answer =", res);
                this.controller.gui_news("'"+job_type+"' job done");
                this.is_job_minimal_done = true;
                const jobConditionChecking = new JobConditionChecking();
                if(jobConditionChecking.check(this.job_tuple, res)){
                    //console.log("Jobs checking condition = true");
                    this.cbUnit.summ({is_socket_answered: true, next_action: this.job_tuple.action});
                }else{
                    this.cbUnit.summ({is_socket_answered: true});
                }
            });
            setTimeout(()=>{
                if(this.is_job_minimal_done == false){
                    this.cbUnit.summ({is_socket_answered: false, err_type: "timeout"});
                }
            }, 5000)
            return this;
        }
    }
    function CbUnit(){
        this.instance=()=>{
            return new cbUnit();
        }
        this.summ=()=>{
            console.error("cbUnit.summ() not implemented")
        }
        this.mem=(cb)=>{
            if(typeof cb == 'function'){
                this.summ = cb;
            }else{
                console.error("OneJob.onAnswer(): callback is not a function!");
            }
        }
    }
    function JobConditionChecking(){
        this.check=(job, res)=>{
            const job_type = job.type;
            console.log("JobConditionChecking.check() job=", JSON.stringify(job));
            if(job_type=='disk_space'){
                const GB = 1000000000;
                if(job.condition == 'lte 1 gb'){
                    if(res.free < GB) return true;
                    else return false;
                }
                else if(job.condition == 'gte 100 gb'){
                    if(res.free > GB*100) return true;
                    else return false;
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

  


    function init_data_structures(){
        var tables = {};
        tables.JOBS = init_structure_jobs();
        tables.JVF = init_structure_jvf(); 
        tables.JSSF = init_structure_jssf(); 
        tables.JSF = init_structure_jsf(); 
        tables.JCF = init_structure_jcf(); 
        tables.JTF = init_structure_jtf(); 
        tables.JEF = init_structure_jef(); 
    }
    //---------------------------
    //--------Your Fortran-------
    //---------------------------
function init_structure_jobs(){
    return JOBS =      {      
        // Use this function like first greeting to Controller and if he answered, then put him new tasks 
        void_controller: 
        { 
            //? what if error answer
            "if_err": ["sample_err_1"],
            "if_timeout": ["sample_timeout_1"],
            //? what if normal answer (it doesn't matter if it's good or bad, but there are no errors)
            "if_answer": 
            [
                { //? means controller ready to receive other JOBS
                    "validate":"is_true",
                    "if_true": [ 5000, "disk_space", "nvidia_smi", "proc_count", "return_" ],
                    "if_false": []
                },
                { 
                    "novalidate": [ "sample_function_1", 200, "sample_function_2" ]
                }
            ]
        },
        void_launcher: 
        { 
            //? what if error answer
            "if_err": ["sample_err_1"],
            "if_timeout": ["sample_timeout_1"],
            //? what if normal answer (it doesn't matter if it's good or bad, but there are no errors)
            "if_answer": 
            [
                { //? means master successfully initialized and ready to make another jobs
                    "validate":"is_true",
                    "if_true": [10000],
                    "if_false": []
                },
            ]
        },
        void_all:
        {
            //? what if error answer
            "if_err": ["sample_err_1"],
            "if_timeout": ["sample_timeout_1"],
            //? what if normal answer (it doesn't matter if it's good or bad, but there are no errors)
            "if_answer": 
            [
                { //? means master successfully initialized and ready to make another jobs
                    "validate":"is_true",
                    "if_true": [10000/*, 'find_alone_agents'*/],
                    "if_false": []
                },
                { 
                    "novalidate": [30000, "check_same_md5"]
                }
            ]
        },
        void_master:
        {
            master: true,
            template:{timeout: 15000, blocking: false, aging: 600000},
            "if_err": ["sample_err_1"],
            "if_timeout": ["sample_timeout_1"],
            "if_answer": 
            [
                { //? means master successfully initialized and ready to make another jobs
                    "validate":"is_true",
                    "if_true": [10000/*, 'find_alone_agents'*/],
                    "if_false": []
                },
            ]
        },
        check_same_md5:
        {
            //? template is OPTIONAL: you can set template or it will be default.
            template:{timeout: 15000, blocking: false, aging: 300000},
            "if_err": ["sample_err_1"],
            "if_timeout": ["sample_timeout_1"],
            "if_answer": 
            [
                {
                    "validate": 'is_same_md5_undefined', // if agent returns empty answer
                    "if_true": [ 20000, 'check_same_md5', 'return_' ],
                },
                {
                    "validate": "is_partner_under_update", // if partner is updating right now
                    "if_true": [59000, 'check_same_md5', 'return_'],
                },
                {
                    "validate": "is_same_md5_exist", // if agent has at least one partner
                    "if_true": [],
                    "if_false": ['start_agent' ] //? !!! WHat if partner is under UPDATE ?
                },
                {
                    "validate": "is_same_md5_dublicate", // if agent has more than one partners
                    "if_true": [ 3000, 'kill_agent' ],
                },
                { 
                    "novalidate": [ 59000, 'check_same_md5' ]
                }
            ]
        },
        disk_space:
        {
            //- get disk free space
            //? OPTIONAL: you can set template or it will be default.
            template:{
                timeout: 15000, //? time how long to wait for any response from the agent
                blocking: false, //? blocking task makes other tasks wait to be completed
                aging: 300000, //? after this time task will removed from tasklist 
            },
            parameters: "C:",
            "if_err": ["sample_err_1"],
            "if_timeout": ["sample_timeout_1"],
            //answer from controller = size in bytes, so 4485132288 = 4,48 Gb
            "if_answer": 
            [
                {
                    "validate":"is_low_space",
                    "if_true": [ 5000, "clean_diskspace", 60000, "disk_space" ],
                    "if_false": ""
                },
                {
                    "validate":"is_lte_100gb",
                    "if_true": ["push_to_low_space_agents_list", "return_"]
                    //"if_false":""
                },
                { 
                    "novalidate": [ 60000, "disk_space" ]
                }
            ]
        },
        nvidia_smi:
        {
            "if_err": ["sample_err_1"],
            "if_timeout": ["sample_timeout_1"],
            "if_answer": 
            [
                {
                    "validate":"is_gpu_exist",
                    "if_true": [ "do_something"],
                },
                {
                    "validate":"is_gpu_gte_2",
                    "if_true": [ "do_something", 10000, "send_render_to_gpu" ],
                },
                { 
                    "novalidate": [ 50000, "nvidia_smi" ]
                }
            ]
        },
        exec_cmd:
        {
            //- execute arbitrary command
            parameters: {command: 'calc.exe'},
            //? what if error answer
            "if_err": ["sample_err_1"],
            "if_timeout": ["sample_timeout_1"],
            //? what if normal answer (it doesn't matter if it's good or bad, but there are no errors)
            "if_answer": 
            [
                { //? means controller ready to receive other JOBS
                    "validate":"is_cmd_started",
                    "if_true": [],
                    "if_false": [ 55000, "return_" ]
                },
                { 
                    "novalidate": []
                }
            ]
        },
        proc_count:
        {
            //- return true if process exist by name
            parameters: {process: 'notepad.exe'},
            //? what if error answer
            "if_err": ["sample_err_1"],
            "if_timeout": ["sample_timeout_1"],
            //? what if normal answer (it doesn't matter if it's good or bad, but there are no errors)
            //- Answer example: [{"pid":"5404","command":"C:\\Windows\\system32\\notepad.exe","arguments":"","ppid":"1764"}]
            //- Answer example: []
            "if_answer": 
            [
                { //? means controller ready to receive other JOBS
                    "validate":"is_proc_exist",
                    "if_true": [ 58000, "proc_count", "return_" ],
                    "if_false": [5000,  "return_"]
                },
                { //? means controller ready to receive other JOBS
                    "validate":"is_proc_more_than_1",
                    "if_true": [ 5000, "drop_excess_proc", "return_" ],
                }
            ]
        },
        //gpu_info:{},
        //diskspace:{},
    }
}

    //------------Jobs Validation Functions------------
function init_structure_jvf(){
    return JVF = 
    {
        is_true: function(task, sid){
			let ans = task[MGS.ANSWER];
            if (ans == true) return true;
            else return false;
        }, 
        is_alone_agents: function(task, doer_id) {
            let res = false;
            let ans = task[MGS.ANSWER];
            //? ans = {sid1:2, sid2:2, sid3:1}
            if (typeof ans == 'object') {
                for (let i in ans){
                    if(ans[i] == 1) res = true;
                }
            }
            return res;
        },
        is_proc_more_than_1: function(task, sid){
            if (Array.isArray(task[MGS.ANSWER]))
            {
                if (task[MGS.ANSWER].length > 1) return true;
                else return false;
            }
            else
            {
                return false;
            }
        },
        is_proc_exist: function(task, sid){
			console.log("()()()()()----------is_proc_exist:");
            console.log(JSON.stringify(task));
            console.log("()()()()()----------is_proc_exist");
            
            if (Array.isArray(task[MGS.ANSWER]))
            {
                if (task[MGS.ANSWER].length > 0) return true;
                else return false;
            }
            else
            {
                return false;
            }
        }, 
        is_cmd_started: function(task, sid){
			let ans = task[MGS.ANSWER];
            if (ans == true) return true;
            else return false;
        }, 
        is_gt_one: function(task, sid){
			let ans = task[MGS.ANSWER];
            if (ans > 1) return true;
            else return false;
        }, 
        is_gte_one: function(task, sid){
			let ans = task[MGS.ANSWER];
            if (ans >= 1) return true;
            else return false;
        }, 
        is_lte_100gb: function(task, sid) {
            let ans = task[MGS.ANSWER];
            // 10000000000 = 10 Gb
            if(ans < 10000000000) return true;
            else return false;
        },
		//? next 4 validate functions is about 'check_same_md5' job
		is_same_md5_undefined: function(task, sid) {
			let ans = task[MGS.ANSWER];
			// ans = {is_partner_exist, partners_count, is_partner_under_update}
            if(ans.is_partner_exist === undefined) return true;
            else return false;
        },
		is_partner_under_update: function(task, sid) {
			let ans = task[MGS.ANSWER];
			// ans = {is_partner_exist, partners_count, is_partner_under_update}
            if(ans.is_partner_under_update === true) return true;
            else return false;
        },
		is_same_md5_exist: function(task, sid) {
			let ans = task[MGS.ANSWER];
			// ans = {is_partner_exist, partners_count, is_partner_under_update}
            if(ans.is_partner_exist === true) return true;
            else return false;
        },
		is_same_md5_dublicate: function(task, sid) {
			let ans = task[MGS.ANSWER];
			// ans = {is_partner_exist, partners_count, is_partner_under_update}
            if(ans.partners_count > 1) return true;
            else return false;
        },
    }
}

    //------------Jobs Server Side Functions------------
function init_structure_jssf(){
    return JSSF = 
    {
        say_to_console_gpu_exist: function(){
            console.log("))) JSSF.say_to_console_gpu_exist()");
        },
        say_to_console_diskspace: function(){
            console.log("))) JSSF.say_to_console_diskspace()");
        },
        push_to_low_space_agents_list: function(task, doer_id){

        },
		find_alone_agents: function(){
			//TYPE:0, SID:1, MD5:2, IP:3, PID:4, PPID:5, APID:6, TASKS:7,
			//TID:0, TNAME:1, STAGE:2, RAW:3, ANSWER:4, NEXT_TID:5, TMPL:6, TIMEPUSH:7, TIMESENT:8, TIMEEXTRA:9, TIMETOSTART:10, BUNDLE_NEXT:11, BUNDLE_PREV:12, AGING:13,
			//FRESH:0, SENT:1, GOT:2, DONE:3, EXTRA:4, ERR:5, BLOCKED:6, T_OUT:7, //STAGES !
			let md5_obj = {"md5":"count"};
			console.log("find_alone_agents()...");
			delete md5_obj["md5"];
			for (let i in MGS.agents) {
				let cur_md5 = MGS.agents[i][MGS.MD5];
				if (md5_obj[cur_md5]) md5_obj[cur_md5]++;
				else md5_obj[cur_md5] = 1;
			}
			for (let i in md5_obj) {
				console.log("md5_obj[i] =", md5_obj[i]);
				console.log("i =", i);
            }
            return md5_obj;
        },
        void_master: function(task) {
            console.log("JSSF.void_master()...");
            return true;
            //MGS.task_board({stage:MGS.GOT, tid: task[MGS.TID], answer: true, sid: 'master', who_call:'JSSF void_master'});
        }
        
    }
}
    
    //------------Jobs Start Functions------------
function init_structure_jsf(){
    return JSF = {
        start__default: function(task, doer_id) {
            console.log("JSF.start__default(): task name =", task[MGS.TNAME], ", doer_id =", doer_id);
            task[MGS.STAGE] = MGS.SENT;
            //--------------------------------------------------
            //? calling master side function from JSSF structure
            if (doer_id == 'master') {
                console.log("JSF: task for Master!");
                if (typeof JSSF[task[MGS.TNAME]] == 'function') {
                    let result = JSSF[task[MGS.TNAME]](task);
                    if (result instanceof Promise){
                        result.then(res=>{
                            MGS.task_board( {tid: task[MGS.TID], answer: res, stage: MGS.GOT, sid: 'master', who_call:'JSF master' } );
                        }).catch(ex=>{console.log("JSF ERR: tdoer 'master':",ex);});
                    } else {
                        MGS.task_board( {tid: task[MGS.TID], answer: result, stage: MGS.GOT, sid: 'master', who_call:'JSF master' } );
                    }
                } else { console.log("task intended for master has no corresponding function in JSSF structure"); }
            }
            //--------------------------------------------------
            //? or send job to agent
            else if (doer_id != 'master') {
                let parcel = { tid: task[MGS.TID], jid: ++JF_.gcounter, payload: task[MGS.RAW] };
                io.to(doer_id).emit(task[MGS.TNAME], parcel);
            }
        },
		check_same_md5: function(task, doer_id) {
            //? TYPE, MD5, SID, IP, PID, PPID, APID, TASKS
            if (doer_id == 'master') { 
                doer_id == 'all';
                this.start__default(task, doer_id);
            } else {
                task[MGS.RAW] = MGS.find_all_same_md5_agents({sid:doer_id});
                //MGS.find_same_md5_agents_except_self_type({sid:ag_sid});
                this.start__default(task, doer_id);
            }
        },
    };
}
    //------------Jobs Complete Functions------------
function init_structure_jcf(){
    return JCF = {
        complete__default: function(task, doer_id) {
            task[MGS.STAGE] = MGS.DONE;
            console.log("JCF.complete__default(): task name =", task[MGS.TNAME]);
            //TODO: this command dublicate above string STAGE = DONE
            //TODO check validation Functions described in JOBS
            JF_.handle_job_in_sync_mode(task, doer_id);
            //-------------------------------
        },
		check_same_md5: function(task, doer_id) {
			console.log("----!!!!------JCF.check_same_md5(): ANSWER =", task[MGS.ANSWER]);
			this.complete__default(task, doer_id);
		}

    };
}
    //------------Jobs Timeout Functions------------
function init_structure_jtf(){
    return JTF = {
        timeout__default: function(task, ag_sid) {
            if(task[MGS.STAGE]==MGS.SENT) task[MGS.STAGE] = MGS.T_OUT;
            if(task[MGS.STAGE]==MGS.GOT) task[MGS.STAGE] = MGS.T_OUT2;
            console.log("JTF.timeout__default(): task name =", task[MGS.TNAME]);
        },
        sample_timeout_1: function(task, ag_sid){
            this.timeout__default(task, ag_sid);
        }
    }
}
    //------------Jobs Error Functions------------
function init_structure_jef(){
    return JEF = {
        error__default: function(task, ag_sid) {
            task[MGS.STAGE] = MGS.ERR;
            console.log("JTF.error__default(): task name =", task[MGS.TNAME]);
        },
        sample_err_1: function(task, ag_sid){
            this.error__default(task, ag_sid);
        }
    }
}

    //------------Jobs Low Level Functions------------
function init_jobs_functions(){
    return JF_ =     {
        gcounter: 0,
        emitter: null,
        repeated_jobs: {
            //{uniq_key: {task_name:count, task_name:count, ..}, ...}
        },
        create_emitter: function(){
            JF_.emitter = new EventEmitter();
            JF_.emitter.on('agent_initialized', sid => {
                let agent_index = MGS.find_agent_index_by_sid(sid);
                if ((typeof agent_index != 'number') || (agent_index < 0)) {
                    return console.log("on('agent_initialized') can't find Agent by SID");
                }

                if (MGS.agents[agent_index][MGS.INITIALIZED] == true) {
                    return console.log("on('agent_initialized'): The Agent has Already Received 'void_all' task !");;
                }
                MGS.agents[agent_index][MGS.INITIALIZED] = true;
                MGS.task_board({
                    t_names:['void_all'], 
                    stage: MGS.FRESH, 
                    sid: sid, 
                    who_call:"JF_.emitter"
                });
            });
            JF_.emitter.on('controller_comes', sid=>{
                // Main Function for Controllers in JOBS Structure, that starts all other looping operations
                if (typeof sid == 'undefined') {
                    return console.log("on 'controller_comes' event was not passed socket ID !"); 
                } 
                MGS.task_board({t_names:['void_controller'], stage: MGS.FRESH, sid: sid, who_call:"JF_.emitter"});
            });
			JF_.emitter.on('launcher_comes', sid=>{
                // Main Function for Launcher in JOBS Structure, that starts all other looping operations
                if (typeof sid == 'undefined') {
                    return console.log("on 'launcher_comes' event was not passed socket ID !");
                }
                MGS.task_board({t_names:['void_launcher'], stage: MGS.FRESH, sid: sid, who_call:"JF_.emitter"});
            });
        },
        //? this funtion will be called from
        init_: function(){
            this.create_emitter();
            //- analize JOBS structure for jobs which repeated themselves
            this.count_repeated_jobs(JOBS, "main");
            //? automatically create templates based on function info
            this.init_templates();
			//? start special master JOBS
			this.start_master_stack();	
        },
        //@ Запускает Стэк мастера
		start_master_stack: function(){
            console.log("start_master_stack()");
            MGS.task_board({t_names:['void_master'], stage: MGS.FRESH, sid: 'master', server_side:true, who_call:'init void_master'});
		},
        //? if not determined functions in JCF and JSF, then default Templates is applied
        init_templates: function()
        {
            for (let job in JOBS) {
                //? objects like 'void_controller', 'proc_count', but not 'gcounter', which is number
                if (typeof JOBS[job] == 'object') 
                {
                    if(TEMPLATES[job]) {
                        //? Значит в текущих шаблонах уже есть шаблон с таким именем
                        console.log("!!! template name '"+job+"' already occupied. You must change the name !!!");
                        continue;
                    } else { TEMPLATES[job] = {}; }
                    //------to use the data
                    if (typeof JOBS[job].template == 'object') {
						if (JOBS[job].template.timeout)
							TEMPLATES[job].timeout = JOBS[job].template.timeout;
						if (JOBS[job].template.blocking)
							TEMPLATES[job].blocking = JOBS[job].template.blocking;
						if (JOBS[job].template.aging)
							TEMPLATES[job].aging = JOBS[job].template.aging;
                        if (typeof TEMPLATES[job].blocking == 'undefined') TEMPLATES[job].blocking = TEMPLATES.default.blocking; 
                        TEMPLATES[job].aging = JOBS[job].template.aging || TEMPLATES.default.aging;
                    } 
					else {
						if (typeof TEMPLATES[job].timeout == 'undefined')
							TEMPLATES[job].timeout = TEMPLATES.default.timeout;
						if (typeof TEMPLATES[job].blocking == 'undefined')
							TEMPLATES[job].blocking = TEMPLATES.default.blocking;
						if (typeof TEMPLATES[job].aging == 'undefined')
							TEMPLATES[job].aging = TEMPLATES.default.aging;
                    }
                    //--------if erorr--------
                    if (JOBS[job].if_err) {
                        let err_ = JOBS[job].if_err;
                        if ((Array.isArray(err_))&&(err_.length>0)&&(typeof err_[0]=='string')) {
                            TEMPLATES[job].error_f = JOBS[job].if_err[0];                                       
                        } else {TEMPLATES[job].error_f = TEMPLATES.default.error_f}
                    } else {TEMPLATES[job].error_f = TEMPLATES.default.error_f}
                    //-------if timeout--------
                    if (JOBS[job].if_timeout) {
                        let out_ = JOBS[job].if_timeout;
                        if ((Array.isArray(out_))&&(out_.length>0)&&(typeof out_[0]=='string')) {
                            TEMPLATES[job].timeout_f = JOBS[job].if_timeout[0];            
                        } else {TEMPLATES[job].timeout_f = TEMPLATES.default.timeout_f}
                    } else {TEMPLATES[job].timeout_f = TEMPLATES.default.timeout_f}
                    //-------if good answer-------------
                    if (JCF[job]){ TEMPLATES[job].complete_f = job; } 
                    else { TEMPLATES[job].complete_f = TEMPLATES.default.complete_f; }

                    if (JSF[job]){ TEMPLATES[job].start_f = job; } 
                    else { TEMPLATES[job].start_f = TEMPLATES.default.start_f; }

                    console.log("TEMPLATES["+job+"]=", JSON.stringify(TEMPLATES[job]));
                } 
            }
        },
        stop_repeated_task: function(data, browser_sid) {
            console.log("=======stop_repeated_task()========");
            console.log(data); //taskname: 'disk_space', agent_index: 1, job_index: 5
            console.log("===================================");
            //TODO will: splice this action from Agent's tasklist
            let bad_msg = false;
            if (!(data instanceof Object)) bad_msg = "data from browser is not an Object type";
            else if (typeof data.agent_md5 == "undefined") bad_msg = "'data.agent_md5' is undefined";
            else if (typeof data.agent_type == "undefined") bad_msg = "'data.agent_type' is undefined";
            else if (typeof data.job_id == "undefined") bad_msg = "'data.job_id' is undefined";
            else if (typeof data.task_name == "undefined") bad_msg = "'data.task_name' is undefined";
            
            if (bad_msg) 
            {
                io.to(browser_sid).emit("stop_repeated_task", bad_msg);
                return;
            }
            //-----------------------
            //let agent_index = MGS.find_agent_index_by_sid(data.agent_sid);
            let agent_index = MGS.find_agent_index_by_md5_and_type({
                md5: data.agent_md5,
                type: data.agent_type
            })
            if (typeof agent_index != 'undefined') 
            {
                if (Array.isArray(MGS.agents[agent_index])) 
                {
                    let tasklist = MGS.agents[agent_index][MGS.TASKS];
                    if (Array.isArray(tasklist))
                    {
                        
                        let one_task = MGS.find_task_by_tid_among_agents({
                            tid: data.job_id, 
                            sid: MGS.agents[agent_index][MGS.SID]
                        });
                        console.log("=======one_task =", one_task);
                        if (typeof one_task != 'undefined')
                        {
                            if (one_task[MGS.TNAME] == data.task_name)
                            {
                                //tasklist.splice
                                one_task[MGS.STAGE] = MGS.DROPPED;

                                //if (JOBS[data.task_name] instanceof Object) 
                                let uniq_tasks = MGS.agents[agent_index][MGS.UNIQ_TASKS];
                                if (Array.isArray(uniq_tasks))
                                {
                                    //uniq_tasks_2 will always an Array
                                    const task_in_array = uniq_tasks.findIndex(t => t == one_task[MGS.TNAME]);
                                    if (task_in_array != -1) 
                                    {
                                        uniq_tasks.splice(task_in_array,1);
                                        console.log("=========uniq_tasks =", uniq_tasks);
                                        //JOBS[data.task_name].stopped = true;
                                    }
                                }
                                
                                
                            }
                            else
                            {
                                bad_msg = "can't find task by name"
                                io.to(browser_sid).emit("stop_repeated_task", bad_msg);
                            }
                        }
                        else 
                        {
                            console.log("stop_repeated_task(): can't find task by tid:", task_index);
                        }
                    }
                } 
                else
                {
                    bad_msg = "can't find Agent by index";
                    io.to(browser_sid).emit("stop_repeated_task", bad_msg);
                }
            }
            else
            {
                console.log("stop_repeated_task(): can't find agent by sid:", agent_index);
            }
        },
        stop_repeated_task_old: function(data) 
        {
            //TODO: 
            // 1) Сделать так, что если агент disconnect, то посылать контрагенту событие 'partner_leaves' только в том случае, если этому не предшествовала команда kill
            // 2) Для агента которому нажали stop на одном из заданий, ставим свойство INDIVIDUAL = true
            if (typeof data.agent == 'number') {
                if (typeof MGS.agents[data.agent] != 'undefined') {
                    MGS.agents[data.agent][MGS.INDIVIDUAL] = true;
                    let sid = MGS.agents[data.agent][MGS.SID];

                    if (typeof ALT_JOBS[sid] != 'object') {
                        ALT_JOBS[sid] = JSON.parse(JSON.stringify(JOBS));
                    }
                    delete ALT_JOBS[sid][data.task_name]

                    this.count_repeated_jobs(ALT_JOBS[sid], sid);

                    this.make_tasks_back_unrepeated_by_tname(data);
                }
            }
        },
        count_repeated_jobs: function(JOBS_STRUCT, sid){
            let jobs = {};
            for (let i in JOBS_STRUCT) 
            {
                if (typeof jobs[i] == 'undefined') { jobs[i] = 1 }
                else { jobs[i]++ }
                //delete_this_later:("jobs=", jobs);
                if (JOBS_STRUCT[i] instanceof Object) 
                {
                    if (Array.isArray(JOBS_STRUCT[i].if_answer))
                    {
                        let arr = JOBS_STRUCT[i].if_answer;
                        for(let j in arr) 
                        {                       
                            if (typeof arr[j] == 'object') 
                            {
                                if (Array.isArray(arr[j].if_true)) 
                                {
                                    let true_arr = arr[j].if_true;
                                    //delete_this_later:("true_arr=", true_arr);
                                    for (let k in true_arr) {
                                        //if (true_arr[k] == 'return_') { continue; }
                                        if (typeof true_arr[k] == 'string') {
                                            if (typeof jobs[true_arr[k]] == 'undefined') { jobs[true_arr[k]] = 1 }
                                            else { jobs[true_arr[k]]++ }
                                        }
                                    }
                                }
                                if (Array.isArray(arr[j].if_false)) 
                                {
                                    let false_arr = arr[j].if_false;
                                    //delete_this_later:("false_arr=", false_arr);
                                    for (let m in false_arr) {
                                        //if (false_arr[m] == 'return_') { continue; }
                                        if (typeof false_arr[m] == 'string') {
                                            if (typeof jobs[false_arr[m]] == 'undefined') { jobs[false_arr[m]] = 1 }
                                            else { jobs[false_arr[m]]++ }
                                        }
                                    }
                                }
                                if (Array.isArray(arr[j].novalidate)) 
                                {
                                    let novalidate_arr = arr[j].novalidate;
                                    for (let n in novalidate_arr) {
                                        //if (novalidate_arr[n] == 'return_') { continue; }
                                        if (typeof novalidate_arr[n] == 'string') {
                                            if (typeof jobs[novalidate_arr[n]] == 'undefined') { jobs[novalidate_arr[n]] = 1 }
                                            else { jobs[novalidate_arr[n]]++ }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

            }
            //delete_this_later:("----------------REPEATED =", JSON.stringify(jobs));
            this.repeated_jobs[sid] = jobs;
            console.log("=======count_repeated_jobs()========");
            console.log("this.repeated_jobs["+sid+"] =", this.repeated_jobs[sid]);
            console.log("====================================");
        },
        make_tasks_back_unrepeated_by_tname: function(data){
            //- data = {agent, task_name}
            console.log("make_tasks_back_unrepeated_by_tname(): data = ", data);
            let tlist = MGS.agents[data.agent][MGS.TASKS];
            for (let t in tlist) {
                if (data.task_name == tlist[t][MGS.TNAME]) {
                    tlist[t][MGS.REPEATED] = 0;
                }
            }
        },
        handle_job_in_sync_mode: function(task, ag_sid){
            console.log("===========handle_job_in_sync_mode(): task name =", task[MGS.TNAME]);
            if ((JOBS[task[MGS.TNAME]] instanceof Object) == false) 
            { 
                console.log("Err 1");
                return;
            }
            //-------------------------------
            let val_blocks = JOBS[task[MGS.TNAME]].if_answer;
            if (!Array.isArray(val_blocks)) 
            {
                console.log("Err 2");
                return;
            }
            //-------------------------------
            //var is_return = false;
            for (let i=0; i<val_blocks.length; i++) 
            {
                let vblock = val_blocks[i];
                if ((vblock instanceof Object) == false) {
                    console.log("Err 3");
                    continue;
                }
                //-------------------------------
                let actions_chain;

                if (vblock.validate) 
                {
                    //check one validation block if it true or false
                    let is_validate_true;
                    if (typeof JVF[vblock.validate] == 'function') 
                    {
                        is_validate_true = JVF[vblock.validate](task, ag_sid);
                    } 
                    else 
                    { 
                        console.log("no validate function for validation block:", task[MGS.TNAME]) 
                    }

                    //---------checking 'if_true'and 'if_false' keys: is exist, is Array
                    let is_prop_true_checked = false;
                    if( (vblock.if_true) && (Array.isArray(vblock.if_true)) ) is_prop_true_checked = true;
                    let is_prop_false_checked = false;
                    if( (vblock.if_false) && (Array.isArray(vblock.if_false)) ) is_prop_false_checked = true;
                    //----------------------------------------------------
                    //----- IF val function of val block returned TRUE or FALSE
                    
                    if ((is_validate_true == true) && (is_prop_true_checked)) 
                    {
                        actions_chain = vblock.if_true
                    }
                    else if ((is_validate_true == false) && (is_prop_false_checked))
                    {
                        actions_chain = vblock.if_false;
                    }
                    else 
                    {
                        continue;
                    }
                }
                else if (vblock.novalidate) 
                {
                    if (Array.isArray(vblock.novalidate)) 
                    {
                        actions_chain = vblock.novalidate;
                    }
                }
                
                let timer_accum = 0;
                for (let j = 0; j < actions_chain.length; j++) 
                {
                    let action = actions_chain[j];
                    //--- Action can be String or Number or "return_"
                    if (typeof action == 'number') 
                    {
                        timer_accum += action;
                        continue;
                    }
                    else if(typeof action == 'string') 
                    {
                        let pending_time = timer_accum + new Date().getTime();
                        timer_accum = 0;

                        if(action == "return_") 
                        {
                            break;
                        }
                        //? if this name described in JOBS - it means we must send this to agent
                        else if(JOBS[action] instanceof Object) 
                        {
                            //also we have here 'task' and 'ag_sid' params
                            let raw = JOBS[action].parameters;
                            
                            MGS.task_board({t_names:[ action ], raws:[raw], stage: MGS.FRESH, 
                                timetostart: pending_time, sid: ag_sid, who_call:action});
                        }
                        //? if one after_validate action corresponding function is in JSSF structure
                        else if (typeof JSSF[action] == 'function') 
                        {
                            this.action_on_master_side(action, task, ag_sid)
                            .then(res=>{
                                console.log("one after_validate action result =", res);
                                // TODO: emit result to Some Listener
                            }).catch(ex=>{
                                console.log("one after validate action err:", ex);
                                // TODO: emit result to Some Listener
                            });
                        }
                        else if (TEMPLATES[action]) 
                        {
                            MGS.task_board( {
                                t_names:[ action ], stage: MGS.FRESH, timetostart: pending_time,
                                sid: ag_sid, who_call:"perform_validate_actions" 
                            });
                        }
                        else 
                        {
                            console.log("one after_validate_action has no corresponding function!"); 
                        }
                    }
                    
                    else 
                    { 
                        console.log("unknown type of after_validate action! Must be Number or String!"); 
                    } 
                }
            }
        },
        handle_conditions: function(task, ag_sid)
        {
            let conditions;
            
            //----------------------------------------------------------
            // Look for Individual Agent's Structure Instead of classic JOBS
            //----------------------------------------------------------
            let ag_ind = MGS.find_agent_index_by_sid(ag_sid);
            let is_index = (typeof ag_ind != 'undefined');
            let is_agent = Array.isArray(MGS.agents[ag_ind]);

            if (is_index && is_agent){
                if (MGS.agents[ag_ind][MGS.INDIVIDUAL]) {
                    console.log("===== INDIVIDUAL ALT JOBS ======");
                    let sid = MGS.agents[ag_ind][MGS.SID]; 
                    if (typeof ALT_JOBS[sid] == 'object') {
                        if (typeof ALT_JOBS[sid][task[MGS.TNAME]] == 'object') {
                            conditions = ALT_JOBS[sid][task[MGS.TNAME]].if_answer;
                        }
                    }
                }
            }
            //----------------------------------------------------------
            // or take instructions from classic JOBS structure
            //----------------------------------------------------------
            if (!conditions) conditions = JOBS[task[MGS.TNAME]].if_answer;
            //----------------------------------------------------------
            if (!Array.isArray(conditions)) {
                console.log("===== NO 'if_answer' Property of JOBS or ALT_JOBS structure ======");
                return;
            }

            let answer = task[MGS.ANSWER];
            let pending = conditions.length;
            //? recursive function
            this.handle_one_condition(conditions, answer, pending, task, ag_sid);
        },
        handle_one_condition: function(conditions, answer, pending, task, ag_sid, counter)
        {
            if (typeof counter == 'undefined') counter = 0;
            
            //delete_this_later:("one condition =", JSON.stringify(conditions[counter]));
            //one condition = {"validate":"is_true","if_true":[30000,"disk_space",10000,"sample_fuction_zero_is_true","return_"],"if_false":""}
            let cond = conditions[counter];
            //delete_this_later:("-------cond=", cond);
            
            //?======expected key 'validate', which may be several=========
            //=============================================================
            if (cond.validate) 
            {
                //delete_this_later:("-2-handle_one_condition(): validate:",counter, conditions[counter].validate);
                //? calling validation function, e.g. "is_true"
                let is_validate_true;
                if (typeof JVF[cond.validate] == 'function') {
                    is_validate_true = JVF[cond.validate](task, ag_sid);
                } else { console.log("no validate function for validation block in", task[MGS.TNAME]) }
                //delete_this_later:("is_validate_true =", is_validate_true);
                //---------checking 'if_true' key: is exist, is Array, is length > 0
                let is_prop_true_checked = false;
                if( (cond.if_true) && (Array.isArray(cond.if_true)) && (cond.if_true.length>0) )
                    is_prop_true_checked = true;
                //---------checking 'if_false' key: is exist, is Array, is length > 0
                let is_prop_false_checked = false;
                if( (cond.if_false) && (Array.isArray(cond.if_false)) && (cond.if_false.length>0) )
                    is_prop_false_checked = true;
                //--------------------------
                //delete_this_later:("is_prop_true_checked =", is_prop_true_checked);
                //delete_this_later:("is_prop_false_checked =", is_prop_false_checked);
                if (is_validate_true && is_prop_true_checked) {
                    //delete_this_later:("true branch of validation block!");
                    this.after_validate_actions(cond.if_true, task, ag_sid).then(res=>{
                        //"if_true":[30000,"disk_space",10000,"sample_fuction_zero_is_true","return_"]
                        console.log("after_validate_actions(truelist) -> result=", res);
                        if ((res)&&(res.has_return)) { return; }
                        //?---finish or continue recursion-----
                        if(!--pending) {return;}
                        else { this.handle_one_condition(conditions, answer, pending, task, ag_sid, counter+1); }
                    }).catch(ex=>{
                        console.log("after_validate_actions(truelist) -> exception=", ex);
                        //?---finish or continue recursion-----
                        if(!--pending) {return;}
                        else { this.handle_one_condition(conditions, answer, pending, task, ag_sid, counter+1); }
                    });
                } 
                else if (!is_validate_true && is_prop_false_checked) {
                    //delete_this_later:("false branch of validation block!");
                    this.after_validate_actions(cond.if_false, task, ag_sid).then(res=>{
                        console.log("after_validate_actions(falselist) -> result=", res);
                        if ((res)&&(res.has_return)) { return; }
                        //?---finish or continue recursion-----
                        if(!--pending) {return;}
                        else { this.handle_one_condition(conditions, answer, pending, task, ag_sid, counter+1); }
                    }).catch(ex=>{
                        console.log("after_validate_actions(falselist) -> exception=", ex);
                        //?---finish or continue recursion-----
                        if(!--pending) {return;}
                        else { this.handle_one_condition(conditions, answer, pending, task, ag_sid, counter+1); }
                    });
                }
                else {
                    //?---finish or continue recursion-----
                    if(!--pending) {return;}
                    else { this.handle_one_condition(conditions, answer, pending, task, ag_sid, counter+1); }
                }
                
            }
            //?========last check in a specific JOBS[taskname]===========
            //===========================================================
            else if (cond.novalidate) {
                //delete_this_later:("-2-handle_one_condition(): novalidate:",counter, conditions[counter].novalidate);
                if( (Array.isArray(cond.novalidate))&&(cond.novalidate.length>0) ) 
                {
                    this.after_validate_actions(cond.novalidate, task, ag_sid).then(res=>{
                        //delete_this_later:("after_validate_actions(falselist) -> result=", res);
                        //?---finish or continue recursion-----
                        if(!--pending) {return;}
                        else { this.handle_one_condition(conditions, answer, pending, task, ag_sid, counter+1); }
                    }).catch(ex=>{
                        //delete_this_later:("after_validate_actions(falselist) -> exception=", ex);
                        //?---finish or continue recursion-----
                        if(!--pending) {return;}
                        else { this.handle_one_condition(conditions, answer, pending, task, ag_sid, counter+1); }
                    });
                }
                else {
                    //?---finish or continue recursion-----
                    if(!--pending) {return;}
                    else { this.handle_one_condition(conditions, answer, pending, task, ag_sid, counter+1); }
                }
            }
            //=============================================================
            //=============================================================
            else { 
                console.log("!!! not regulated keys! must be 'validate' or 'novalidate'", Object.keys(conditions[counter])); 
                //?---finish or continue recursion-----
                if(!--pending) {return;}
                else { this.handle_one_condition(conditions, answer, pending, task, ag_sid, counter+1); }
            }                
        },
        after_validate_actions: function(list, task, ag_sid){
            console.log("--3--after_validate_actions()");
            return new Promise((resolve, reject)=>{
                let pending = list.length;
                let counter = 0;
                if (pending > 0) {
                    this.perform_validate_actions(task, ag_sid, list, pending, counter, function(errlist, reslist, has_return){
                        //delete_this_later:("after_validate actions of one condition has done!");
                        resolve({errlist:errlist, has_return: has_return});
                    });
                } else {
                    console.log("empty chain of after_validate actions!");
                    resolve();
                }
            });
        },

        perform_validate_actions: function(task, ag_sid, list, pending, counter, callback) 
        {
            console.log("---4---perform_validate_actions(): action=", list[counter]);
            return new Promise((resolve, reject)=>{
                if (typeof counter == 'undefined') counter = 0;
                let errlist = [];
                let reslist = [];

                if(typeof list[counter] == 'string') 
                {
                    //? if this name described in JOBS - it menas we must send this to agent
                    if(list[counter] == "return_") {
                        callback(errlist, reslist, true); return;
                    }
                    else if(JOBS[list[counter]]) {
                        //MGS.task_board({t_names: [order[CHK.TYPE]], raws:[raw], stage: MGS.FRESH, sid: ag_sid, who_call:"CHK.LIST"});
                        //delete_this_later:("______ag_sid = ", ag_sid);
                        var raw = JOBS[list[counter]].parameters;
                        MGS.task_board({t_names:[ list[counter] ], raws:[raw], stage: MGS.FRESH, sid: ag_sid, who_call:list[counter]});
                        //? --------recursion-------------------
                        if (!--pending) { callback(errlist, reslist); return; }
                        else { this.perform_validate_actions(task, ag_sid, list, pending, counter+1, callback); }
                    }
                    //? if one after_validate action corresponding function is in JSSF structure
                    else if (typeof JSSF[list[counter]] == 'function') {
                        this.action_on_master_side(list[counter]).then(res=>{
							if (res instanceof Error) { console.log("ERR: action_on_master_side:", res); }
                            console.log("one after_validate action result =", res);
                            reslist.push(res);
                            //? --------recursion-------------------
                            if (!--pending) { callback(errlist, reslist); return; }
                            else { this.perform_validate_actions(task, ag_sid, list, pending, counter+1, callback); }
                        }).catch(ex=>{
                            errlist.push(list[counter]);
                            console.log("one after validate action err:", ex);
                            //? --------recursion-------------------
                            if (!--pending) { callback(errlist, reslist); return; }
                            else { this.perform_validate_actions(task, ag_sid, list, pending, counter+1, callback); }
                        });
                    }
					//else if (typeof TFX[list[counter]] == 'function') {}
                    //? there is no such function neither in JOBS nor in JSSF structure
                    else if (TEMPLATES[list[counter]]) {
                        MGS.task_board( {
                            t_names:[ list[counter] ], 
                            raws:[raw], 
                            stage: MGS.FRESH, 
                            sid: ag_sid, 
                            who_call:"perform_validate_actions" 
                        });
                            //? --------recursion-------------------
                        if (!--pending) { callback(errlist, reslist); return; }
                        else { this.perform_validate_actions(task, ag_sid, list, pending, counter+1, callback); }
                    }
                    else {
                        console.log("one after_validate_action has no corresponding function!"); 
                        //? --------recursion-------------------
                        if (!--pending) { callback(errlist, reslist); return; }
                        else { this.perform_validate_actions(task, ag_sid, list, pending, counter+1, callback); }
                    }
                }
                else if(typeof list[counter] == 'number') {
                    setTimeout(()=>{
                        //? --------recursion-------------------
                        if (!--pending) { callback(errlist, reslist); return; }
                        else { this.perform_validate_actions(task, ag_sid, list, pending, counter+1, callback); }
                    }, list[counter]);
                }
                else { 
                    console.log("unknown type of after_validate action! Must be Number or String!");
                    //? --------recursion-------------------
                    if (!--pending) { callback(errlist, reslist); return; }
                    else { this.perform_validate_actions(task, ag_sid, list, pending, counter+1, callback); } 
                }   
            });
        },
        action_on_master_side: function(v_action, task, ag_sid)
        {
            console.log("---5---action_on_master_side(): action=", v_action);
            return new Promise((resolve, reject)=>{
                let result = JSSF[v_action](task, ag_sid);
                //? if function return Promise
                if (result instanceof Promise) {
                    result.then(res=>{ resolve(res);
                    }).catch(ex=>{ reject(ex); });
                }
                //? if syncronous function, not Promise
                else { resolve(result); }
            });
        }
    }
}
     
    //-----------------------------------------
    //--------TASK TEMPLATES ------------------
    //-----------------------------------------
    const TEMPLATES = 
	{
        //Description:
        //timeout - time to wait for the agent's response
        //blocking - blocks all the following tasks until the current one ends
        //aging - the time after which information about the task will be erased from agent's tasklist
        //keep_last - don't delete one last task of this type from agent's tasklist, because contains agent's answer

        default: {
            timeout: 5000, blocking: false, aging: 60000,
            start_f:    "start__default",
            complete_f: "complete__default",
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        /* такой шаблон создаётся автоматически из функции JF_.init_templates()
        void_controller:{
            timeout: 15000, blocking: false, aging: 300000,
            start_f:    "start__default",
            complete_f: "complete__void_controller", //own
            timeout_f:  JOBS[job].if_timeout.call_, // string like 'sample_timeout_1'
            error_f:    JOBS[job].if_err.call_, // string like 'sample_error_1'
        }
        */
        manifest: {
            timeout: 15000, blocking: false, aging: 300000, keep_last: true,
            start_f:    "start__manifest",
            complete_f: "complete__manifest", //own
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        same_md5_agents: {
            timeout: 15000, blocking: false, aging: 600000, keep_last: true,
            start_f:    "start__same_md5_agents", //own
            complete_f: "complete__same_md5_agents", //own
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        kill_agent: {
            timeout: 5000, blocking: true, aging: 600000,
            start_f:    "start__kill_agent", //own
            complete_f: "complete__kill_agent", //own
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        sync_dirs: {
            timeout: 5000, blocking: true, aging: 600000,
            start_f:    "start__default", 
            complete_f: "complete__sync_dirs",
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
        start_agent: {
            timeout: 5000, blocking: true, aging: 600000,
            start_f:    "start__default",
            complete_f: "complete__start_agent",
            timeout_f:  "timeout__default",
            error_f:    "error__default",
        },
    };
    //? Изначально Runner всё кидает сюда
    const TFX = new function TaskFunctions() 
    {
        //------------------------------------
        this.start__default = function(task, ag_sid) {
            //* 2) change STAGE to SENT
            task[MGS.STAGE] = MGS.SENT;
            //* 3) Agent.Emit(TNAME, {TID,RAW} )
            let parcel = { tid: task[MGS.TID], payload: task[MGS.RAW] };
            //delete_this_later:("start_f_default(): PAYLOAD=", util.inspect(task[MGS.RAW]));
            io.to(ag_sid).emit(task[MGS.TNAME], parcel);
        };
        this.start__kill_agent = function(task, ag_sid) {
            if (task[MGS.TNAME] == 'kill_agent') {
                // TODO: Find same Md5 Partners and UNSHIFT on TOP of those TaskBoard Task with STAGE = MGS.BLOCKED
                let same_md5_agents = MGS.find_same_md5_agents_except_self_type( {sid: ag_sid} );
                if (Array.isArray(same_md5_agents)) {
                    if (same_md5_agents.length > 0) {
                        let blocking_task = [];
                        blocking_task[MGS.TID] = ++MGS.gcounter;
                        blocking_task[MGS.STAGE] = MGS.BLOCKED;
                        blocking_task[MGS.TNAME] = "BLOCKING_TASK";
                        //* if unexpectedly we have more than one same md5 agents
                        for (let i in same_md5_agents) { 
                            let sid = same_md5_agents[i][MGS.SID];
                            let agent_index = MGS.find_agent_index_by_sid(sid);
                            MGS.agents[agent_index][MGS.TASKS].unshift(blocking_task); }
                    }
                }
                this.start__default(task, ag_sid);
            } else {console.log("TFX.start__kill_agent(): task name is not 'kill_agent'");}
        };
        this.start__manifest = function(task, ag_sid) {
            //let stringified_manifest = JSON.stringify(MGS.manifest.self);
            //let parcel = { tid: task[MGS.TID], payload: stringified_manifest };

            task[MGS.STAGE] = MGS.SENT;
            let parcel = { tid: task[MGS.TID], payload: MGS.manifest.self };
            io.to(ag_sid).emit(task[MGS.TNAME], parcel);
        };
        this.start__same_md5_agents = function(task, ag_sid){
            let same_md5_agents = MGS.find_all_same_md5_agents( {sid: ag_sid} );
            task[MGS.RAW] = JSON.stringify(same_md5_agents);
            this.start__default(task, ag_sid);
        };
        this.complete__default = function(task, ag_sid) {
            task[MGS.STAGE] = MGS.DONE; 
        };
        
        this.complete__chk = function(task, ag_sid) {
            // Pass instruction like 'what you must to do finally', e.g. {type:arr, obj: 'task', el: 'MGS.STAGE', val: 'MGS.DONE'}
            CHK_FX.finalizer(task, ag_sid);
            task[MGS.STAGE] = MGS.DONE; 
        };
        this.complete__manifest = function(task, ag_sid) {
            const DELAY_BEFORE_SAME_MD5_TASK = 5000;
            //-? this task 'Manifest' define Next Task to Do
            if ( task[MGS.BUNDLE_NEXT] == 'same_md5_agents' ) {
                MGS.task_board( {t_names:['same_md5_agents'],
                                timetostart: (DELAY_BEFORE_SAME_MD5_TASK + new Date().getTime()),
                                stage: MGS.FRESH, 
                                sid: ag_sid,
                                bundle_prev: "manifest",
                                who_call: "TFX.complete__manifest" } );
            }
            task[MGS.STAGE] = MGS.DONE;
        };
        this.complete__same_md5_agents = function(task, ag_sid) {
            let is_partner_exist = task[MGS.ANSWER]; // true || false

            //? Means that this task 'same_md5_agents' was a standalone task, not in Bundle with 'Manifest'
            if ( task[MGS.BUNDLE_PREV] != 'manifest' ) 
            {
                //- in fact at the moment writing the program such a branch will never happen
                if(is_partner_exist == false) {
                    MGS.task_board( {
                        t_names:['start_agent'], 
                        sid: ag_sid, 
                        stage: MGS.FRESH, 
                        who_call:"TFX.complete__same_md5_agents"
                    } );
                }
                return;
            }
            //-? Basically task 'same_md5_agents' always has predeccessor 'manifest' task in bundle
            let agent_index = MGS.find_agent_index_by_sid(ag_sid);
            if (typeof agent_index == 'undefined') {
                return console.log("complete__same_md5_agents(): fail to get agent_index");
            }

            //-? expected result: found previous 'manifest' task in tasklist of this Agent
            let prev_manifest_task = MGS.find_prev_task_by_tname({tname: 'manifest', sid: ag_sid});
            if (!Array.isArray(prev_manifest_task)) {
                //-? мы хотели найти предыдущее задание типа 'manifest', но почему-то не нашли
                return console.log("!!!!!!!!!! ERR: Fail to find previous 'manifest' task! this tid =", task[MGS.TID]);               
            }

            let t_names = [];
            let diff = prev_manifest_task[MGS.ANSWER];
            let bundle_next;
            
            //----IF Agent TYPE is Controller------
            if (MGS.agents[agent_index][MGS.TYPE] == "controller") 
            {    
                //-? В манифесте ЕСТЬ изменения
                if (diff.is_diff) 
                {
                    //- controller will restarts the launcher, only if the launcher's root directory contains changes 
                    if (diff.is_touch_partner_folder) 
                    {  
                        //-? Если изменения затрагивают папку launcher и лончер запущен => убить лончера
                        if(is_partner_exist) { 
                            t_names = ['kill_agent'];  
                        }
                        //-? Если изменения затрагивают папку launcher и лончер НЕ запущен => синхронизировать директории
                        else {  
                            t_names = ['sync_dirs']; 
                            bundle_next = 'start_agent';
                        }
                    }
                    //-? Если изменения НЕ затрагивают папку launcher => синхронизация директорий
                    else {
                        t_names = ['sync_dirs'];
                    }
                } 
                //-? Если в манифесте НЕТ изменений
                else 
                {
                    //-? Лончер уже запущен, значит подать сигнал инициализации
                    if(is_partner_exist) 
                    {
                        JF_.emitter.emit("agent_initialized", ag_sid);
                    }
                    //-? Лончер НЕ запущен = запустить Лончера
                    else { 
                        t_names = ['start_agent']; 
                    }
                }                   
            }
            //----IF Agent TYPE is Launcher--------
            else if (MGS.agents[agent_index][MGS.TYPE] == "launcher") 
            {
                if (diff.is_diff) 
                {
                    if(is_partner_exist) { 
                        t_names = ['kill_agent']; 
                    }
                    else { 
                        t_names = ['sync_dirs']; 
                    }
                }
                else 
                {
                    if(is_partner_exist) 
                    { 
                        JF_.emitter.emit("agent_initialized", ag_sid); 
                    }
                    else { 
                        t_names = ['start_agent']; 
                    }
                }
            } 
            //----UNKNOWN AGENT TYPE --------
            else 
            {
                console.log("!!!!!!!!! complete__same_md5_agents(): UNKNOWN AGENT TYPE !");
            }

            //------------------------

            if (t_names.length > 0) {
                MGS.task_board( {
                    t_names: t_names, 
                    stage: MGS.FRESH, 
                    sid: ag_sid, 
                    //- next property is important, affects the behavior of next tasks
                    bundle_prev: 'same_md5_agents', 
                    bundle_next: bundle_next, 
                    who_call:"TFX.complete__same_md5_agents" 
                });
            }
            this.complete__default(task, ag_sid);

        };
        this.complete__kill_agent = function(task, ag_sid) 
        {
            // BUNDLE_PREV - IS VERY IMPORTANT THING
            console.log("TASK BUNDLE_PREV IS STRING TYPE: ", task[MGS.BUNDLE_PREV]);
            //- If 'kill' was called by 'same_md5_agents' task, then next task will sure 'sync_dirs' and then 'start'
            if (task[MGS.BUNDLE_PREV] == 'same_md5_agents') 
            {
                MGS.task_board( {
                    t_names:['sync_dirs'], 
                    stage: MGS.FRESH, 
                    sid: ag_sid, 
                    bundle_prev: "kill_agent",
                    who_call:"TFX.complete__kill_agent" 
                });
            }
            // case, when was many partners and need to kill all and then start one
            else if (task[MGS.BUNDLE_PREV] != 'same_md5_agents') 
            {
                MGS.task_board({
                    t_names:['start_agent'], 
                    stage: MGS.FRESH, 
                    sid: ag_sid, 
                    who_call:"TFX.complete__kill_agent" 
                });
            }

            this.complete__default(task, ag_sid);
        };
        this.complete__sync_dirs = function(task, ag_sid) 
        {
            // it possible in case when agent of Controller Type
            if (task[MGS.BUNDLE_PREV] == 'same_md5_agents') 
            {
                let prev_same_md5_task = MGS.find_prev_task_by_tname({tname: 'same_md5_agents', sid: ag_sid});
                if (!Array.isArray(prev_same_md5_task)) {
                    return console.log("!!! prev_same_md5_task is not an object") 
                }

                let is_partner_exist = prev_same_md5_task[MGS.ANSWER];
                if (is_partner_exist === true) {
                    JF_.emitter.emit('agent_initialized', ag_sid);
                }
                else if (is_partner_exist === false)
                {
                    MGS.task_board({
                        t_names:['start_agent'], 
                        stage: MGS.FRESH, 
                        sid: ag_sid, 
                        bundle_prev: "sync_dirs",
                        who_call:"TFX.complete__sync_dirs" 
                    });
                }
                else {
                    console.log("complete__sync_dirs(): unknown previous 'same_md5_agents' task answer:", is_partner_exist);
                }  
            }
            //if previous task was 'kill', then the next task will be unique 'start'
            else if (task[MGS.BUNDLE_PREV] == 'kill_agent') 
            {
                MGS.task_board( {
                    t_names:['start_agent'], 
                    stage: MGS.FRESH, 
                    bundle_prev: "sync_dirs",
                    sid: ag_sid, 
                    who_call:"TFX.complete__sync_dirs" 
                } );
            }
            else {
                console.log("ERROR: TFX.complete__sync_dirs(): unknown bundle !!!!!!!");
            }
            this.complete__default(task, ag_sid);
        };
        this.complete__start_agent = function(task, ag_sid)
        {           
            JF_.emitter.emit('agent_initialized', ag_sid);
            this.complete__default(task, ag_sid);
        };
        this.timeout__default = function(task, ag_sid) {
            //TODO: FIND ALL CHAIN TASKS BY 'NEXT_TID' TAIL AND CHANGE THEY STATES TO 'TIMEOUT' OR 'ERR'
            console.log("!!!! DEFAULT TIMEOUT FUNCTION !!!!");
            console.log("task name:", task[MGS.TNAME], ", agent sid:", ag_sid);
            if (task[MGS.STAGE] == MGS.SENT) task[MGS.STAGE] = MGS.T_OUT;
            if (task[MGS.STAGE] == MGS.GOT) task[MGS.STAGE] = MGS.T_OUT2;
        };
        this.error__default = function(task, ag_sid) {
            //TODO: FIND ALL CHAIN TASKS BY 'NEXT_TID' TAIL AND CHANGE THEY STATES TO 'ERR'
            console.log("!!!! DEFAULT ERROR FUNCTION !!!!");
            console.log("task name:", task[MGS.TNAME], ", agent sid:", ag_sid);
        };
    }
    //-----------------------------------------
    
    //--------VISUALIZER FOR BROWSERS----------
	function init_browser_visualizer(){}
	var list_of_subscribers = [];
	function manage_subscribers(socket_id, action) {
		var found = 0;
		var found_loc = [];
		for(var i = 0; i<list_of_subscribers.length; i++){
			if(list_of_subscribers[i] == socket_id){
				found = found + 1;
				found_loc.push(i);
			}
		}
		if(found == 0 && action == 'add'){
            list_of_subscribers.push(socket_id)
        }else if(found > 0 && action == 'remove'){
			for(var i = 0; i < found_loc.length; i++){
				list_of_subscribers.splice(found_loc[i], 1);
			}
		}
	}
	function transmit_info_to_browsers(data){
		for(var i = 0; i<list_of_subscribers.length; i++){
			io.to(list_of_subscribers[i]).emit('agent_table', data);
		}
    }


    //-----------------------------------------

// Master Global Structure
function initialize_main_glob_struct(){
    return MGS = {
    //[ ["launcher", "eD9iEX2094atE1eaAAAA", "8390m28384r", "192.168.0.100", 3922, 4425, "updating launcher", [[uid1,task1,1,0],[uid2,task2,0,0],..] ], [...]  ]
    agents: [],
    // [sid1, sid2, ...]
    unknown_agents: [],
    individuals: [],
	master: ['master','master'], //only tasks 1d array
    gcounter: 0,
    // TYPE = 'launcher' || 'controller'
    // SID = socket.id
    // TASKS = Array[<tasklist>]
    // INDIVIDUAL = means that Agent has own specific JOBS structure, because modified by UI.
    // PARTNERS = 0 || 1 || 2 (more than 1 is bad)
    TYPE:0, SID:1, MD5:2, IP:3, PID:4, PPID:5, APID:6, TASKS:7, INITIALIZED:8, INDIVIDUAL:9, UNIQ_TASKS:10, PARTNERS:11,
    TID:0, TNAME:1, STAGE:2, RAW:3, ANSWER:4, NEXT_TID:5, TMPL:6, TIMEPUSH:7, TIMESENT:8, TIMEEXTRA:9, TIMETOSTART:10, BUNDLE_NEXT:11, BUNDLE_PREV:12, AGING:13, KEEP_LAST:14, REPEATED:15,
    FRESH:0, SENT:1, GOT:2, DONE:3, EXTRA:4, ERR:5, BLOCKED:6, T_OUT:7, T_OUT2:8, DROPPED:9,//STAGES !
    main: function(){
        const JF_ = init_jobs_functions();
        JF_.init_();
        // at the beginning request dir manifest and send to agents
        console.log("Loading...");
        

        MGS.set_io_lisners(io);

        MGS.manifest.start_monitor_changes_2(SETTINGS.update_folder);

        MGS.call_runner(RUNNER_SPEED);
        //-----------------------------------------

        // get_dir_manifest_async(SETTINGS.update_folder).then(res => {
        //     console.log("got update manifest:", res);
        //     //MGS.manifest.mark_init_ready(res);
        //     this.manifest.is_ready_on_init = true;
        //     this.manifest.self = res;
        //     MGS.set_io_lisners(io);
        //     //* look for changes in update folder
        //     MGS.manifest.start_monitor_changes_2(SETTINGS.update_folder);
        // }).catch(ex => { console.log("fail getting manifest: ex:", ex); });
    },
    set_io_lisners: function(io, dashboard_){
        dashboard_ = (dashboard_) ? (dashboard_) : ("dashboard_main")
        //io.serveClient(false);
        io.on('connection', client => {
            var dashboard = dashboard_ || "dashboard_test";
            console.log("<< client connected:", client.id);
            //- while we don't know identifiers like md5 and something else
            MGS.unknown_agents.push(client.id);

            //just in case - if  recipient can't read the settings file
            MGS.io_outbox({event:'update_folder', client: client, payload: SETTINGS.update_folder});
            //SENDING REQUEST FOR IDS

            client.on('disconnect', info => 
            {
                
                MGS.unsubscribe_agent(client.id); 
                manage_subscribers(client.id, 'remove');	
            });

            client.on('browser_commands', data => {
                console.log("browser_commands: ", JSON.stringify(data));
                if(data instanceof Object) 
                {
                    //certain task from pre-defined tasks in the JOBS structure
                    if (data.what)
                    {
                        //- what, whom, when, how
                        //- if property 'what' of browser command matches with same property name in JOBS structure
                        if (JOBS[data.what] instanceof Object)
                        {
                            console.log("CMD FROM BROWSER IS PRESENT IN JOBS STRUCTURE");
                            let agent_md5, agent_type;
                            if (typeof data.whom == 'string') 
                            {
                                let splitter = data.whom.split("_");
                                agent_md5 = splitter[0];
                                agent_type = splitter[1];
                            }
                            let agent_index;
                            if (agent_md5 && agent_type) 
                            {
                                agent_index = MGS.find_agent_index_by_md5_and_type({
                                    md5:agent_md5,
                                    type:agent_type
                                });
                            }
                            
                            if (typeof agent_index == 'undefined') 
                            {
                                client.emit('jobs', "can't find agent by socket id");
                                return;
                            }
                            
                            let uniq_tasks = MGS.agents[agent_index][MGS.UNIQ_TASKS];
                            const task_in_array = uniq_tasks.findIndex(t => t == data.what);
                            if ( task_in_array == -1)
                            {
                                //if ( JOBS[data.what].stopped == true) 
                                MGS.task_board({
                                    stage: MGS.FRESH,
                                    t_names: [data.what], 
                                    raws: [data.how],
                                    sid: MGS.agents[agent_index][MGS.SID],
                                    timetostart: data.when  
                                });
                                //JOBS[data.what].stopped = false;
                                uniq_tasks.push(data.what);
                            }
                            else 
                            {
                                console.log("protection against double run: JOBS["+data.what+"] is not stopped");
                            }
                        }
                        //if command is not present in JOBS structure, when it is Arbitrary command
                        else if (data.what == "arbitrary_cmd")
                        {
                            let agent_md5, agent_type;
                            if (typeof data.whom == 'string') 
                            {
                                let splitter = data.whom.split("_");
                                agent_md5 = splitter[0];
                                agent_type = splitter[1];
                            }
                            let agent_index;
                            if (agent_md5 && agent_type) 
                            {
                                agent_index = MGS.find_agent_index_by_md5_and_type({
                                    md5:agent_md5,
                                    type:agent_type
                                });
                            }
                            
                            if (typeof agent_index == 'undefined') 
                            {
                                client.emit('jobs', "can't find agent by socket id");
                                return;
                            }

                            JOBS["exec_cmd"].parameters.command = data.how;
                            MGS.task_board({
                                stage: MGS.FRESH,
                                //t_names: ["arbitrary_cmd"], 
                                t_names: ["exec_cmd"], 
                                raws: [data.how],
                                sid: MGS.agents[agent_index][MGS.SID],
                                timetostart: data.when  
                            });

                            
                        }
                        else
                        {
                            console.log("xxxxxxxxxx BAD BROWSER COMMAND xxxxxxxxxxxx");
                        }
                    }
                    else if((data.command)&&(typeof data.agent != 'undefined')) 
                    {
                        MGS.task_board({ 
                            t_names: ["exec_cmd"], 
                            raws:[data],
                            stage: MGS.FRESH, 
                            sid: MGS.agents[data.agent][MGS.SID], 
                            who_call:"browser_commands"
                        });
                    } 
                    else if(data.operation) {
                        //"stop_repeated_task"
                        if (typeof JF_[data.operation] == 'function')
                        {
                            JF_[data.operation](data, client.id);
                        }
                            
                    }
                    else {console.log("browser_commands: wrong params: expected data.command and data.agent")}
                    
                }
                else if(typeof data == 'string')
                {
                    if (data == 'get_jobs_bt') {
                        client.emit("get_jobs_bt", [JOBS, ALT_JOBS]);
                    } 
                }
            });
            
            client.on('get_socket_id', data =>
            {
                // we know this is browser
                console.log("get_socket_id recevied: "+ data);
                var this_socket_id = client.id;
                manage_subscribers(this_socket_id, 'add');
                io.to(this_socket_id).emit('id_assigned', this_socket_id);
            });
            
            client.on('report', data_ => {
                let data = (data_) ? (data_) : {};
                console.log("<<< Agent 'report': ", data.title);
                //let agent_index = MGS.find_agent_index_by_sid(client.id);
                switch (data.title)
                {
                    case "identifiers":
                        //? 1) data.done - means that everything all right
                        if (!data.done) {
                          return console.log("ERR: client can't prepare identifiers: cause:", data.cause);
                        }
                        if (!data.payload) {
                          return console.log("ERR: Agent's identifiers are empty! Can't subscribe agent !");
                        }
                        //? payload - this is agent identifiers. 
                        MGS.subscribe_agent(client, data.payload);

                        if (MGS.manifest.self) {
                            MGS.task_board({ t_names: ["manifest"], stage: MGS.FRESH, sid: client.id, bundle_next: "same_md5_agents", who_call:"client report "+data.title });
                        }
                        // here we allow our stream of JOBS
                        if (data.payload[MGS.TYPE] == 'controller'){
                            //delete_this_later:("controller connected! pass to JOBS 'void_controller'!");
                            return JF_.emitter.emit('controller_comes', client.id);
                        }
                        else if (data.payload[MGS.TYPE] == 'launcher'){
                            //delete_this_later:("launcher connected! pass to JOBS 'void_launcher'!");
                            return JF_.emitter.emit('launcher_comes', client.id);
                        }
                        else { console.log("unknown agent type connected!"); }

                        break;
                    //* Agent confirms that it has been received manifest
                    case "manifest":
                    case "same_md5_agents":
                    case "kill_agent":
                    case "sync_dirs":
                    case "start_agent":
                    case "housekeeping":
                    case "disk_space":
                    case "proc_count":
                    case "exec_cmd":
                    case "nvidia_smi":
                        let answer = {tid: data.tid, answer: data.answer, stage: MGS.GOT, sid: client.id }
                        if (data.done == false) {
                            answer.stage = MGS.ERR;
                        } 
                        MGS.task_board(answer);
                        break;
                    case undefined:
                        console.log("incoming 'report' event without data!");
                        break;
                    default:
                        console.log("unregistered 'report' event !");
                        MGS.task_board( {stage: MGS.GOT, tid: data.tid, answer: data.answer,  sid: client.id} );
                        break;
                }
            });
            
            client.on('report_error', err_ => {
                let agent_i = MGS.find_agent_index_by_sid(client.id);
                if(typeof agent_i == 'undefined') {
                    //? seems like error was critical and client was destroyed immediately after this message
                    console.log("seems like agent was already destroyed:", err_);
                }

                console.log("error report from " + client.id + ":" + err_);
            });

            client.on('request_action', data_ => {
                let data = (data_) ? (data_) : {};
                console.log("<<< socket 'request_action' event:", data.title);
                //* find Agent or subscribe if not yet subscribed
                //* perhaps this is unnecessary. subscribing already was on 'report identifiers' event
                let requester_index = MGS.self_subscribe_agent_and_get_index;
                for (let i in data.titles) {
                switch (data.titles[i]){
                    //* 'data.from' property can be "launcher" or "controller"
                    case undefined:
                        console.log("incoming 'request_action' event without data!");
                        break;
                    default:
                        console.log("UNKNOWN ACTION REQUEST !");
                }
                }
            });
            client.on('request_info', data_ => {
                let data = (data_) ? (data_) : {};
                console.log("<<< socket 'request_info' event:", data.title);
                switch (data.title){
                    //* client want to get identifiers of agents which runs on the same machine
                    case "same_md5_agents":
                        let same_md5_agents = MGS.find_same_md5_agents_except_self_type({sid: client.id});
                        MGS.io_outbox({event:'same_md5_agents', client: client, payload: same_md5_agents});
                        break;
                    case "manifest":
                        break;
                    case undefined:
                        console.log("incoming 'request_info' event without data!");
                        break;
                    default:
                        console.log("UNKNOWN INFO REQUEST !");
                }
            });
        });    
	/*
	setTimeout(()=>{
		console.log("attaching http server..");
		io.attach(http_srv);
	}, 4000);
	*/
    },
    io_outbox: function(args){
        if (args) {
            if (!args.client) {throw "Error: empty 'client' param"}
            switch (args.event) {
                // From: MGS.manifest.start_monitor_changes()
                case 'identifiers':
                case 'manifest':
                //* em.data: {update_folder: SETTINGS.update_folder}
                case "update_folder":
                case "update_agent":
                case "same_md5_agents":
                    //data.client.emit(data.event, data.payload);
                    args.client.emit(args.event, args.payload);
                    break;
                case "kill_agent":
                    if(args.taskboard){
                        //* Mean - COntains emitter object to wait Answer
                        args.payload.taskboard = args.taskboard;
                        args.client.emit(args.event, args.payload, ack=>{console.log("LLLLLLI:acknowledgementsacknowledgements!")});
                    }
                    break;
                default:
                    console.log("io_outbox(): unknown event");
            }
        }
        else { console.log("no params in io_outbox() !"); }
    },
    io_outbox_2: function(arg) {
        //- arg = {event: 'event name', sid: socket.id }
        if (typeof arg == 'object') {
            let is_sid = (typeof arg.sid == 'string');
            let is_event = (typeof arg.event == 'string');
            if (is_sid && is_event) {   
                io.to(arg.sid).emit(arg.event, arg.payload);
            }
            else { console.log("MGS.io_outbox_2(): expected 'sid' and 'event' properties"); }
        }
        else { console.log("MGS.io_outbox_2(): expected argument is Object type"); }
    },
	runner_process_task_according_its_stage: function(agent_ind, task_ind)
	{
		let task = MGS.agents[agent_ind][MGS.TASKS][task_ind];
		let sid  = MGS.agents[agent_ind][MGS.SID];
		let is_tasks_loop_must_break = false;
        let timeout, 
            timeout_f,
            timelast;
            
		switch (task[MGS.STAGE]) 
		{
			case MGS.FRESH:
                let timestamp = new Date().getTime(); 
				if(typeof (task[MGS.TIMETOSTART]) == "undefined" ) {
                    task[MGS.TIMETOSTART] = timestamp; 
                }
				//-If it was deffered(pending) task and the time has NOT come
				if(task[MGS.TIMETOSTART] > timestamp)  {
                    break;
                }

                task[MGS.TIMESENT] = timestamp;
                var start_fu_name;
                
                //- EACH TASK MUST HAVE A TEMPLATE, at least DEFAULT TEMPLATE
                if (typeof TEMPLATES[task[MGS.TMPL]] != 'object') {
                    console.log("ERR: call_runner(): stage FRESH: No such template in TEMPLATES structure")
                    task[MGS.STAGE] = "ERR";
                    break;
                }	
                start_fu_name = TEMPLATES[task[MGS.TMPL]].start_f;
                

                //-? From here we have Two ways: pipe to JSF Structure:
                //-?-------------------------------------------
                //- if task name is present in JOBS structure, then it should be described in JSF structure
                if (JOBS[task[MGS.TNAME]]) 
                {
                    if (typeof JSF[start_fu_name] == 'function'){
                        JSF[start_fu_name](task, sid);
                    } 
                    else {
                        JSF.start__default(task, sid);
                    }
                } 
                //-? or it should be looked in TFX Structure:
                //-?-------------------------------------------
                else if (typeof TFX[start_fu_name] == 'function') {
                    TFX[start_fu_name](task, sid);
                }
                //-? or Error STATE:
                //-?-------------------------------------------
                else {
                    console.log("ERR: No corresponding start function for task:", task[MGS.TNAME]);
                    task[MGS.STAGE] = "ERR";
                    break;
                }

				break;
				
			case MGS.SENT:
				timelast = new Date().getTime() - task[MGS.TIMESENT];
				timeout = TEMPLATES[task[MGS.TMPL]].timeout;
				timeout_f = TEMPLATES[task[MGS.TMPL]].timeout_f;
				//- reinsure existense of timeout template 
				if (typeof timeout != 'number') {TEMPLATES[task[MGS.TMPL]].timeout = 10000}
				if (timelast < timeout) {
                    break;
                }
                if (JOBS[task[MGS.TNAME]]) {
                    if (typeof JTF[timeout_f] == 'function') JTF[timeout_f](task, sid);
                    else JTF[timeout__default](task, sid);
                } 
                else if (typeof TFX[timeout_f] == 'function'){ 
                    TFX[timeout_f](task, sid); 
                }
                else TFX(timeout__default)(task, sid);

				break;
                        
			case MGS.GOT:
				task[MGS.STAGE] = MGS.EXTRA;
				task[MGS.TIMEEXTRA] = new Date().getTime();

				var complete_fu_name = TEMPLATES[task[MGS.TMPL]].complete_f;

                if (JOBS[task[MGS.TNAME]]) 
                {
					if (typeof JCF[complete_fu_name] == 'function') {
                        JCF[complete_fu_name](task, sid);
                    }
					else {
                        JCF.complete__default(task, sid);
                    }
				} 
                else if (typeof TFX[complete_fu_name] == 'function')
                {
                    TFX[complete_fu_name](task, sid);
                }
                else 
                {
                    console.log("ERR: No corresponding complete function for task name:", task[MGS.TNAME]);
                    task[MGS.STAGE] = "ERR";
                }
				break;
			
			case MGS.EXTRA:
				timelast = new Date().getTime() - task[MGS.TIMEEXTRA];
				
				timeout = TEMPLATES[task[MGS.TMPL]].timeout;
				timeout_f = TEMPLATES[task[MGS.TMPL]].timeout_f;
				
				if (timelast < timeout) {
                    break;
                }
                if (JOBS[task[MGS.TNAME]]) {
                    if (typeof JTF[timeout_f] == 'function') {
                        JTF[timeout_f](task, sid);
                    }
                    else {
                        JTF[timeout__default](task, sid);
                    }
                } 
                else if (typeof TFX[timeout_f] == 'function'){ 
                    TFX[timeout_f](task, sid); 
                }
                else TFX(timeout__default)(task, sid);

				break;	
			
			case MGS.DROPPED:
			case MGS.DONE:
			case MGS.T_OUT:
			case MGS.T_OUT2:
				//* 1) Do Nothing. Runner will Go to the Next Task
				break;
				
			case MGS.ERR:
				let error_f = TEMPLATES[task[MGS.TMPL]].error_f;
				
				if (JOBS[task[MGS.TNAME]]) {
					if (typeof JEF[timeout_f] == 'function')
						JEF[error_f](task, sid);
					else JEF[error_f](task, sid);
				} 
				else if (typeof TFX[error_f] == 'function'){
					TFX[error_f](task, sid);
				}
				else TFX(error__default)(task, sid);

				break;
				
			case MGS.BLOCKED:
				//* TODO: need to make a timeout decision !
				is_tasks_loop_must_break = true; 
				break;
			case undefined:
				console.log("ERR: call_runner(): STAGE undefined !");
				task[MGS.STAGE] = MGS.ERR;
				break;
			default:
				console.log("ERR: call_runner(): unknown STAGE !");
				task[MGS.STAGE] = MGS.ERR;
				break;
        }
        //- if task has 'blocking' type - then exit from Tasklist
        if (typeof TEMPLATES[task[MGS.TMPL]] == 'object'){
			if (TEMPLATES[task[MGS.TMPL]].blocking === true){
				if (task[MGS.STAGE] != MGS.DONE) { is_tasks_loop_must_break = true; }
			}
		}
		return is_tasks_loop_must_break;
                    
	},
	runner_for_master: function() 
	{
		for (let i in MGS.master[MGS.TASKS]) {
			let one_task = MGS.master[MGS.TASKS][i];
			
			let tasks_loop_break = false;
			let timelast = null;

			switch (one_task[MGS.STAGE]) {
				case MGS.FRESH:
					if(typeof (one_task[MGS.TIMETOSTART]) == "undefined" ) { 
						one_task[MGS.TIMETOSTART] = new Date().getTime(); 
					}
					//? if the time has come, then send task to execute!
					if(one_task[MGS.TIMETOSTART] <= new Date().getTime()) {
						//one_task[MGS.STAGE] = MGS.SENT;
						one_task[MGS.TIMESENT] = new Date().getTime();

						let start_fu_name = TEMPLATES[one_task[MGS.TMPL]].start_f;
						// Да, при void_master Это условие сработает
						if (JOBS[one_task[MGS.TNAME]]) {
							//delete_this_later:("calling JSF["+TEMPLATES[one_task[MGS.TMPL]].start_f+"] function!");
							if (JSF[start_fu_name]) 
								JSF[start_fu_name](one_task, MGS.master[MGS.SID]);
							else JSF.start__default(one_task, MGS.master[MGS.SID]);
						} 
						else { console.log("call_runner(): master list: stage FRESH: no task name in JOBS structure!") }
						//* 2) if task has 'blocking' type - then exit Tasklist
						if (TEMPLATES[one_task[MGS.TMPL]].blocking){ tasks_loop_break = true; }
						break;
					}
					break;
				case MGS.SENT:
					timelast = new Date().getTime() - one_task[MGS.TIMESENT];
					if (timelast > TEMPLATES[one_task[MGS.TMPL]].timeout) {
						let timeout_fu_name = TEMPLATES[one_task[MGS.TMPL]].timeout_f;
						if (JOBS[one_task[MGS.TNAME]]) {
							if (typeof JTF[timeout_fu_name] == 'function') {
								JTF[timeout_fu_name](one_task, one_task[MGS.SID]);
							} else { console.log("call_runner(): master list: stage SENT: no function in JTF structure!") }
						} else { console.log("call_runner(): master list: stage SENT: no task name in JOBS structure!") }
					}
					if (TEMPLATES[one_task[MGS.TMPL]].blocking){ tasks_loop_break = true; }
					break;
				case MGS.GOT:
					one_task[MGS.STAGE] = MGS.EXTRA;
					one_task[MGS.TIMEEXTRA] = new Date().getTime();
					let complete_fu_name = TEMPLATES[one_task[MGS.TMPL]].complete_f;
					if (JOBS[one_task[MGS.TNAME]]) {
						if (typeof JCF[complete_fu_name] == 'function')
							JCF[complete_fu_name](one_task, MGS.master[MGS.SID]);
						else JCF.complete__default(one_task, MGS.master[MGS.SID]);
					} 
					else { console.log("call_runner(): master list: stage GOT: no task name in JOBS structure!") }
					//? 3) exit Tasklist
					if (TEMPLATES[one_task[MGS.TMPL]].blocking){ tasks_loop_break = true; }
					break;
				case MGS.EXTRA:
				case MGS.DONE:
				case MGS.T_OUT:
				case MGS.T_OUT2:
				case MGS.ERR:
				case MGS.BLOCKED:
				case undefined:
				default:
                    break;
			}
			if (tasks_loop_break) break;
		}
		//? -----Delete Master's Aging tasks-----
		let master_tlist = MGS.master[MGS.TASKS];
		for (let t in master_tlist) {
			//? if task Done and Aging is over - than Delete task
			if (master_tlist[t][MGS.STAGE] == MGS.DONE) {
				//Delete Task if its AGE has Expired
				let now = new Date().getTime();
				if ( (master_tlist[t][MGS.TIMEPUSH] + master_tlist[t][MGS.AGING]) < now ) {
					console.log("delete Aging task:", master_tlist[t][MGS.TNAME], ", Age:",master_tlist[t][MGS.AGING]);
					master_tlist.splice(t, 1);
				}
			}
		}
	},
	call_runner: function(speed)
	{
        
    },
    task_board: function(arg_) 
	{    
        //* arg = { t_names:Array, raws:Array, stage:Number, sid:String, template:Object }
        //---------------------------------------------------------------
        //-------------EXCEPTION PART--------------------
        //---------------------------------------------------------------
        let arg = (arg_)?(arg_):{};
		console.log("task_board(): caller:", arg_.who_call, ", Stage:", arg.stage, ", Task Name:", arg.t_names)
        if (!arg.raws) arg.raws = [];
        if (Object.keys(arg).length == 0) { console.log("ERR: task_board(): entry params are empty !"); return; }
        //---------------------------------------------------------------
        
        let agent_uniq_key = "main";

        //---------------------------------------------------------------
        //---- arg.sid == "all" - for example new Manifest to all Agents
        //---------------------------------------------------------------
        if( (typeof arg.sid == 'string')&&(arg.sid.startsWith('all')) ) 
        {
            for (let a in MGS.agents) {
                if ( (arg.sid == 'all controllers')&&((MGS.agents[a][MGS.TYPE]!='controller')) ) 
                { continue; }
                else if ( (arg.sid == 'all launchers')&&((MGS.agents[a][MGS.TYPE]!='launcher')) ) 
                { continue; }
                //----------------------------------------------
                //--if Agent behavior was changed through UI ---
                //----------------------------------------------
                for (let tn in arg.t_names) 
                {
                    let one_task = this.design_one_task(arg, tn, agent_uniq_key='main');
                    MGS.agents[a][MGS.TASKS].push(one_task);
                }
            }
        }
        //---------------------------------------------------------
        //-----------TASK INTENDED FOR CONCRETE AGENT--------------
        //---------------------------------------------------------
        else 
        {
            //- getting agent unique key which needs for identifying when break loop of self-started tasks

            //? coming new task to be executed by agent or master
            if (arg.stage == MGS.FRESH) 
            {
                if(typeof arg.t_names == 'undefined') { 
                    console.log("task_board() err: t_names is undefined !"); 
                    return;
                }

                //? check if tnames String then modify to Array. 
                let checks = check_tnames_and_raws(arg);
                if ( checks.done === false) 
                { 
                    console.log(checks.msg); 
                    return; 
                }
                
                let aindex;
                //---------------------------------------------------------
                //--- If task is not intended for Master, but for Agent ---
                //---------------------------------------------------------
                if (arg.sid != 'master') {
                    //- So, it's become necessary to find Agent by socket.id, otherwise return
                    aindex = MGS.find_agent_index_by_sid(arg.sid);
                    if (typeof aindex == 'undefined') {
                        console.log("task_board ERR: fail to find agent by sid !");
                        return;
                    }
                    if(MGS.agents[aindex][MGS.INDIVIDUAL]) {
                        agent_uniq_key = MGS.agents[aindex][MGS.MD5] + "_" + MGS.agents[aindex][MGS.TYPE];
                    }
                }
                
                //-------------------------------------------------------------
                //----------------PUT TASK IN DOER'S TASKLIST------------------
                //-------------------------------------------------------------
                for (let tn=0; tn < arg.t_names.length; tn++) 
                {
                    let one_task = this.design_one_task(arg, tn, agent_uniq_key);
                    //? Put new Task in Master's list or in Agent's tasklist !
                    if (arg.sid == 'master') 
                    {
                        if(typeof MGS.master[MGS.TASKS] == 'undefined') { MGS.master[MGS.TASKS] = []; }
                        MGS.master[MGS.TASKS].push(one_task);
                    }
                    else 
                    {
                        MGS.agents[aindex][MGS.TASKS].push(one_task);
                    }
                }
                //if (arg.block_partner) {}
                //-------------------------------------------------------
            }
            //? the response was received from the agent or master
            else if (arg.stage == MGS.GOT) 
            {
                //? arg = {tid: data.tid, t_names: ["manifest"], answer: data.is_diff, stage: MGS.GOT, sid: client.id }
                if (typeof arg.tid == "undefined") {
                    console.log("ERR: task_board(): can't find task by TID in Master's tasklist!");
                    return;
                } 
                //-------------------------------------------
                //? Finding Task in Tasklist among Agents or in Master's tasklist
                //-------------------------------------------
                let task = this.find_task_by_tid_among_agents({tid: arg.tid, sid: arg.sid});
                if(!task) { 
                    task = this.find_task_by_tid_in_master_tasks({tid: arg.tid});
                }
                if(!task) {
                    console.log("ERR: task_board(): can't find task by TID nor in Agents tasklist nor in Master's tasklist!");
                    return;
                } 
                //------------------------------------------- 
                //? Changing task STAGE and put ANSWER
                //-------------------------------------------
                if (Array.isArray(task)) {
                    task[MGS.STAGE] = arg.stage; 
                    task[MGS.ANSWER] = arg.answer; //maybe undefined
                } 
                else { console.log("ERR: task_board(): Expected, that task must be an Array type!"); }
            }
            else { console.log("ERR: task_board(): unexpected STAGE !"); }
        }
        function task_board_part_old_when_alt_jobs() {
            if (MGS.agents[a][MGS.INDIVIDUAL])
            {
                agent_uniq_key = MGS.agents[a][MGS.MD5] + "_" + MGS.agents[a][MGS.TYPE];
                if (ALT_JOBS[agent_uniq_key] instanceof Object)
                {    
                    for (let tn in arg.t_names) {
                        //---- if specific task name was stopped through UI ---
                        if (ALT_JOBS[agent_uniq_key][arg.t_names[tn]]) {
                            let individual_task = this.design_one_task(arg, tn, agent_uniq_key);
                            MGS.agents[a][MGS.TASKS].push(individual_task);
                        }
                    }
                }
                else {console.log("ALT_JOBS[agent_uniq_key] NOT instanceof Object")}
            }
        }
        function check_tnames_and_raws(arg){
            //delete_this_later:("checking params: t_names=", arg.t_names);
            let checks = {};
            checks.done = true;
            if (!Array.isArray(arg.t_names)) {
                if (typeof arg.t_names == 'string') { arg.t_names = [arg.t_name]; }
                else { 
                    checks.msg = "ERR: task_board(): 't_names' param must be String or Array type !"; 
                    checks.done = false;
                }
            }
            if (typeof arg.raws == 'string') {arg.t_names = [arg.t_name];}
            return checks;
        }
    },
    design_one_task: function(arg, tname_index, agent_uniq_key) {
        if (!(arg instanceof Object)) return "arg not an Object"
        let one_task = [];
        let tname = arg.t_names[tname_index];
        one_task[MGS.TID] = ++MGS.gcounter; //incremental global counter
        one_task[MGS.TNAME] = tname; //obligatory parameter
        one_task[MGS.RAW] = arg.raws[tname_index]; //raw to send to client or master
        one_task[MGS.STAGE] = arg.stage; //obligatory parameter
        one_task[MGS.TIMEPUSH] = new Date().getTime(); //standalone assign
        one_task[MGS.TIMETOSTART] = arg.timetostart; //deferred execution
        one_task[MGS.BUNDLE_NEXT] = arg.bundle_next; //maybe undefined
        one_task[MGS.BUNDLE_PREV] = arg.bundle_prev; //maybe undefined
        if (arg.t_names[tname_index+1]) { one_task[MGS.NEXT_TID] = MGS.gcounter + 1; }
        //TODO: get uniq_key consists of md5 + "_" + type
        //----------------------------------------------------
        //-----COUNT TASKNAMES in ALTERNATE JOBS SCHEDULE-----
        if (typeof JF_.repeated_jobs[agent_uniq_key] == 'undefined') 
        {
           JF_.repeated_jobs[agent_uniq_key] = {};
        } 
        console.log("=====JF_.repeated_jobs =", util.inspect(JF_.repeated_jobs));
        one_task[MGS.REPEATED] = JF_.repeated_jobs[agent_uniq_key][ arg.t_names[tname_index] ]; // 0||1||2||...
        
        //-------------------------------------
        //-----DEFINE TASK TEMPLATE------------
        //-------------------------------------
        if (arg.template instanceof Object) 
        { 
            if (TEMPLATES[tname] instanceof Object) 
            {
                TEMPLATES[tname] = Object.assign(TEMPLATES[tname], arg.template);
                one_task[MGS.TMPL] = tname;
                one_task[MGS.AGING] = TEMPLATES[tname].aging;
            }
            else
            {
                TEMPLATES[tname] = arg.template;
                one_task[MGS.TMPL] = tname;
            } 
        }
        else if (typeof TEMPLATES[tname] == 'object') 
        { 
            //? If template Exists with name that matches with task name:
            one_task[MGS.TMPL] = tname; 
            one_task[MGS.AGING] = TEMPLATES[tname].aging;           
        }
        else 
        {
            one_task[MGS.TMPL] = "default"; 
            one_task[MGS.AGING] = TEMPLATES['default'].aging; 
        }
        //-------------------------------------
        return one_task;
    },
    check_array_exist: function(arr){
        if ((typeof arr != 'undefined')&&(Array.isArray(arr))) 
            return arr;
        else return false;
    },
    accumulate_properties: function() {
        //? priority will be by index ! 0 - first, 1 - second
        for (var i = 0; i < arguments.length; i++) {
            if (typeof arguments[i] == 'object') {

            }
          }

    },    
    manifest: {
        self: null,
        is_ready_on_init: false,
        mark_init_ready: function(manifest) {
            this.is_ready_on_init = true;
            this.self = manifest;
        },
        deaf_list: [],
        add_to_deaf_list: function(client) {
            this.deaf_list.push(client);
        },
        notify_deaf: function() {
            if (this.deaf_list.length > 0) {
                if ((this.self)&&(this.self.length > 0)) {
                    for (let client in this.deaf_list) {
                        let id = this.deaf_list[client].id;
                        MGS.task_board({t_names: ["manifest"], stage: MGS.FRESH, sid: id, bundle: "same_md5_agents", who_call:"MGS.manifest.notify_deaf" });
                        //this.deaf_list[client].emit('manifest', this.self);
                    }
                }
                this.deaf_list = [];//clear
            }
        },
        start_monitor_changes: function(upd_fold){
            setInterval(()=>{
                // CLONE BUT NOT REFERENCE
                let old_manifest = MGS.manifest.self;
                console.log("checking updates...");
                // if it is a folder, then additional property 'emty_dir' with index '3'
                get_dir_manifest_async(upd_fold).then(manifest => {
                    MGS.manifest.self = manifest;
                    //delete_this_later:("comparing updates...");
                    let is_diff = MGS.manifest.compare(old_manifest, manifest);
                    if (is_diff) {
                        MGS.task_board({t_names: ["manifest"], stage: MGS.FRESH, sid: "all", bundle_next:'same_md5_agents', who_call:"changes in update directory" });
                    }
                }).catch(ex => { console.log("ERR:", ex); });
            }, SETTINGS.update_folder_watch_timer);
        },
        start_monitor_changes_2: function(upd_fold)
        { 
          const FIRST_DELAY = 10000;
          setTimeout(()=> {
            //- Remember the old manifest
            let old_manifest = MGS.manifest.self;

            get_dir_manifest_async(upd_fold).then(manifest => {
                //- save new manifest
                MGS.manifest.self = manifest;
                let is_diff = MGS.manifest.compare(old_manifest, manifest);

                if (is_diff) {
                    console.log("start_monitor_changes_2(): there are updates...");
                    MGS.task_board({t_names: ["manifest"], stage: MGS.FRESH, sid: "all", bundle_next:'same_md5_agents', who_call:"changes in update directory" });
                }
                setTimeout(()=>{ 
                    this.start_monitor_changes_2(upd_fold); 
                }, SETTINGS.update_folder_watch_timer);

            }).catch(ex => { 
                console.log("ERR:", ex); 
                setTimeout(()=>{ 
                    this.start_monitor_changes_2(upd_fold); 
                }, SETTINGS.update_folder_watch_timer);
            });
          }, FIRST_DELAY);   
        },
        compare: function(old, fresh){
            if ((old)&&(old.length > 0)&&(fresh)&&(fresh.length > 0)){
                let changes = compare_manifests_2rp(old, fresh);
                if ((changes.copy_names.length > 0) || (changes.empty_dirs.length > 0)) {
                    console.log("there are update files!");
                    return true;
                } else {
                    return false;
                }
            }
        },
    },
    check_if_server_side_task: function(t_attrs){
        let is_master_task = false;
        if(typeof t_attrs == 'object'){
            if (t_attrs.server_side === true) { is_master_task = true; }
            if (t_attrs.sid == 'master') { is_master_task = true; }
        }
        return is_master_task;
    },
    subscribe_agent: function(client, identifiers){
        //delete_this_later:("subscribe_agent():", client.id);
        console.log("SUBSCRIBING AGENT:", identifiers);
        if (identifiers)
        {
            identifiers[MGS.SID] = client.id;
            identifiers[MGS.IP] = client.handshake.address;
            identifiers[MGS.TASKS] = [];
            identifiers[MGS.UNIQ_TASKS] = Object.keys(JOBS);
            console.log("SUBSCRIBE = ", identifiers);
            this.agents.push(identifiers);

            MGS.unknown_agents = drop_from_unknown_agents(MGS.unknown_agents, client.id);

            this.say_to_partners_agent_leaved_or_appeared(client.id, 'appeared');

            return this.agents.length - 1;
        } 
        else 
        {
            console.log("subscribe_agent(): Empty 'identifiers' param !");
            return;
        }

        function drop_from_unknown_agents(arr, sid){
            return arr.filter(function(itm){return itm != sid});
        }

    },
    unsubscribe_agent: function(agent_sid) {
        console.log("UNSUBSCRIBING AGENT:", agent_sid);
        if (this.agents.length > 0) {
            for (let i in this.agents) {
                if (this.agents[i][MGS.SID] == agent_sid) {
                    //---------------------------------------------
                    //-----if the agent was closed by a person-----
                    //---------------------------------------------
                        if (this.agents[i][MGS.TASKS].length > 0) {
                        if (this.agents[i][MGS.TASKS][0][MGS.STAGE] != MGS.BLOCKED) {
                            this.say_to_partners_agent_leaved_or_appeared(agent_sid, 'leaved');
                        }
                    }
                    //-------------------------------------------
                    this.agents.splice(i, 1);
                    break;
                }
            }
            
        }
    },
    say_to_partners_agent_leaved_or_appeared: function(sid, in_out){
        let partners = this.find_same_md5_agents_except_self_type({sid: sid});
        if (partners.length == 0) {
            return;
        }

        let state_agent;
        let state_agent_index = MGS.find_agent_index_by_sid(sid);
        if ((typeof state_agent_index == 'number')&&(state_agent_index > -1)) {
            state_agent = MGS.agents[state_agent_index];
        }


        for (let i in partners) {
            this.io_outbox_2({
                event: 'partner_'+in_out, 
                sid: partners[i][MGS.SID],
                payload: state_agent || sid
            })
        }
    },
    self_subscribe_agent_and_get_index: function(client, identifiers){
        let requester_index = MGS.find_agent_index_by_sid(client.id);
            if (!requester_index) {
                MGS.subscribe_agent(client, identifiers);
                requester_index = MGS.agents.length - 1;
            }
        return requester_index;
    },
    find_all_same_md5_agents: function(arg){
        //* arg = {identifiers: []} or {sid: <soket.id>}
        //* if 'with_tlist' param is exist, then return agents with they tasks
        let res = [];
        if (arg){
            let md5_ = null;
            if (arg.identifiers){ md5_ = arg.identifiers[MGS.MD5]; }
            else if(arg.sid) {
                let requester_index = this.find_agent_index_by_sid(arg.sid);
                md5_ = MGS.agents[requester_index][MGS.MD5];
            }
            else { console.log("ERR: find_all_same_md5_agents(): wrong params: expect 'sid' or 'identifiers'!"); }
            if (!md5_) { console.log("ERR: find_all_same_md5_agents(): can't find 'MD5' of Requester !"); }
            //* Find client with the same MD5
            
            for (let i in MGS.agents) {
                if (MGS.agents[i][MGS.MD5] == md5_) {
                    if(arg.with_tlist) { res.push(MGS.agents[i]);  }
                    else { 
                        let arr = [];
                        arr[MGS.TYPE] = MGS.agents[i][MGS.TYPE];
                        arr[MGS.MD5]  = MGS.agents[i][MGS.MD5];
                        arr[MGS.SID]  = MGS.agents[i][MGS.SID];
                        arr[MGS.IP]   = MGS.agents[i][MGS.IP];
                        arr[MGS.PID]  = MGS.agents[i][MGS.PID];
                        arr[MGS.PPID] = MGS.agents[i][MGS.PPID];
                        arr[MGS.APID] = MGS.agents[i][MGS.APID];
                        res.push(arr); 
                    }
                    
                }
            }
        }
        else { console.log("ERR: find_all_same_md5_agents(): empty params!"); }
        return res;
    },
    find_same_md5_agents_except_self_type: function(arg){
        //* arg = {identifiers: []} or {sid: <soket.id>}
        //* if 'with_tlist' param is exist, then return agents with they tasks
        if (typeof arg == 'undefined') return new Error("function argument is empty");
        let res = [];
		let md5_ = null,  
			type_ = null;
		if (arg.identifiers){
			md5_ = arg.identifiers[MGS.MD5];
			type_ = arg.identifiers[MGS.TYPE];
		}
		else if(arg.sid) {
            let requester_index = this.find_agent_index_by_sid(arg.sid);
            if(typeof requester_index != 'undefined') {
                md5_ = MGS.agents[requester_index][MGS.MD5];
                type_ = MGS.agents[requester_index][MGS.TYPE];
            }
		}
		if (!md5_) return "cant find MD5";

		//delete_this_later:("MGS.agents =", JSON.stringify(MGS.agents));
		
		for (let i in MGS.agents) {
			//* Find client with the same MD5
			if (MGS.agents[i][MGS.MD5] == md5_) {
				//* And not same type
				if(MGS.agents[i][MGS.TYPE] != type_) {
					//- if you want to collect agents with them tasklists
					if(arg.with_tlist) { res.push(MGS.agents[i]);  }
					//- or without tasklist, only agents requisities
					else { 
						let arr = [];
						arr[MGS.TYPE] = MGS.agents[i][MGS.TYPE];
						arr[MGS.MD5]  = MGS.agents[i][MGS.MD5];
						arr[MGS.SID]  = MGS.agents[i][MGS.SID];
						arr[MGS.IP]   = MGS.agents[i][MGS.IP];
						arr[MGS.PID]  = MGS.agents[i][MGS.PID];
						arr[MGS.PPID] = MGS.agents[i][MGS.PPID];
						arr[MGS.APID] = MGS.agents[i][MGS.APID];
						res.push(arr); 
					}
				}
			}
		}
        return res;
    },
    find_agent_index_by_md5_and_type: function(obj){
        //obj= {md5, type}
        let requester_index;
        if (obj instanceof Object)
        {
            if(obj.md5 && obj.type)
            {
                for (let i in this.agents) 
                {
                    if (this.agents[i][MGS.MD5] == obj.md5) 
                    {
                        if (this.agents[i][MGS.TYPE] == obj.type) 
                        {
                            requester_index = i;
                            break;
                        }
                    }
                }
            }
        }
        
        return requester_index;
    },
    //returns number or undefined
    find_agent_index_by_sid: function(sid){
        let requester_index;
        for (let i in this.agents) {
            if (this.agents[i][MGS.SID] == sid) {
                console.log(i);
                requester_index = i; break;
            }
        }
        //delete_this_later:("MGS.find_agent_index_by_sid():  requester_index =", requester_index);
        //if (typeof requester_index != 'undefined') requester_index = parseInt(requester_index, 10);
        if (typeof requester_index != 'undefined') {
            //delete_this_later:("WTF?!?!?!");
            requester_index = parseInt(requester_index, 10);
        } 
        //delete_this_later:("MGS.find_agent_index_by_sid(): TYPEOF requester_index =", typeof requester_index);
        return requester_index;
    },
    find_task_by_tid_among_agents: function(obj) {
        //* obj = {tid, sid}
        let task;
        if ((obj.sid)&&(obj.tid)) {
            let agent_index = MGS.find_agent_index_by_sid(obj.sid);
            if (typeof agent_index != 'undefined') {
                let tlist = MGS.agents[agent_index][MGS.TASKS];
                if (Array.isArray(tlist)) {
                    for (let t in tlist) {
                        if (tlist[t][MGS.TID] == obj.tid) {
                            task = tlist[t];
                            break;
                        }
                    }    
                }
            }
            else { console.log("find_task_by_tid_among_agents(): Can't find Agent in Agents list"); }
        } else { console.log("find_task_by_tid_among_agents(): No params 'sid' or 'tid'"); }
        return task;
    },
    find_task_by_tid_in_master_tasks: function(obj) {
        let task;
        if (obj.tid){
            let tlist = this.master[MGS.TASKS];
            if (Array.isArray(tlist)) {
                for (let t in tlist) {
                    if (tlist[t][MGS.TID] == obj.tid) {
                        task = tlist[t];
                        break;
                    }
                }    
            }
        }
        return task;
    },
    find_task_by_next_tid: function(arg) {
        //* arg = {tid, sid}
        //delete_this_later:("find_task_by_next_tid(): arg=", arg);
        let task;
        if ((arg.sid)&&(arg.tid)) {
            let agent_index = MGS.find_agent_index_by_sid(arg.sid);
            //delete_this_later:("find_task_by_next_tid(): agent_index=", agent_index);
            if (typeof(agent_index) != "undefined") {
                let tlist = MGS.agents[agent_index][MGS.TASKS];
                if (Array.isArray(tlist)) {
                    for (let t in tlist) {
                        //delete_this_later:("find_task_by_next_tid(): tlist["+t+"]="+tlist[t]);
                        if (tlist[t][MGS.NEXT_TID] == arg.tid) {
                            task = tlist[t];
                            break;
                        }
                    }    
                }
            }
        }  else { console.log("ERR: find_task_by_next_tid(): No params 'sid' or 'next_tid'"); }
        return task;
    },
    find_prev_task_by_tname: function(arg){
        //* arg = {tname: 'manifest', sid: ag_sid}
        if ((arg.sid)&&(arg.tname)) 
        {
            let agent_index = MGS.find_agent_index_by_sid(arg.sid);
            if (typeof(agent_index) == "undefined") { 
                console.log("ERR: find_prev_task_by_tname(): Fail to Find agent by 'sid'");
                return;
            }
            let task;
            let tlist = MGS.agents[agent_index][MGS.TASKS];
            if (Array.isArray(tlist)) 
            {
                for (let t = tlist.length-1; t >= 0; t--) 
                {
                    //delete_this_later:("find_task_by_next_tid(): tlist["+t+"]="+tlist[t]);
                    if (tlist[t][MGS.TNAME] == arg.tname) {
                        //? Now look if it task has answer?
                        if (tlist[t][MGS.STAGE] >= MGS.GOT) {
                        //? OR: if (tlist[t][MGS.ANSWER]) {
                            task = tlist[t];
                            break;
                        }
                    }
                }
                return task;    
            }
        }
        else 
        { 
            console.log("ERR: find_prev_task_by_tname(): No params 'sid' or 'tname'");
        }
    }
    
    };
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
