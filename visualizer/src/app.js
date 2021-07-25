const _global_stor = {};
function app_run(args){
    //@ param {Object} args = app_run({window:this, socket_io_address: endvr_server_address, parent_id: "main_div"}); //app.js
    return new App(
        new NavMenu(
            new SelectedHost(
                new HostActions(
                    new FutureJobs(),
                    new AddedJob(),
                    new StoppedJob()
                ),
                new OneHostPrivateInterface()
            ).as("selectedHost")
        ),
        new HTApiForNavMenu(),
        new HostTable2(
            new HTRequestsToServer(
                new HTClickListening(
                    new HTHostsVisualLocation(
                        new HTStructure(
                            new HostTr(
                                new HostTd(
                                    new HostHeader(),
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
                        .with("agent_work", new HTSocketRespAgentWork()),
                        new WindowEvents(args.window)
                    )
                )
            )
        )
    ).run(args)
}
function App(navMenu, hTApiForNavMenu, hostTable){
    this.dom=()=>{}
    this.html=()=>{}
    //@ param {Object} args = app_run({window:this, socket_io_address: endvr_server_address, parent_id: "main_div"}); //app.js
    this.run=(args)=>{
        const server_socket = io(args.socket_io_address, {query:{browser_or_agent:"browser"}});
        hostTable.run(server_socket, hTApiForNavMenu, args.parent_id)
        navMenu.run(server_socket, hTApiForNavMenu);
        const parent_div_id = args.parent_id;
        //new AnyClickProcess().run(_window)
        //hostTable.run(config={}).dom();
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
function NavMenu(selectedHost){
    this.run=(server_socket, hTApiForNavMenu)=>{}
}
function SelectedHost(hostActions, oneHostPrivateInterface){
    this.as=(name)=>{
        _global_stor[name] = this;
        return this;
    }
}
function HostActions(futureJobs, addedJob, stoppedJob){    
}
function FutureJobs(){}
function AddedJob(){}
function StoppedJob(){}
function OneHostPrivateInterface(){}
//@---------------------------------
function HTApiForNavMenu(){}
//@---------------------------------
function HostTable2(hTRequestsForServer){
    this.run=(server_socket, hTApiForNavMenu, parent_div_id)=>{
        hTRequestsForServer.run(server_socket, hTApiForNavMenu, parent_div_id);
    }
}
function HTRequestsToServer(hTClickListening){
    this.run=(server_socket, hTApiForNavMenu, parent_div_id)=>{
        hTClickListening.run(server_socket, hTApiForNavMenu, parent_div_id)
    }
}
function HTClickListening(hTHostsVisualLocation){
    this.run=(server_socket, hTApiForNavMenu, parent_div_id)=>{
        hTHostsVisualLocation.run(server_socket, hTApiForNavMenu, parent_div_id)
    }
}
function HTHostsVisualLocation(hTStructure, hTSocketResponses, windowEvents){
    let _parent_div_id = ""; //run
    this.run=(server_socket, hTApiForNavMenu, parent_div_id)=>{
        console.log("HTHostsVisualLocation.run()");
        _parent_div_id = parent_div_id;
        hTStructure.run(this)
        hTSocketResponses.run(server_socket, hTApiForNavMenu, hTStructure, this);
        windowEvents.run(hTStructure)
    }
    this.append_table=(_$a)=>{
        console.log("HTHostsVisualLocation.draw_table()");
        //console.log("HTHostsVisualLocation.draw_table(): _a =", _a)
        //console.log("HTHostsVisualLocation.draw_table(): _parent_div_id =", _parent_div_id)
        $("#"+_parent_div_id).empty().append(_$a);
    }
}
//@ Renamed from 'HostTable' to 'HostTable2', because in other js-file already exists name 'HostTable'
function HTStructure(hostTr, hTHostsVisualLocation){
    this.hostTr = hostTr;
    this.hTHostsVisualLocation = hTHostsVisualLocation;
    let _max_td_count = 3;
    const _table_id = "host_table";
    let _trStor = undefined; //run
    let _a = "";
    let _$a = undefined;
    this.html=()=>{return _a;}
    this.dom=()=>{return _$a;}
    this.instance=()=>{return new HTStructure(this.hostTr, this.hTHostsVisualLocation)}
    this.refresh=()=>{_a = ""}
    //@param server_msg_dto = {msg: "host_born", creator_type: "launcher", creator_pid: 6252, creator_apid: -1, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.host_born=(server_msg_dto)=>{
        console.log("HTStructure.host_born()");
        _trStor.not_crowded(_max_td_count, _$a.width()).host_born(server_msg_dto);
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
                if(is_tr_empty){}
            });
        })
    }
    this.minimal_table=(msg_to_show)=>{
        console.log("HTStructure.minimal_table()");
        this.refresh();
        let _hostTr;
        if(_trStor.len() == 0){
            console.log("HTStructure.minimal_table(0)");
            _hostTr = _trStor.new_tr(_$a.width());
            _$a.append(_hostTr.dom());
        }else{
            //@ случай, типа, если minimal уже был вызван (а значит, уже существует строка) и вдруг вызван ещё раз (значит надо взять эту одну созданную строку)
            _hostTr = _trStor.alone_minimal_tr()
        }
        _hostTr.minimal_table(msg_to_show);
    }
    this.draw_table=(host_list)=>{
        console.log("HTStructure.draw_table(): host_list=", host_list);
        this.refresh();
        if(host_list.length == 0){
            this.minimal_table("no hosts online");
        }else{
            let _cur_row = 0;
            const _tr_count = Math.ceil(host_list.length / _max_td_count);
            if(_$a){_$a.empty();}
            //if(this.hTHostsVisualLocation){this.hTHostsVisualLocation.draw_table(_$a);}
            for(let i=0; i<_tr_count; i++){
                const _hostTr = _trStor.new_tr(_$a.width());
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
    //this.run=(host_table_config, host_list)=>{}
    this.run=(hTHostsVisualLocation)=>{
        console.log("HTStructure.run()");
        this.hTHostsVisualLocation = hTHostsVisualLocation;
        _a += "<table id='"+_table_id+"'>";
        _$a = $(_a);
        if(this.hTHostsVisualLocation){this.hTHostsVisualLocation.append_table(_$a);}
        _trStor = new HT_TrStor().init(this.hostTr);
        this.minimal_table("not requested data");
        return this;
    }
}
function HT_TrStor(){
    const _all_trs = {};
    let _tr_counter = 0;
    let hostTrFactory = undefined; //init
    this.instance=()=>{return new HT_TrStor();}
    this.init=(hostTr)=>{
        hostTrFactory = hostTr;
        return this;
    }
    this.len=()=>{return Object.keys(_all_trs).length}
    this.add=(_hostTr)=>{_all_trs[_tr_counter++] = _hostTr}
    this.all=()=>{return Object.values(_all_trs);}
    this.alone_minimal_tr=()=>{return _all_trs[Object.keys(_all_trs)[0]]}
    this.new_tr=(parent_width)=>{
        const new_tr = hostTrFactory.instance(_tr_counter++).init(parent_width);
        _all_trs[_tr_counter] = new_tr;
        return new_tr;
    }
    this.not_crowded=(_max_td_count, parent_width)=>{
        let not_crowded_tr = undefined;
        const trs_keys = Object.keys(_all_trs);
        for(let i=0; i<trs_keys.length; i++){
            const one_tr_key = trs_keys[i];
            if(_all_trs[one_tr_key].host_count() < _max_td_count){
                not_crowded_tr = _all_trs[one_tr_key];
            }
        }
        if(!not_crowded_tr){
            not_crowded_tr = hostTrFactory.instance(_tr_counter++).init(parent_width);
            _all_trs[_tr_counter] = not_crowded_tr;
        }
        return not_crowded_tr;
    }
}
function HostTr(hostTd, order_number){
    this.hostTd = hostTd;
    this.id=()=>{return order_number}
    const any_tr_id_begin_with = "host_table_tr__";
    let _a = "";
    let _$a = undefined;
    const _hosts_td = {};
    let _parent_width;
    this.instance=(order_number)=>{return new HostTr(hostTd, order_number);}
    this.init=(parent_width)=>{
        _parent_width = parent_width;
        _a = "<tr>"
        _$a = $("<tr>")
        _$a.attr('id', any_tr_id_begin_with+this.id());
        console.log("HostTr.init(): _$a =", _$a)
        return this;
    }
    this.html=()=>{return _a}
    this.dom=()=>{return _$a}
    this.hosts=()=>{return _hosts_td}
    //@param server_msg_dto = {msg: "host_born", creator_type: "launcher", creator_pid: 6252, creator_apid: -1, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    //@param {Number} _max_td_count - max count of td in one tr
    //@param {Function} if_overhead_callback - callback in case when this TR already overloaded (has max count of TD inside)
    this.host_born=(server_msg_dto, _max_td_count, if_overload_callback)=>{
        console.log("HostTr.host_born()")
        if(Object.keys(_hosts_td).length >= _max_td_count){
            if_overload_callback(true);
        }else{
            if(Object.keys(_hosts_td).length == 0){
                //@ очистить строку от первого тестового td, который содержит надпись "no hosts loaded"
                _$a.empty();
            }
            const _hostTd = hostTd.instance(server_msg_dto.md5).init(_$a.width());
            _$a.append(_hostTd.dom())
            _hosts_td[server_msg_dto.md5] =_hostTd;
            _hostTd.host_born(server_msg_dto)
            console.log("HostTr.host_born(): _$a =", _$a);
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
                    if(is_host_offline, host_md5){
                        //@ it means both agents on one host are offline and host visualisation should be removed
                        delete _hosts_td[host_md5];
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
    this.minimal_table=(msg_to_show)=>{
        console.log("HostTr.minimal_table()");
        const _hostTd = hostTd.instance(0).init(_$a.width(), msg_to_show)
        _$a.empty().append(_hostTd.dom());
        return this;
    }
    this.run=(host_list_of_one_row)=>{
        console.log("HostTr.run()")
        for(let i=0; i<host_list_of_one_row.length; i++){
            const _hostTd = this.hostTd.instance(i).init(_$a.width());
            _$a.append(_hostTd.dom());
            _hosts_td[host_list_of_one_row[i].md5] =_hostTd;
            _hostTd.run(host_list_of_one_row[i]);
        }
        return this;
    }
}
function HostTd(hostHeader, hostLauncher, hostController, md5_id){
    this.hostHeader = hostHeader;//factory
    this.hostLauncher = hostLauncher;//factory
    this.hostController = hostController;//factory
    this.curHeader = undefined;
    this.curLauncher = undefined;
    this.curController = undefined;
    this.md5=()=>{return md5_id;}
    let _parent_width;
    let _a = "";
    let _$a = undefined;
    let $agents_wrapper;
    let _agents_wrapper_height = 72;
    this.id=()=>{return _id;}
    this.instance=(md5_id)=>{return new HostTd(hostHeader, hostLauncher, hostController, md5_id);}
    this.init=(parent_width, msg_to_show)=>{
        _parent_width = parent_width;
        _a += "<td valign='top' class = 'host' style='border:1px solid red;'>";
        _$a = $(_a);
        if(msg_to_show){_$a.append(msg_to_show)}
        return this;
    }
    this.html=()=>{return _a}
    this.dom=()=>{return _$a}
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
            this.curLauncher.agent_online(server_msg_dto);
        }else if(server_msg_dto.agent_type == "controller"){
            this.curController.agent_online(server_msg_dto);
        }else{
            console.log("WARNING: HostTd.agent_online() server_msg_dto =", server_msg_dto)
        }
    }
    //@param server_msg_dto = {msg: "agent_offline", agent_type: "controller", md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.agent_offline=(server_msg_dto, cb)=>{
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
    const _after_agent_offline=(cb)=>{
        const is_launcher_offline = !this.curLauncher.online();
        const is_controller_offline = !this.curController.online();
        if(is_launcher_offline && is_controller_offline){
            _$a.remove();
            //@ После своих процедур передаём наверх, в HostTr, потому что ему может потребоваться удалить 
            cb(true, this.md5());//host IS empty, BOTH agents are left
        }else{
            cb(false);//host NOT empty, only ONE agent has left
        }
        
    }
    this.set_dom_height=(height)=>{
        console.log("HostTd.set_dom_height =", height)
        if(height > _agents_wrapper_height){
            $agents_wrapper.height(height+"px");
        }
    }
    this.run=(data)=>{
        console.log("HostTd.run() data =", data);
        _$a.attr("id", "host_td__"+data.md5)
        _$a.append(hostHeader.instance(data).run().dom())
        _$a.append("<div class='future_jobs_btn_dock' style='width:150px; height:20px; background-color:#ddf; cursor:pointer;'>get future jobs</div>")
        $agents_wrapper = $("<div style='height:"+_agents_wrapper_height+"px; position:relative;'>");
        _$a.append($agents_wrapper);
        //setTimeout(()=>{$agents_wrapper.height("1px")}, 1000)
        this.curLauncher = hostLauncher.instance(data).init(_$a.width(), this).run();
        $agents_wrapper.append(this.curLauncher.dom());
        this.set_dom_height(this.curLauncher.dom_height());
        this.curController = hostController.instance(data).init(_$a.width(), this).run(); 
        $agents_wrapper.append(this.curController.dom());
        this.set_dom_height(this.curController.dom_height());
        return this;
    }
}
function HostHeader(data){
    const _data = data;
    let _a = "";
    let _$a = undefined;
    this.instance=(data)=>{return new HostHeader(data)}
    this.html=()=>{return _a}
    this.dom=()=>{return _$a}
    this.run=()=>{
        console.log("HostHeader.run()");
        _a += "<div id='host_header_md5__"+data.md5+"' style='height:20px; border:1px solid green;'><b>"+data.md5+"</b></div>"
        _$a = $(_a);
        return this;
    }
}
function HostLauncher(data){
    const _data = data;
    let _a = "";
    let _$a = undefined;    
    this.instance=(data)=>{return new HostLauncher(data)}
    this.init=(parent_width, hostTd)=>{
        _$a = $("<div id='host_launcher__"+data.md5+"' style='width:"+(parent_width/2)+"px; height:auto; border:1px solid blue; position:absolute;'></div>");
        return this;
    }
    let _online = false;
    this.online=()=>{return _online}
    this.html=()=>{return _a}
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
function HostController(data){
    const _data = data;
    //console.log("HostController: data =", data)
    let _a = "";
    let _$a = true;
    this.instance=(data)=>{return new HostController(data)}
    this.init=(parent_width, hostTd)=>{
        _$a = $("<div id='host_controller__"+data.md5+"' style='width:"+(parent_width/2)+"px; height:auto; border:1px solid orange; position:absolute; left:"+(parent_width/2)+"px;'></div>");
        return this;
    }
    let _online = false;
    this.online=()=>{return _online}
    this.html=()=>{return _a}
    this.dom=()=>{return _$a}
    this.dom_height=()=>{return _$a.height()}
    //@param server_msg_dto = {msg: "agent_online", agent_type: "controller", agent_pid: 4904, agent_ppid: 5144, agent_apid: 5864, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.agent_online=(server_msg_dto)=>{
        _online = true;
        _$a.empty().append(agent_data_html(server_msg_dto));
    }
    this.agent_offline=(server_msg_dto, cb)=>{
        _online = false;
        _$a.empty();
        cb(true);
    }
    this.run=()=>{
        console.log("HostController.run()");
        if(_data.controller){
            _online = true;
            _$a.append(agent_data_html(_data.controller))
        }
        return this;
    }
}
function TaskList(){}
function HTSocketResponses(hTSocketReqHosts){
    const _handlers = {}
    this.with=(name, obj)=>{
        _handlers[name] = obj;
        return this;
    }
    this.run=(server_socket, hTApiForNavMenu, hTStructure, hTHostsVisualLocation)=>{
        hTSocketReqHosts.run(server_socket, hTApiForNavMenu);
        server_socket.on('gui_news', (server_msg_dto)=>{
            const responseObject = _handlers[server_msg_dto.msg];
            if(responseObject){
                try{
                    responseObject.instance().run(hTStructure, server_msg_dto)
                }catch(er){
                    console.log("Error HTSocketResponses.run(): server_msg_dto =", er)
                }
            }
        });
    }
}
function HTSocketReqHosts(hTSocketConnListening){
    this.instance=()=>{return new HTSocketReqHosts();}
    this.run=(server_socket, hTApiForNavMenu)=>{
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
        console.log("HTSocketRespHostTable.run()")
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
    this.run=(hTStructure)=>{}
}
function WindowEvents(_window){
    this.run=(hTStructure)=>{
        if(_window){
            //@ TODO: rebounce event and send to hTStructure
        }
    }
}
function HostTable2ClickListening(selectedHost){
    this.run=(hostTable)=>{
        if(typeof selectedHost == "string"){selectedHost = _global_stor[selectedHost]}
        //@ jquery object
        hostTable.dom().click((ev)=>{
            selectedHost.set_current_host(_clicked_host(ev))
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