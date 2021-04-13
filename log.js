    "use strict";
    //MODULE
    const m_fs = require("fs");
    const m_path = require("path");
    const EventEmitter = require('events');
    //GLOBAL CONSTANT
    const MSG_INFO = " INFO:";
    const MSG_WARNING = " WARN:";
    const MSG_ERROR = " ERROR:";
    //GLOBAL VARIABLE
    var g_flag_init = false;
    var g_flag_display = false;
    var g_fd = null; //File Discriptor
    var g_last_date;
    var g_last_fname;
    var g_log_levels = [];
    const g_max_f_size = 1000;
    const g_size_check_interval = 60000;
    const g_comments = false;
    //@ flag = Типа, нужно ли дублировать сообщения в консоль 
    //@ type = будет подставлено в начало имени файла-лога, если опущен параметр worker_pid
    //@ folder = Будет создана директорияс логами 
    //@ worker_pid - Если параметр задан, то имя файла-лога будет начинаться с "worker_" + worker_pid, а иначе с параметра type
    //@ log_level - уровень логирования 1 - только ошибки, 2 - также с предупреждениями, 3 - также информационные
    function init(flag, type, folder, worker_pid,log_level) {
        return new Promise((resolve, reject) =>{
            if (log_level == 0){
                resolve("log_level is 0");
            }else{
                if (typeof log_level == "undefined") { log_level = 3 }
                g_log_levels = [];
                switch (log_level) {
                    case 3:
                        g_log_levels.push(MSG_INFO);
                    case 2:
                        g_log_levels.push(MSG_WARNING);
                    case 1:
                        g_log_levels.push(MSG_ERROR);
                        break;
                    default:
                        g_log_levels.push(MSG_ERROR);
                        break;
                }
                if (g_comments) console.log(g_log_levels);
                let no_flag = (typeof flag == "undefined");
                let no_type = (typeof type == "undefined");
                let no_folder = (typeof folder == "undefined");
                if (no_flag || no_type || no_folder){
                    reject("MODULE LOG: Inner options is't defined");
                    return;
                }
                g_flag_display = flag;
                folder = m_path.normalize(folder);
                create_log_folder(folder)
                    .then((folder) => { return create_archive_folder(folder); })
                    .then((arch_fold) => { return prepare_filestream(type, folder, worker_pid); })
                    .then((fname) =>{
                        g_last_fname = fname;
                        if (g_comments) console.log("63.g_last_fname= ",g_last_fname);
                        return archive_old_files(type,folder,folder+"/archive");
                    })
                    .then(() =>{
                        if (g_comments) console.log("66.FILES ARE COPIED");
                        var emitter = new EventEmitter();
                        set_checksize_interval(emitter);
                        emitter.on('fsize_limit',() => {
                            //Когда файл превысил лимитированный размер
                            if (g_comments) console.log("closing writestream...");
                            // Остановить поток на запись
                            g_fd.end();
                            // Начать писать лог в новый файл
                            prepare_filestream(type, folder, worker_pid).then((fname) =>{
                                g_last_fname = fname;
                                if (g_comments) console.log("73.g_last_fname= ",g_last_fname);
                                return archive_old_files(type,folder,folder+"/archive");
                            }).then((par) => {
                                if (g_comments) console.log("size-limit file moved to archive!");
                                set_checksize_interval(emitter);
                            }).catch(error =>{
                                console.log(error); // Error: Not Found
                            }); 
                        });
                        resolve();
                    })
                    .catch(error => {
                    console.log(error); // Error: Not Found
                    }); 
            }
        });
    }
    function create_log_folder(folder) {
        return new Promise((resolve,reject)=>{
            m_fs.stat(folder, (err, stats) => {
                if (err) {
                    m_fs.mkdir(folder, (err, stats) => {
                        if (err) {
                            reject(err.toString());
                        }else {
                            if (g_comments) console.log("log folder was created");
                            resolve(folder);
                        }
                    });
                } 
                else {
                    if (stats.isDirectory()) {
                        if (g_comments) console.log("log folder already exist");
                        resolve(folder);
                    } else {
                        reject("MODULE LOG: It's not a folder");
                    }
                }
            });
        });
    }
    function create_archive_folder(folder) {
        return new Promise((resolve,reject) => { 
            var arch_fold = folder + "/archive";
            arch_fold = m_path.normalize(arch_fold);
            m_fs.stat(arch_fold, (err, stats) => {
                if (err) {
                    m_fs.mkdir(arch_fold, (err) => {
                        if (err) { reject(err.toString()); } 
                        else {
                            if (g_comments) console.log("archive folder was created");
                            resolve(arch_fold);    
                        }
                    });
                }else if (stats.isDirectory()) {
                    if (g_comments) console.log("archive folder already exist");
                    resolve(arch_fold);
                }else reject("MODULE LOG: It's not a folder");
            });
        });
    }
    function prepare_filestream(type, log_fold, worker_pid) {
        return new Promise((resolve,reject) => {
            let date_full = new Date();
            let date_h = date_full.getHours();
            let date_m = date_full.getMinutes();
            let date_s = date_full.getSeconds();
            let date_hms = date_h + "-" + date_m + "-" + date_s;
            g_last_date = date_hms;
            if (g_comments) console.log("143.g_last_date=",g_last_date);
            let fname = null;
            if (typeof worker_pid === "undefined") {
                fname = m_path.normalize(log_fold + "/" + type + "__" + date_hms + ".log");
            } 
            else {
                fname = m_path.normalize(log_fold + "/" + "worker_" + worker_pid + "__" + date_hms + ".log");
            }
            try {
                g_fd = m_fs.createWriteStream(fname, {flags: 'w'});
            } catch(e) {
                reject(e.toString());
            }
            g_flag_init = true;
            resolve(fname);
        });   
    }   
    //Пример: m_log.write("HTTP",MSG_INFO,"Client request","127.0.0.1","Google Chrome");
    function write(msg, service_name, level, ip, agent) {
        service_name = service_name || "";
        ip = ip || "";
        agent = agent || "";
        level = level || "";
        if (g_log_levels.length < 3) {
            let write_access = false;
            for (let i in g_log_levels) {
                if (level == g_log_levels[i]) {
                    write_access = true;
                    break;
                }
            }
            if (write_access == false) return;
        }       
        if (g_flag_init === true) {
            if (typeof service_name != "undefined" && typeof msg != "undefined" && typeof level != "undefined") {
                level = addSpaces(level);
                let new_line = process.platform === 'win32' ? '\r\n' : '\n';
                let dat = new Date();
                let date_str = dat.getHours() + ":" + dat.getMinutes() + ":" + dat.getSeconds();
                date_str = addSpaces(date_str);
                let msg_body = "";
                service_name = service_name.toUpperCase();
                service_name = addSpaces(service_name);
                msg_body = date + service_name + level + msg + ip + agent + new_line;
                try {
                    g_fd.write(msg_body);
                    if (g_flag_display === true) {
                        console.log(msg_body);
                    }
                    return 1;
                } catch (e) {
                    console.log(e.toString());
                    return -1;
                }
            }
        }
    }   
    function archive_old_files(type,log_fold,arch_fold) {
        return new Promise((resolve,reject) => {
            m_fs.readdir(log_fold, (err,files)=>{
                if (err) {
                    throw err;
                }
                else {
                    for (var i in files){
                        if (g_comments) console.log(i+". file= "+files[i]);
                        let file_src = log_fold + '/' + files[i];
                        file_src = m_path.normalize(file_src);
                        /* Пропускаем,если это директория или текущий файл*/
                        let src_stats;
                        try {
                            src_stats = m_fs.statSync(file_src);
                        } catch(e){console.log(e)};
                        let isDir = src_stats.isDirectory();
                        let lastFile = files[i].indexOf(g_last_date) > -1;
                        if (isDir || lastFile){
                            if (g_comments) console.log(i+". isDir= "+isDir+",last_file= "+lastFile);
                            //Если это директория или текущий log-файл, то не трогать их
                            continue;
                        }
                        /*Если тип совпадает, то переносим в Архив*/ 
                        if (files[i].indexOf(type) > -1) {
                            let file_dst = arch_fold+"/"+files[i];
                            file_dst = m_path.normalize(file_dst);
                            let fSize = src_stats.size; 
                            m_fs.copyFile(file_src, file_dst, (err) => {
                                if (err) throw err;
                                else {
                                    m_fs.unlinkSync(file_src);
                                    if (g_comments) console.log("unlinked "+file_src);
                                }
                            });
                        }
                    }
                    resolve();
                }
            });
        });
    }   
    function set_checksize_interval(emitter) {
        clearInterval(f_size_timer);
        var f_size_timer = setInterval(function(){
            m_fs.stat(g_last_fname, (err, stats) => {
                if (g_comments) console.log("282.g_last_fname= ",g_last_fname);
                if (err) {throw err;}
                else {
                    if (stats.size > g_max_f_size){
                        clearInterval(f_size_timer);
                        emitter.emit('fsize_limit');
                    }
                }
            });
        },g_size_check_interval);
    }
    function addSpaces(word, indent, prefix) {
        if (typeof prefix != "undefined") {
            word = "" + prefix + word;
        }
        let len = word.length;
        if (typeof indent == "undefined"){ return word + " "; }
        else if (len < indent) {
            let offset = indent - len;
            for (let i = 0; i < offset; i++) {
                word = word + " ";
            }
        return word;
        }
    }
    //EXPORT
    module.exports.init = init;
    module.exports.write = write;
    module.exports.MSG_INFO = MSG_INFO;
    module.exports.MSG_WARNING = MSG_WARNING;
    module.exports.MSG_ERROR = MSG_ERROR;



