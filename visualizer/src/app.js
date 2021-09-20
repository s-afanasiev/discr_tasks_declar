const _global_stor = {};
var global_counter_id = 1;
function app_run(args){
    //@ param {Object} args = app_run({window:this, socket_io_address: endvr_server_address, parent_id: "main_div"}); //app.js
    return new App(
        new NavMenu(
            new NavSelectedHost(
                new NavFutureJobsPanel(),
                new NavJobChainTreeBtn(
                    new JobChainTreeWindow(),
                    {btn_name: "agent jobs", concrete_agent:true}
                ),
                new AddedJob(),
                new StoppedJob(
                    new ResumedJob(),
                    new DeletedJob()
                )
            ),
            new NavGlobalBtns(
                new NavJobChainTreeBtn(
                    new JobChainTreeWindow(),
                    {btn_name: "jobs general config"}
                )
            )
        ),
        new HostTable2(
            new HTHostsVisualLocation(
                new HTStructure(
                    new HostTr(
                        new HostTd(
                            new HostHeader(
                                new HostBtnFutureJobs()
                            ),
                            new HostLauncher(
                                new TaskList()
                            ),
                            new HostController(
                                new TaskList()
                            )
                        )
                    )
                ),
                new HTSocketResponses(
                    new HTSocketReqHosts(
                        new HTSocketConnListening()
                    )
                ).with("host_table", new HTSocketRespHostTable())
                .with("host_born", new HTSocketRespHostBorn())
                .with("agent_online", new HTSocketRespAgentOnline())
                .with("agent_offline", new HTSocketRespAgentOffline())
                .with("agent_work", new HTSocketRespAgentWork())
                .with("work_mode", new HTSocketRespWorkMode())
            )
        )
    ).run(args)
}
function App(navMenu, hostTable){
    this.dom=()=>{}
    this.html=()=>{}
    //@ param {Object} args = app_run({window:this, socket_io_address: endvr_server_address, parent_id: "main_div"}); //app.js
    this.run=(args)=>{
        const server_socket = io(args.socket_io_address, {query:{browser_or_agent:"browser"}})
        hostTable.run(
            server_socket, 
            navMenu.run(server_socket, args.parent_nav_id, args.window).api(), 
            args.parent_id
        )
    }
}
function AnyClickProcess(){
    this.run=(_window)=>{
        if(_window && _window.document){
            //@ if any keyboard key pressed:
            _window.document.addEventListener('keydown', function(ev){});
            _window.document.addEventListener('click', function(ev){
                console.log("AnyClickProcess click ev.target.id =",ev.target.id);
            });
        }
    }
}
//@---------------------------------
function NavMenu(navSelectedHost, navGlobalBtns){
    let _$a = undefined;//run
    let _navApi = undefined;//run
    this.run=(server_socket, parent_div_id, _window)=>{
        _navApi = new NavApi().init();
        _$a = $("<div style='height:100%; width:100%; border:1px solid blue; display:table;'>");
        $("#"+parent_div_id).append(_$a);
        _$a.append("<div style='display:table-cell; width:10%;'>nav menu!</div>")
        _$a.append(navGlobalBtns.run(server_socket, parent_div_id, _window).dom())
        _$a.append(navSelectedHost.init(server_socket, _navApi).run(parent_div_id).dom());
        return this;
    }
    this.api=()=>{return _navApi}
    function NavApi(){
        const event_types = ["host_click", "future_jobs_click"];
        const _target_list = {};
        this.init=()=>{
            event_types.forEach(e_type=>{_target_list[e_type] = [];})
            return this;
        }
        this.notify=(event_type, data_dto)=>{
            //console.log("NavApi.notify() event_type= ", event_type)
            if(event_types.includes(event_type)){
                console.log("NavApi.notify(): event_type= ", event_type);
                _target_list[event_type].forEach(targ=>{
                    targ.nav_api_notify(event_type, data_dto);
                })
            }else{
                console.log("NavApi.notify(): no such event: ", event_type);
            }
        }
        this.subscribe=(event_type, target)=>{
            if(event_types.includes(event_type)){
                _target_list[event_type].push(target);
                console.log("NavMenu.subscribe() target_list length =", _target_list.length);
            }else{
                console.log("NavApi.subscribe(): no such event: ", event_type);
            }
        }
        this.unsubscribe=(event_type, target)=>{
            const arr = _target_list[event_type];
            for(let i=0; i<arr.length; i++){
                const targ = arr[i];
                if(target.id() == targ.id()){
                    arr[i].splice(i,1);
                    i--;
                }
            };
        }
    }
}
function NavSelectedHost(navFutureJobsPanel, navJobChainTreeBtn, addedJob, stoppedJob){
    let _$a = undefined//run
    let _server_socket = undefined//init
    let _navApi = undefined;//init
    this.parent_div_id = undefined;//init
    this.id=()=>{return "navSelectedHost"}
    this.as=(name)=>{
        _global_stor[name] = this;
        return this;
    }
    this.dom=()=>{return _$a;}
    this.init=(server_socket, navApi)=>{
        _navApi = navApi;
        _server_socket = server_socket;
        navFutureJobsPanel.init(server_socket, navApi);
        return this;
    }
    this.run=(parent_div_id)=>{
        this.parent_div_id = parent_div_id;
        _$a = $("<div style='height:100%; width:50%; border:1px dashed orange; display:table-cell;'>")
        _$a.append("<div id='selected_host_md5_place'>selected host</div>");
        //@ server_socket, parent_div_id, _window
        _$a.append(navJobChainTreeBtn.init(_navApi).run(_server_socket, this.parent_div_id).dom())
        _$a.append(navFutureJobsPanel.run().dom())
        _navApi.subscribe("host_click", this);
        return this;
    }
    this.nav_api_notify=(eventType, data_dto)=>{
        console.log("NavSelectedHost.nav_api_notify(): selected_host_md5_place =", selected_host_md5_place)
        if(eventType == "host_click"){
            if(data_dto.md5){
                $("#selected_host_md5_place", _$a).html("<span>md5: "+data_dto.md5+"</span>");
            }else{
                console.log("NavSelectedHost.nav_api_notify(): no md5 data on 'host_click' event")
            }
        }
    }
}
function NavFutureJobsPanel(){
    let _$a = undefined;
    let _navApi = undefined;//init 'future_jobs_click' event from navApi source
    let server_socket = undefined;//init
    let _cur_clicked_host_md5 = ""//on 
    const _id = "navFutureJobsPanel";
    this.id=()=>{return _id}
    this.instance=()=>{return new NavFutureJobsPanel();}
    this.dom=()=>{return _$a;}
    this.init=(_server_socket, navApi)=>{
        server_socket = _server_socket;
        _navApi = navApi;
        console.log("NavFutureJobsPanel.init()")
        _$a = $("<div id='"+_id+"'></div>")
        return this;
    }
    this.run=()=>{
        _navApi.subscribe("future_jobs_click", this);
        //@TODO: более правильно, чтобы на данное событие подписывались ячейки таблицы хостов - т.е. сами хосты
        server_socket.on("gui_news", data=>{
            if(data.msg == 'list_future_jobs'){
                console.log("NavFutureJobsPanel.init() sokcetdata=", data )
                if(_cur_clicked_host_md5 == data.md5){
                    console.log("NavFutureJobsPanel.init() data.value=", data.value)
                    if(data.value.length == 0){
                        _$a.empty().append("no future jobs")
                    }else{
                        _$a.empty();
                        data.value.forEach(one_future_job=>{
                            const $stop_future_job_btn = $("<span style='cursor:pointer; background:orange;'>stop</span>");
                            $stop_future_job_btn.on("click", (evt)=>{
                                server_socket.emit('gui_ctrl', {type:'drop_future_jobs', host_id:_cur_clicked_host_md5, job_info: one_future_job});
                            })
                            _$a.append($stop_future_job_btn)
                            _$a.append("<span>"+JSON.stringify(one_future_job)+"</span>")
                        });
                        const $stop_all_future_jobs = $("<span style='cursor:pointer; background:red;'>STOP ALL</span>");
                        $stop_all_future_jobs.on("click", (evt)=>{
                            server_socket.emit('gui_ctrl', {type:'drop_future_jobs', host_id:_cur_clicked_host_md5});
                        })
                        _$a.append($stop_all_future_jobs);
                    }
                }
            }
        });
        return this;
    }
    this.nav_api_notify=(eventType, data_dto)=>{
        console.log("NavFutureJobsPanel.nav_api_notify() eventType=",eventType);
        if(data_dto.md5){
            _cur_clicked_host_md5 = data_dto.md5;
        }else{
            console.log("NavFutureJobsPanel.nav_api_notify(): no md5 data on 'future_jobs_click' event")
        }
    }
}
function AddedJob(){}
function StoppedJob(resumedJob, deletedJob){}
function ResumedJob(){}
function DeletedJob(){}
function OneHostPrivateInterface(){}
function NavGlobalBtns(navJobChainTreeBtn, _id){
    const id = (_id) ? _id+1 : 1;
    let _$a = undefined//run
    this.dom=()=>{return _$a;}
    this.run=(server_socket, parent_div_id, _window)=>{
        console.log("NavGlobalBtns.run(): id=", id)
        _$a = $("<div style='height:100%; width:20%; border:1px dashed grey; display:table-cell;'>update mode<div>");
        _$a.append(navJobChainTreeBtn.run(server_socket, parent_div_id, _window).dom());
        return this;
    }
}
function NavJobChainTreeBtn(jobChainTreeWindow, Options){
    var _navApi = undefined;//init
    this.current_agent_md5 = -1;//nav_api_notify
    const _id = global_counter_id++;
    const receiver_id = "NavJobChainTreeBtn"+_id;
    let _$a = undefined//run
    const btn_name = Options.btn_name || "jobs chains"
    this.dom=()=>{return _$a;}
    this.init=(navApi)=>{
        _navApi = navApi;
        navApi.subscribe("host_click", this);
        return this;
    }
    this.run=(server_socket, parent_div_id, _window)=>{
        console.log("NavJobChainTreeBtn.run(): id=", _id)
        _$a = $("<div style='height:25%; width:40%; border:1px solid red; cursor:pointer; background:#eee; text-align:center;'>"+btn_name+"<div>");
        _$a.click((ev)=>{
            const event_type = 'jobs_config';
            //alert("calling ");
            if(Options.concrete_agent){
                server_socket.emit('gui_ctrl', {type: event_type, caller_id: receiver_id, concrete_agent: this.current_agent_md5})
            }else{
                server_socket.emit('gui_ctrl', {type: event_type, caller_id: receiver_id})
            }
        });
        server_socket.on("gui_news", (data)=>{
            // console.log("NavJobChainTreeBtn.run(): gui_news from server: ", data);
            // console.log("NavJobChainTreeBtn.run(): gui_news: _id =", _id)
            if(data.caller_id == receiver_id){
                console.log("NavJobChainTreeBtn.run(): msg from server: ", data)
                if(data.jobs_config){
                    jobChainTreeWindow.instance(_id).run(data.jobs_config, parent_div_id, _window);
                }
            }
        })
        return this;
    }
    this.nav_api_notify=(eventType, data_dto)=>{
        if(eventType == "host_click"){
            if(data_dto.md5){
                this.current_agent_md5 = data_dto.md5;
                console.log("NavJobChainTreeBtn.nav_api_notify(): current_agent_md5 = ", this.current_agent_md5)
            }else{
                console.log("NavJobChainTreeBtn.nav_api_notify(): no md5 data on 'host_click' event")
            }
        }else{
            console.log("NavJobChainTreeBtn.nav_api_notify(): unexpected eventType: ", eventType)
        }
    }
}
function JobChainTreeWindow(_id){
    const id = (_id) ? _id+1 : 1;
    this.instance=(id)=>{return new JobChainTreeWindow(id);}
    this.run=(jobs_config, parent_div_id, _window)=>{
        console.log("JobChainTreeWindow.run(): id=", id)
        const tree_window = $("<div style='position:absolute; width:70%; height:70%; top:15%; left:15%; background:#b5dbc2; z-index:2;'></div>");
        $("#super").append(tree_window);
        tree_window.append(new CloseBtn(id).run(tree_window).dom(), new Tree(id).run(jobs_config).dom())
        //$("#"+parent_div_id).append("<div style='postion:absolute; width:50%; height:50%; top:50%; left:50%; background:#dde'></div>")
    }
    function CloseBtn(_id){
        const id = (_id) ? _id+1 : 1;
        let _$a = undefined//run
        this.dom=()=>{return _$a;}
        this.run=(tree_window)=>{
            console.log("CloseBtn.run(): id=", id)
            _$a = $("<div style='position:absolute; width:5%; height:5%; top:0; left:0; background:#96b4a0; text-align:center; cursor:pointer;'>X</div>");
            _$a.click(ev=>{
                tree_window.remove();
            })
            return this;
        }
    }
    function Tree(_id){
        const id = (_id) ? _id+1 : 1;
        let _$a = undefined//run
        this.dom=()=>{return _$a;}
        this.run=(jobs_config)=>{
            console.log("Tree.run(): id=", id)
            _$a = $("<div style='position:absolute; width:98%; height:95%; top:5%; left:0; background:#d3f0dd; padding:1%; outline:1px solid #608f70;'>tree</div>");
            jobs_config.init.forEach(job_id=>{
                let if_interval = color_if_interval(jobs_config, job_id);
                _$a.append("<div><span style='color:#0f3f1f; background:#b5dbc2;'><b>"+job_id+"</b></span>"+if_interval+"</div>");
                _$a.append(base(jobs_config, job_id, 1));
            })
            return this;
        }
        function base(jobs_config, job_id, _deep){
            let deep = _deep || 1;
            let html = "<div>";
            //console.log("Tree.base() Boolean = ", jobs_config[job_id])
            if(jobs_config.jobs[job_id]){
                console.log("Tree.base() jobs_config[job_id] = ", jobs_config.jobs[job_id])
                const action = jobs_config.jobs[job_id]["action"];
                if(action){
                    //draw elbows
                    if(Array.isArray(action)){
                        action.forEach(act=>{
                            html += draw_action(jobs_config, act, deep)+"<br>";
                        })
                    }else if(typeof action == "string"){
                        html += "<span>"+draw_action(jobs_config, action, deep)+"</span>";
                    }
                    html += base(jobs_config, action, deep+1)
                }else{
                    return "";
                }
            }
            return html += "</div>";
            //-----------------------------------
            
        }
        function draw_action(jobs_config, action, deep){
            let html = "";
            let if_interval = color_if_interval(jobs_config, action);
            for(let i=0; i<deep; i++){
                let color = "#d3f0dd";
                if(i==deep-1) color = "red";
                html += "<span style='color:"+color+";'>&angrt;</span>";
            }
            html += "<span>"+action+"</span>"+if_interval;
            return html;
        }
        function color_if_interval(jobs_config, job_id){
            let if_interval = "";
            if(jobs_config.jobs[job_id]){
                if(jobs_config.jobs[job_id].interval){
                    if_interval = "<span>&nbsp;</span><span style='background:#e3b8e0;'>"+jobs_config.jobs[job_id].interval+"</span>";
                }else if(jobs_config.jobs[job_id].delay){
                    if_interval = "<span>&nbsp;</span><span style='background:#edce91;'>"+jobs_config.jobs[job_id].delay+"</span>";
                }
            }else{
                console.error("Tree.color_if_interval(): no "+job_id+ " in jobs_config.jobs")
                if_interval = "<span>&nbsp;</span><span style='color:#722;'><b>(Deleted)</b></span>"
            }
            return if_interval;
        }
    }
}
//@---------------------------------
function HostTable2(hTHostsVisualLocation){
    this.run=(server_socket, navApi, parent_div_id)=>{
        hTHostsVisualLocation.run(server_socket, navApi, parent_div_id);
    }
}
function HTHostsVisualLocation(hTStructure, hTSocketResponses){
    this.run=(server_socket, navApi, parent_div_id)=>{
        console.log("HTHostsVisualLocation.run()");
        const host_table = hTStructure.run(server_socket, navApi);
        $("#"+parent_div_id).append(host_table.dom());
        hTSocketResponses.run(server_socket, navApi, hTStructure);
        //windowEvents.run(hTStructure);
    }
}
//@ Renamed from 'HostTable' to 'HostTable2', because in other js-file already exists name 'HostTable'
function HTStructure(hostTr){
    this.hostTr = hostTr;
    let _max_td_count = 2;
    this.change_max_td_count=(count)=>{_max_td_count = count;}
    const _table_id = "host_table";
    let _trStor = undefined; //run
    let _$a = undefined;
    let server_socket=undefined;//run
    this.html=()=>{return _$a.get(0).outerHTML;}
    this.dom=()=>{return _$a;}
    this.instance=()=>{return new HTStructure(this.hostTr)}
    this.run=(_server_socket, navApi)=>{
        server_socket = _server_socket;
        console.log("HTStructure.run()");
        _$a = $("<table id='"+_table_id+"'>");
        _trStor = new HT_TrStor().init(this.hostTr, navApi, server_socket);
        this.set_thumb("not requested data");
        navApi.subscribe("host_click", this)
        return this;
    }
    this.nav_api_notify=(event_type, data_dto)=>{
        if(event_type == "host_click"){
            if(data_dto.md5){
                _trStor.all().forEach(hostTr=>{
                    hostTr.drop_host_selection_except(data_dto.md5)
                })
                $("#selected_host_md5_place", _$a).html("<span>md5: "+data_dto.md5+"</span>");
            }else{
                console.log("HTStructure.nav_api_notify(): no md5 data on 'host_click' event")
            }
        }
    }
    //@param server_msg_dto = {msg: "host_born", creator_type: "launcher", creator_pid: 6252, creator_apid: -1, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.host_born=(server_msg_dto)=>{
        console.log("HTStructure.host_born()");
        if(_trStor.is_empty()){_$a.empty()}
        const _hostTr = _trStor.not_crowded(_max_td_count, _$a.width())
        _$a.append(_hostTr.dom())
        console.log("HTStructure.host_born() new tr has created. OuterHtml after append = ", this.html())
        _hostTr.host_born(server_msg_dto);
    }
    //@param server_msg_dto = {msg: "host_born", creator_type: "launcher", creator_pid: 6252, creator_apid: -1, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.agent_online=(server_msg_dto)=>{
        _trStor.all().forEach(_hostTr=>{
            console.log("HTStructure.agent_online(): _hostTr.id() =", _hostTr.id());
            _hostTr.agent_online(server_msg_dto);
        })
    }
    //@param server_msg_dto = {msg: "agent_offline", agent_type: "controller", md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.agent_offline=(server_msg_dto)=>{
        _trStor.all().forEach(_hostTr=>{
            console.log("HTStructure.agent_offline(): _hostTr.id() =", _hostTr.id());
            _hostTr.agent_offline(server_msg_dto, (is_tr_empty)=>{
                if(is_tr_empty){
                    console.log("HTStructure.agent_offline() is_tr_empty=",is_tr_empty);
                }
            });
        })
    }
    this.set_thumb=(msg_to_show)=>{
        console.log("HTStructure.set_thumb()");
        let _hostTr;
        _hostTr = hostTr.instance().init(_$a.width()).set_thumb(msg_to_show);
        _$a.empty().append(_hostTr.dom());
        _hostTr.set_thumb(msg_to_show);
    }
    this.draw_table=(host_list)=>{
        console.log("HTStructure.draw_table(): host_list=", host_list);
        if(host_list.length == 0){
            this.set_thumb("no hosts online");
        }else{
            let _cur_row = 0;
            const _tr_count = Math.ceil(host_list.length / _max_td_count);
            if(_$a){_$a.empty();}
            _trStor.clear_all();
            //if(this.hTHostsVisualLocation){this.hTHostsVisualLocation.draw_table(_$a);}
            for(let i=0; i<_tr_count; i++){
                const _hostTr = _trStor.not_crowded(_max_td_count, _$a.width());
                //console.log("HTStructure.draw_table(): _hostTr.dom()=", _hostTr.dom());
                _$a.append(_hostTr.dom())
                _hostTr.run(
                    host_list.slice(
                        _cur_row, 
                        _cur_row = _cur_row + _max_td_count
                    )
                )
            }   
        }
    }
    //@ E.g. server_msg_dto = { msg: "agent_work", value: "'disk_space_lte_25' job done", agent_type: "controller", md5: "fc59692915b9b0afd602ed573ee7deff" }
    this.agent_work=(server_msg_dto)=>{
        _trStor.all().forEach(_hostTr=>{
            _hostTr.agent_work(server_msg_dto);
        })
    }
    //@ param {hashtable Object} server_msg_dto = {msg: "work_mode", value: <"special"||"normal">, md5: "fc59692915b9b0afd602ed573ee7deff"}
    this.work_mode=(server_msg_dto)=>{
        _trStor.all().forEach(_hostTr=>{
            _hostTr.work_mode(server_msg_dto);
        })
    }
}
function HT_TrStor(){
    const _all_trs = {};
    let _tr_counter = 0;
    let _is_last_tr_new = false;
    let hostTr_F = undefined; //init
    this.navApi = undefined;//init
    let server_socket = undefined;//init
    this.instance=()=>{return new HT_TrStor();}
    this.init=(hostTr, navApi, _server_socket)=>{
        this.navApi = navApi;
        hostTr_F = hostTr;
        server_socket = _server_socket;
        return this;
    }
    this.clear_all=()=>{for(let tr in _all_trs){delete _all_trs[tr]}}
    this.len=()=>{return Object.keys(_all_trs).length}
    this.is_empty=()=>{
        console.log("HT_TrStor.is_empty(): _all_trs=",_all_trs)
        return Object.keys(_all_trs).length == 0
    }
    this.all=()=>{return Object.values(_all_trs);}
    this.zero_tr=()=>{return _all_trs[Object.keys(_all_trs)[0]]}
    this.new_tr=(parent_width)=>{
        const new_tr = hostTr_F.instance(_tr_counter++).init(parent_width, this.navApi, server_socket);
        console.log("HT_TrStor.new_tr() =", new_tr)
        _all_trs[_tr_counter] = new_tr;
        return new_tr;
    }
    this.is_last_new=()=>{}
    this.not_crowded=(_max_td_count, parent_width)=>{
        console.log("HT_TrStor.not_crowded() _all_trs =", _all_trs)
        let not_crowded_tr = undefined;
        const trs_keys = Object.keys(_all_trs);
        for(let i=0; i<trs_keys.length; i++){
            const one_tr_key = trs_keys[i];
            console.log("HT_TrStor.not_crowded() one_tr_key=",one_tr_key)
            if(_all_trs[one_tr_key].host_count() < _max_td_count){
                not_crowded_tr = _all_trs[one_tr_key];
                _is_last_tr_new = false;
                break;
            }
        }
        if(not_crowded_tr == undefined){
            not_crowded_tr = this.new_tr(parent_width);
            _is_last_tr_new = true;
        }
        return not_crowded_tr;
    }
}
function HostTr(hostTd, order_number){
    this.order_number = order_number;
    this.hostTd = hostTd;
    this.navApi = undefined;//init
    let server_socket = undefined;//init
    this.id=()=>{return order_number}
    const any_tr_id_begin_with = "host_table_tr__";
    let _$a = undefined;//init
    this.__$a = undefined;//init
    const _hosts_td = {};
    let _parent_width;
    this.instance=(order_number)=>{return new HostTr(hostTd, order_number);}
    this.init=(parent_width, navApi, _server_socket)=>{
        console.log("HostTr.init() id=", this.id())
        this.navApi = navApi;
        _parent_width = parent_width;
        server_socket = _server_socket;
        _$a = $("<tr style='background:#ddeeee;'>")
        _$a.attr('id', any_tr_id_begin_with+this.id());
        this.__$a = _$a;
        //console.log("HostTr.init(): _$a =", _$a)
        return this;
    }
    this.html=()=>{return _$a.get(0).outerHTML}
    this.dom=()=>{return _$a}
    this.hosts=()=>{return _hosts_td}
    this.host_count=()=>{return Object.keys(_hosts_td).length}
    //@param server_msg_dto = {msg: "host_born", creator_type: "launcher", creator_pid: 6252, creator_apid: -1, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    //@param {Number} _max_td_count - max count of td in one tr
    //@param {Function} if_overhead_callback - callback in case when this TR already overloaded (has max count of TD inside)
    this.host_born=(server_msg_dto, _max_td_count, if_overload_callback)=>{
        const hosts_count = Object.keys(_hosts_td).length;
        console.log("HostTr.host_born() _hosts_td.length = ", hosts_count)
        //@ на случай если внутри есть неучтенный td типа заглушки
        if(hosts_count == 0){_$a.empty()}
        if(hosts_count >= _max_td_count){
            console.log("HostTr.host_born() _hosts_td >= max_td_count:",hosts_count, _max_td_count)
            if_overload_callback(true);
        }else{
            if(hosts_count == 0){
                //@ очистить строку от первого тестового td, который содержит надпись "no hosts loaded"
                //console.log("HostTr.host_born() this html before emtpy =", this.html());
                _$a.empty();
            }
            //console.log("HostTr.host_born() this html =", this.html());
            const _hostTd = hostTd.instance(server_msg_dto.md5).init(_$a.width(), this.navApi, server_socket);
            _$a.append(_hostTd.dom())
            _hosts_td[server_msg_dto.md5] =_hostTd;
            _hostTd.host_born(server_msg_dto)
            //console.log("HostTr.host_born(): _$a =", this.html());
        }
    }
    //@param server_msg_dto = {msg: "host_born", creator_type: "launcher", creator_pid: 6252, creator_apid: -1, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.agent_online=(server_msg_dto)=>{
        console.log("HostTr.agent_online()");
        for (let md5 in _hosts_td){
            if(md5 == server_msg_dto.md5){
                console.log("HostTr.agent_online(): _hostTd.id() =", md5);
                _hosts_td[md5].agent_online(server_msg_dto);
            }
        }
    }
    //@param server_msg_dto = {msg: "agent_offline", agent_type: "controller", md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.agent_offline=(server_msg_dto, cb_if_tr_empty)=>{
        console.log("HostTr.agent_offline()");
        for (let md5 in _hosts_td){
            if(md5 == server_msg_dto.md5){
                console.log("HostTr.agent_offline(): _hostTd.id() =", md5);
                _hosts_td[md5].agent_offline(server_msg_dto, (is_host_offline)=>{
                    if(is_host_offline){
                        //@ it means both agents on one host are offline and host visualisation should be removed
                        delete _hosts_td[md5];
                        //@ TODO: УДалять строку?
                        if(Object.keys(_hosts_td).length == 0){
                            cb_if_tr_empty(true)
                        }else{
                            cb_if_tr_empty(false)
                        }
                    }
                });
            }
        }
    }
    this.set_thumb=(msg_to_show)=>{
        console.log("HostTr.set_thumb()");
        const _hostTd = hostTd.instance(0, is_thumb_td = true).init(_$a.width(), this.navApi).show_msg(msg_to_show)
        _$a.empty().append(_hostTd.dom());
        return this;
    }
    //@ E.g. server_msg_dto = { msg: "agent_work", value: "'disk_space_lte_25' job done", agent_type: "controller", md5: "fc59692915b9b0afd602ed573ee7deff" }
    this.agent_work=(server_msg_dto)=>{
        for (let md5 in _hosts_td){
            if(md5 == server_msg_dto.md5){
                _hosts_td[md5].agent_work(server_msg_dto);
            }
        }
    }
    this.work_mode=(server_msg_dto)=>{
        for (let md5 in _hosts_td){
            if(md5 == server_msg_dto.md5){
                _hosts_td[md5].work_mode(server_msg_dto);
            }
        }
    }
    this.run=(host_list_of_one_row)=>{
        console.log("HostTr.run()")
        for(let i=0; i<host_list_of_one_row.length; i++){
            //const _hostTd = _create_host_td(host_list_of_one_row[i]);
            const _hostTd = hostTd.instance(host_list_of_one_row[i].md5, is_thumb_td=false).init(_$a.width(), this.navApi, server_socket);
            _$a.append(_hostTd.dom());
            _hosts_td[host_list_of_one_row[i].md5] =_hostTd;
            _hostTd.run(host_list_of_one_row[i]);
        }
        return this;
    }
    //@param host_info = {md5, hostTd}
    this.drop_host_selection_except=(md5)=>{
        for(let i in _hosts_td){
            if(_hosts_td[i].md5() != md5){
                _hosts_td[i].set_highlight('1px solid red')
            }
        }
    }
}
function HostTd(hostHeader, hostLauncher, hostController, md5_or_id, is_thumb_td){
    this.hostHeader = hostHeader;//factory
    this.hostLauncher = hostLauncher;//factory
    this.hostController = hostController;//factory
    this.curHeader = undefined;
    this.curLauncher = undefined;
    this.curController = undefined;
    this.navApi = undefined;//init
    let _server_socket = undefined;//init
    this.is_thumb_td = is_thumb_td;
    this.dom=()=>{return _$a}
    this.html=()=>{return _$a.html()}
    this.md5=()=>{return md5_or_id;}
    let _parent_width;
    let _$a = undefined;
    let $agents_wrapper;
    let _agents_wrapper_height = 72;
    this.set_highlight=(border_params)=>{
        _$a.css('border', border_params);
    }
    this.id=()=>{return _id;}
    this.instance=(md5_or_id, is_thumb_td)=>{return new HostTd(hostHeader, hostLauncher, hostController, md5_or_id, is_thumb_td);}
    this.init=(parent_width, navApi, server_socket)=>{
        console.log("HostTd.init() md5=", this.md5())
        _parent_width = parent_width;
        this.navApi = navApi;
        _server_socket = server_socket;
        let _class = 'host';
        if(this.is_thumb_td){_class +=' thumb';}
        _$a = $("<td valign='top' class = '"+_class+"' style='border:1px solid red;'></td>");
        _$a.on('click', (evt)=>{
            console.log("clicked!");
            _$a.css('border', '2px solid #f2f');
            if(this.navApi){
                this.navApi.notify("host_click", {md5:this.md5(), hostTd: this});
            }
        })
        return this;
    }
    this.run=(data)=>{
        console.log("HostTd.run()");
        _$a.attr("id", "host_td__"+data.md5)
        this.curHeader = hostHeader.instance(data).init(this.navApi, _server_socket);
        _$a.append(this.curHeader.dom());
        $agents_wrapper = $("<div style='height:"+_agents_wrapper_height+"px; position:relative; background:#efe;'>");
        _$a.append($agents_wrapper);
        //setTimeout(()=>{$agents_wrapper.height("1px")}, 1000)
        this.curLauncher = hostLauncher.instance(data).init(_$a.width(), this.navApi).run();
        $agents_wrapper.append(this.curLauncher.dom());
        this.set_dom_height(this.curLauncher.dom_height());
        this.curController = hostController.instance(data).init(_$a.width(), this.navApi).run(); 
        $agents_wrapper.append(this.curController.dom());
        this.set_dom_height(this.curController.dom_height());
        return this;
    }
    this.show_msg=(msg)=>{
        if(_$a){_$a.append(msg)}
        return this;
    }
    //@param server_msg_dto = {msg: "host_born", creator_type: "launcher", creator_pid: 6252, creator_apid: -1, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.host_born=(server_msg_dto)=>{
        const _agent_type = server_msg_dto.creator_type;
        server_msg_dto[_agent_type] = {}
        server_msg_dto[_agent_type].agent_type = _agent_type;
        server_msg_dto[_agent_type].agent_pid = server_msg_dto.creator_pid;
        server_msg_dto[_agent_type].agent_apid = server_msg_dto.creator_apid;
        this.run(server_msg_dto);
        return this;
    }
    //@param server_msg_dto = {msg: "agent_online", agent_type: "controller", agent_pid: 4904, agent_ppid: 5144, agent_apid: 5864, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.agent_online=(server_msg_dto)=>{
        console.log("HostTd.agent_online(1) _$a =",_$a)
        if(server_msg_dto.agent_type == "launcher"){
            //this.curLauncher = hostLauncher.instance(server_msg_dto).init(_$a.width(), this).run();
            this.curLauncher.agent_online(server_msg_dto);
        }else if(server_msg_dto.agent_type == "controller"){
            //this.curController = hostController.instance(server_msg_dto).init(_$a.width(), this).run();
            this.curController.agent_online(server_msg_dto);
        }else{
            console.log("WARNING: HostTd.agent_online() server_msg_dto =", server_msg_dto)
        }
    }
    //@param server_msg_dto = {msg: "agent_offline", agent_type: "controller", md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.agent_offline=(server_msg_dto, cb)=>{
        console.log("HostTd.agent_offline()")
        if(server_msg_dto.agent_type == "launcher"){
            this.curLauncher.agent_offline(server_msg_dto, (is_agent_offline)=>{
                _after_agent_offline(cb);    
            });
        }else if(server_msg_dto.agent_type == "controller"){
            this.curController.agent_offline(server_msg_dto, (is_agent_offline)=>{
                _after_agent_offline(cb);
            });
        }else{
            console.log("WARNING: HostTd.agent_online() server_msg_dto =", server_msg_dto)
        }
    }
    //@ E.g. server_msg_dto = { msg: "agent_work", value: "'disk_space_lte_25' job done", agent_type: "controller", md5: "fc59692915b9b0afd602ed573ee7deff" }
    this.agent_work=(server_msg_dto)=>{
        this.curController.agent_work(server_msg_dto.value, this)
    }
    this.work_mode=(server_msg_dto)=>{
        //this.curController.work_mode(server_msg_dto.value, this)
        if(server_msg_dto.value == "special"){
            _$a.append("<div class='special' style='position:absolute; background:pink;'>special mode!</div>")
        }else if(server_msg_dto.value == "normal"){
            //TODO: remove label "special_mode"
        }
    }
    const _after_agent_offline=(cb)=>{
        const is_launcher_offline = !this.curLauncher.online();
        const is_controller_offline = !this.curController.online();
        if(is_launcher_offline && is_controller_offline){
            console.log("HostTd._after_agent_offline() both agents are offline")
            _$a.remove();
            //@ После своих процедур передаём наверх, в HostTr, потому что ему может потребоваться удалить 
            cb(true, this.md5());//host IS empty, BOTH agents are left
        }else{
            cb(false);//host NOT empty, only ONE agent has left
        }
        
    }
    this.set_dom_height=(height)=>{
        if(height > _agents_wrapper_height){
            console.log("HostTd.set_dom_height():", height)
            $agents_wrapper.height(height+"px");
        }
    }
    this.add_to_dom_height=(height)=>{
        const total_height = _agents_wrapper_height + height;
        $agents_wrapper.height(total_height+"px");
    }
}
function HostHeader(hostBtnFutureJobs, data){
    const _data = data;
    let _a = "";
    let _$a = undefined;
    this.navApi = undefined;//init
    let _server_socket = undefined;//init
    this.instance=(data)=>{return new HostHeader(hostBtnFutureJobs, data)}
    this.html=()=>{return _a}
    this.dom=()=>{return _$a}
    this.init=(navApi, server_socket)=>{
        this.navApi = navApi;
        _server_socket = server_socket;
        //console.log("HostHeader.run()");
        _$a = $("<div id='host_header_md5__"+data.md5+"' style='border:1px solid green;'></div>");
        _$a.append("<div><b>"+data.md5+"</b></div>")
        _$a.append(hostBtnFutureJobs.instance(data.md5).init(navApi, _server_socket).dom())
        return this;
    }
}
function HostBtnFutureJobs(md5){
    const _md5 = md5;
    let _$a = undefined;
    this.instance=(md5)=>{
        return new HostBtnFutureJobs(md5);
    }
    this.dom=()=>{return _$a}
    this.init=(navApi, server_socket)=>{
        _$a = $("<div class='future_jobs_btn_dock' style='width:150px; background-color:#ddf; cursor:pointer;'>future jobs</div>");
        _$a.on("click", (evt)=>{
            console.log("HostBtnFutureJobs.init(); on click evt=", evt);
            navApi.notify("future_jobs_click", {md5:_md5});
            server_socket.emit('gui_ctrl', {type:'list_future_jobs', host_id:_md5});
        })
        return this;
    }
}
function HostLauncher(data){
    const _data = data;
    let _a = "";
    let _$a = undefined; 
    this.navApi = undefined;//init   
    this.instance=(data)=>{return new HostLauncher(data)}
    this.init=(parent_width, navApi)=>{
        this.navApi = navApi;
        console.log("HostLauncher.init() ", data.md5, "parent_width/2 =", parent_width/2)
        _$a = $("<div id='host_launcher__"+data.md5+"' style='width:50%; height:auto; border:1px solid blue; position:absolute; top:0; left:0;'></div>");
        return this;
    }
    let _online = false;
    this.online=()=>{return _online}
    this.html=()=>{return _$a.get(0).outerHTML}
    this.dom=()=>{return _$a}
    this.dom_height=()=>{return _$a.height()}
    //@param server_msg_dto = {msg: "agent_online", agent_type: "controller", agent_pid: 4904, agent_ppid: 5144, agent_apid: 5864, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.agent_online=(server_msg_dto)=>{
        _online = true;
        _$a.empty().append(agent_data_html(server_msg_dto));
    }
    //@param server_msg_dto = {msg: "agent_offline", agent_type: "controller", md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.agent_offline=(server_msg_dto, cb)=>{
        _online = false;
        _$a.empty();
        console.log("HostLauncher.agent_offline() outer html=", this.html())
        cb(true);
    }
    this.run=()=>{
        console.log("HostLauncher.run()");
        if(_data.launcher){
            _online = true;
            _$a.append(agent_data_html(_data.launcher));
        }
        return this;
    }
}
function HostController(taskList, data){
    this.taskList = taskList;
    this.curTaskList = undefined;
    this.pid = ""
    this.apid = ""
    const _data = data;
    //console.log("HostController: data =", data)
    let _a = "";
    let _$a = true;
    this.navApi = undefined;//init
    this.instance=(data)=>{return new HostController(this.taskList, data)}
    this.init=(parent_width, navApi)=>{
        this.navApi = navApi;
        _$a = $("<div id='host_controller__"+data.md5+"' style='width:50%; height:auto; border:1px solid orange; position:absolute; left:50%;'></div>");
        return this;
    }
    let _online = false;
    this.online=()=>{return _online}
    this.html=()=>{return _$a.get(0).outerHTML}
    this.dom=()=>{return _$a}
    this.dom_height=()=>{return _$a.height()}
    //@param server_msg_dto = {msg: "agent_online", agent_type: "controller", agent_pid: 4904, agent_ppid: 5144, agent_apid: 5864, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.agent_online=(server_msg_dto)=>{
        console.log("HostController.agent_online() server_msg =",server_msg_dto)
        _online = true;
        _$a.empty().append(agent_data_html(server_msg_dto));
        console.log("HostController.agent_online() outerHtml =",this.html())
        this.curTaskList = this.taskList.instance().init();
        _$a.append(this.curTaskList.dom());
    }
    this.agent_offline=(server_msg_dto, cb)=>{
        _online = false;
        _$a.empty();
        cb(true);
    }
    this.agent_work=(value, hostTd)=>{
        console.log("HostController.agent_work()")
        if(this.curTaskList){
            this.curTaskList.agent_work(value, hostTd)
        }
    }
    this.run=()=>{
        console.log("HostController.run() _data=",_data);
        if(_data.controller || _data.agent_type == "controller"){
            const controller_ref = _data.controller ? _data.controller : _data;
            _online = true;
            this.pid = controller_ref.agent_pid;
            this.apid = controller_ref.agent_apid;
            _$a.append(agent_data_html(controller_ref))
            this.curTaskList = this.taskList.instance().init();
            _$a.append(this.curTaskList.dom());
        }
        return this;
    }
}
function TaskList(){
    let _$a = undefined;
    this.instance=()=>{return new TaskList()}
    this.dom=()=>{return _$a}
    this.init=()=>{
        _$a = $("<div class='agent_work' style='background-color:#ccddee; width:100%; max-height: 120px; overflow: auto;'>");
        return this;
    }
    this.agent_work=(value, hostTd)=>{
        _$a.append("<div>"+value+"</div>");
        //console.log("TaskList.agent_work() height=", _$a.height())
        hostTd.add_to_dom_height(_$a.height())
    }
}
function HTSocketResponses(hTSocketReqHosts){
    const _handlers = {}
    this.with=(name, obj)=>{
        _handlers[name] = obj;
        return this;
    }
    this.run=(server_socket, navApi, hTStructure)=>{
        hTSocketReqHosts.run(server_socket);
        server_socket.on('gui_news', (server_msg_dto)=>{
            const responseObject = _handlers[server_msg_dto.msg];
            if(responseObject){
                try{
                    responseObject.instance().run(hTStructure, server_msg_dto)
                }catch(er){
                    console.log("Error HTSocketResponses.run(): ", er)
                }
            }
        });
    }
}
function HTSocketReqHosts(hTSocketConnListening){
    this.instance=()=>{return new HTSocketReqHosts();}
    this.run=(server_socket)=>{
        hTSocketConnListening.run(server_socket);
        hTSocketConnListening.onConnect(()=>{
            server_socket.emit('gui_ctrl', {type:'host_table'});
        });
    }
}
function HTSocketConnListening(){
    let _cb=()=>{console.log("HTSocketConnListening: callback not overrided")}
    this.onConnect=(cb)=>{_cb = cb;}
    this.run=(server_socket)=>{
        server_socket.on('connect', function(){
            _cb();
        });
        server_socket.connect();
    }
}
function HTSocketRespHostTable(){
    this.instance=()=>{return new HTSocketRespHostTable();}
    //@param {Object dto} host_list_dto - has params: {'msg', 'table'}
    //@param hTStructure - has all info about host table and its contain
    this.run=(hTStructure, server_msg_dto)=>{
        console.log("HTSocketRespHostTable.run() server_msg_dto=", server_msg_dto)
        hTStructure.draw_table(server_msg_dto.table)
    }
}
function HTSocketRespHostBorn(){
    this.instance=()=>{return new HTSocketRespHostBorn();}
    //@param server_msg_dto = {msg: "host_born", creator_type: "launcher", creator_pid: 6252, creator_apid: -1, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.run=(hTStructure, server_msg_dto)=>{
        console.log("HTSocketRespHostBorn.run()");
        hTStructure.host_born(server_msg_dto)
        //const a_host = _one_host(server_msg_dto);
    }
    const _one_host=(data)=>{
        let a = "";

        a += "<td valign='top' class = 'host' id='md5__"+data.md5+"'>";
            a +="<table style = 'border:1px solid red; width:100%;'>";
                a +="<tr><td colspan = '2'>";
                    a += "host : <b>"+data.md5+"</b>";
                    a += "<div class='future_jobs_btn_dock' style='width:100px; height:30px; background-color:#ddf; cursor:pointer;'>get future jobs</div>";
                a +="</td></tr>";
                a +="<tr class = 'agents'>";
                    a +="<td class = 'agent_type__launcher'>"
                        if(data.launcher){
                            a += _agent_data(data.launcher);
                        }
                    a += "</td>";
                    a +="<td class = 'agent_type__controller'>";
                        if(data.controller){
                            a += _agent_data(data.controller);
                        }
                    a += "</td>";
                a +="</tr>";
            a +="</table>";
        a +="</td>";
        return a;
    }
    const _agent_data=(agent_data, status)=>{
        //@ 1. check if such host exist. For example, event 'agent online' coomes faster than 'host_born'
        //@ 2. check is such agent already appended to this host
        status = status || "online";
        const status_color = (status=="online") ? "#2d3" : "#f67";
        let a = "";
        a += "<div>agent: "+agent_data.agent_type+"</div>";
        //a += "<div>status: <span style='background-color:"+status_color+";'>"+status+"</span></div>";
        a += "<div>status: <span style='background-color:"+status_color+";'>&emsp;</span> "+status+"</div>";
        if(status == "online"){
            a += "<div>pid: "+agent_data.agent_pid+"</div>";
            a += "<div>apid: "+agent_data.agent_apid+"</div>";
            a += "<div class='agent_work' style='background-color:#ccddee; width:100%; max-height: 400px; overflow: auto;'>"
                //a += "work";
            a += "</div>";
        }
        return a;
    }
}
function HTSocketRespAgentOnline(){
    this.instance=()=>{return new HTSocketRespAgentOnline();}
    //@param server_msg_dto = {msg: "agent_online", agent_type: "controller", agent_pid: 4904, agent_ppid: 5144, agent_apid: 5864, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.run=(hTStructure, server_msg_dto)=>{
        console.log("HTSocketRespAgentOnline.run()");
        hTStructure.agent_online(server_msg_dto);
    }
}
function HTSocketRespAgentOffline(){
    this.instance=()=>{return new HTSocketRespAgentOffline();}
    //@param server_msg_dto = {msg: "agent_offline", agent_type: "controller", md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.run=(hTStructure, server_msg_dto)=>{
        console.log("HTSocketRespAgentOffline.run(): server_msg_dto =", server_msg_dto);
        hTStructure.agent_offline(server_msg_dto);
    }
}
function HTSocketRespAgentWork(){
    this.instance=()=>{return new HTSocketRespAgentWork();}
    this.run=(hTStructure, server_msg_dto)=>{
        //console.log("HTSocketRespAgentWork.run() not implemented");
        hTStructure.agent_work(server_msg_dto);
    }
}
function HTSocketRespWorkMode(){
    this.instance=()=>{return new HTSocketRespWorkMode();}
    this.run=(hTStructure, server_msg_dto)=>{
        //console.log("HTSocketRespAgentWork.run() not implemented");
        hTStructure.work_mode(server_msg_dto);
    }
}
function WindowEvents(_window){
    this.run=(hTStructure)=>{
        if(_window){
            //@ TODO: rebounce event and send to hTStructure
        }
    }
}
function HostTable2ClickListening(navSelectedHost){
    this.run=(hostTable)=>{
        if(typeof navSelectedHost == "string"){navSelectedHost = _global_stor[navSelectedHost]}
        //@ jquery object
        hostTable.dom().click((ev)=>{
            navSelectedHost.set_current_host(_clicked_host(ev))
        });
        return this;
    }
    const _clicked_host=(ev)=>{
        console.log("HostTable2ClickListening._clicked_host(): ev=", ev);
    }
}
//@-----------------------------------------
const agent_data_html=(agent_data, status)=>{
    //@ 1. check if such host exist. For example, event 'agent online' coomes faster than 'host_born'
    //@ 2. check is such agent already appended to this host
    status = status || "online";
    const status_color = (status=="online") ? "#2d3" : "#f67";
    let a = "";
    a += "<div>agent: "+agent_data.agent_type+"</div>";
    //a += "<div>status: <span style='background-color:"+status_color+";'>"+status+"</span></div>";
    a += "<div>status: <span style='background-color:"+status_color+";'>&emsp;</span> "+status+"</div>";
    if(status == "online"){
        a += "<div>pid: "+agent_data.agent_pid+"</div>";
        a += "<div>apid: "+agent_data.agent_apid+"</div>";
        a += "<div class='agent_work' style='background-color:#ccddee; width:100%; max-height: 400px; overflow: auto;'>"
            //a += "work";
        a += "</div>";
    }
    return a;
}