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
            ).as("selectedHost"),
            new NavCommonBtns()
        ),
        new HTApiForNavMenu(),
        new HostTable2(
            new HTRequestsByClick(
                new HTAnyClickListening(
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
        navMenu.run(server_socket, hTApiForNavMenu, args.parent_nav_id);
        hTApiForNavMenu.run(navMenu);
        hostTable.run(server_socket, hTApiForNavMenu, args.parent_id)
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
function NavMenu(selectedHost, navCommonBtns){
    let _a = "";
    let _$a = undefined;
    this.run=(server_socket, hTApiForNavMenu, parent_div_id)=>{
        _a = "<div style='height:100%; width:100%; border:1px solid blue; display:table;'>"
        _$a = $(_a);
        $("#"+parent_div_id).append(_$a);
        _$a.append("<div style='display:table-cell; width:10%;'>nav menu!</div>")
        _$a.append(navCommonBtns.run().dom())
        _$a.append(selectedHost.run().dom())
    }
    this.click_on_host=(host_info)=>{
        selectedHost.click_on_host(host_info)
    }
}
function SelectedHost(hostActions, oneHostPrivateInterface){
    let _$a = undefined//run
    this.as=(name)=>{
        _global_stor[name] = this;
        return this;
    }
    this.dom=()=>{return _$a;}
    this.run=()=>{
        _$a = $("<div style='height:100%; width:50%; border:1px dashed orange; display:table-cell;'>")
        _$a.append("<div>selected host</div>");
        return this;
    }
    this.click_on_host=(host_info)=>{
        _$a.empty();
        _$a.append("<div>selected host:</div>");
        _$a.append("<div>"+host_info.md5+"</div>");
        const _hostTd = host_info.hostTd;
        _$a.append(_hostTd.html())
    }
}
function HostActions(futureJobs, addedJob, stoppedJob){    
}
function FutureJobs(){}
function AddedJob(){}
function StoppedJob(){}
function OneHostPrivateInterface(){}
function NavCommonBtns(){
    let _$a = undefined//run
    this.dom=()=>{return _$a;}
    this.run=()=>{
        _$a = $("<div style='height:100%; width:20%; border:1px dashed grey; display:table-cell;'>update mode<div>");
        return this;
    }
}
//@---------------------------------
function HTApiForNavMenu(){
    this.navMenu = undefined;//run
    this.run=(navMenu)=>{
        this.navMenu = navMenu;
    }
    this.click_on_host=(host_info)=>{
        this.navMenu.click_on_host(host_info)
    }
}
//@---------------------------------
function HostTable2(hTRequestsByClick){
    this.run=(server_socket, hTApiForNavMenu, parent_div_id)=>{
        hTRequestsByClick.run(server_socket, hTApiForNavMenu, parent_div_id);
    }
}
function HTRequestsByClick(hTAnyClickListening){
    this.run=(server_socket, hTApiForNavMenu, parent_div_id)=>{
        hTAnyClickListening.run(server_socket, hTApiForNavMenu, parent_div_id, this)
    }
}
function HTAnyClickListening(hTHostsVisualLocation){
    this.hTRequestsByClick=undefined;//run
    this.hTApiForNavMenu=undefined;//run
    this.run=(server_socket, hTApiForNavMenu, parent_div_id, hTRequestsByClick)=>{
        this.hTRequestsByClick = hTRequestsByClick;
        this.hTApiForNavMenu = hTApiForNavMenu;
        hTHostsVisualLocation.run(server_socket, hTApiForNavMenu, parent_div_id, this)
    }
    //@ click_on_host service
    this.click_on_host=(host_md5)=>{
        hTHostsVisualLocation.click_on_host(host_md5);
        this.hTApiForNavMenu.click_on_host(host_md5);
    }
}
function HTHostsVisualLocation(hTStructure, hTSocketResponses, windowEvents){
    let _parent_div_id = ""; //run
    this.run=(server_socket, hTApiForNavMenu, parent_div_id, hTAnyClickListening)=>{
        console.log("HTHostsVisualLocation.run()");
        _parent_div_id = parent_div_id;
        hTStructure.run(this, hTAnyClickListening)
        hTSocketResponses.run(server_socket, hTApiForNavMenu, hTStructure, this);
        windowEvents.run(hTStructure);
        
    }
    this.append_table=(_$a)=>{
        console.log("HTHostsVisualLocation.draw_table()");
        //console.log("HTHostsVisualLocation.draw_table(): _a =", _a)
        //console.log("HTHostsVisualLocation.draw_table(): _parent_div_id =", _parent_div_id)
        $("#"+_parent_div_id).append(_$a);
    }
    this.click_on_host=(host_md5)=>{
        //@ to reset selection from other hosts
        hTStructure.click_on_host(host_md5);
    }
}
//@ Renamed from 'HostTable' to 'HostTable2', because in other js-file already exists name 'HostTable'
function HTStructure(hostTr, hTHostsVisualLocation){
    this.hostTr = hostTr;
    this.hTHostsVisualLocation = hTHostsVisualLocation;
    let _max_td_count = 1;
    this.change_max_td_count=(count)=>{
        _max_td_count = count;
    }
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
    //@ E.g. server_msg_dto = { msg: "agent_work", value: "'disk_space_lte_25' job done", agent_type: "controller", md5: "fc59692915b9b0afd602ed573ee7deff" }
    this.agent_work=(server_msg_dto)=>{
        _trStor.all().forEach(_hostTr=>{
            _hostTr.agent_work(server_msg_dto);
        })
    }
    //this.run=(host_table_config, host_list)=>{}
    this.run=(hTHostsVisualLocation, hTAnyClickListening)=>{
        console.log("HTStructure.run()");
        this.hTHostsVisualLocation = hTHostsVisualLocation;
        _a += "<table id='"+_table_id+"'>";
        _$a = $(_a);
        if(this.hTHostsVisualLocation){this.hTHostsVisualLocation.append_table(_$a);}
        _trStor = new HT_TrStor().init(this.hostTr, hTAnyClickListening);
        this.minimal_table("not requested data");
        return this;
    }
    this.click_on_host=(host_md5)=>{
        _trStor.all().forEach(_tr=>{
            _tr.click_on_host(host_md5);
        })
    }
}
function HT_TrStor(){
    const _all_trs = {};
    let _tr_counter = 0;
    let hostTrFactory = undefined; //init
    this.hTAnyClickListening = undefined;//init
    this.instance=()=>{return new HT_TrStor();}
    this.init=(hostTr, hTAnyClickListening)=>{
        this.hTAnyClickListening = hTAnyClickListening;
        hostTrFactory = hostTr;
        return this;
    }
    this.len=()=>{return Object.keys(_all_trs).length}
    this.all=()=>{return Object.values(_all_trs);}
    this.alone_minimal_tr=()=>{return _all_trs[Object.keys(_all_trs)[0]]}
    this.new_tr=(parent_width)=>{
        const new_tr = hostTrFactory.instance(_tr_counter++).init(parent_width, this.hTAnyClickListening);
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
                break;
            }
        }
        if(not_crowded_tr == undefined){
            not_crowded_tr = this.new_tr(parent_width);
        }
        return not_crowded_tr;
    }
}
function HostTr(hostTd, order_number){
    this.hostTd = hostTd;
    this.hTAnyClickListening = undefined;//init
    this.id=()=>{return order_number}
    const any_tr_id_begin_with = "host_table_tr__";
    let _a = "";
    let _$a = undefined;
    const _hosts_td = {};
    let _parent_width;
    this.instance=(order_number)=>{return new HostTr(hostTd, order_number);}
    this.init=(parent_width, hTAnyClickListening)=>{
        console.log("HostTr.init() id=", this.id())
        this.hTAnyClickListening = hTAnyClickListening;
        _parent_width = parent_width;
        _a = "<tr>"
        _$a = $("<tr>")
        _$a.attr('id', any_tr_id_begin_with+this.id());
        //console.log("HostTr.init(): _$a =", _$a)
        return this;
    }
    this.html=()=>{return _a}
    this.dom=()=>{return _$a}
    this.hosts=()=>{return _hosts_td}
    this.host_count=()=>{return Object.keys(_hosts_td).length}
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
            const _hostTd = _create_host_td(server_msg_dto);
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
    this.minimal_table=(msg_to_show)=>{
        console.log("HostTr.minimal_table()");
        const _hostTd = hostTd.instance(0).init(_$a.width()).show_msg(msg_to_show)
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
    const _create_host_td=(server_msg_dto)=>{
        return hostTd.instance(server_msg_dto.md5).init(_$a.width(), this.hTAnyClickListening);
    }
    this.run=(host_list_of_one_row)=>{
        console.log("HostTr.run()")
        for(let i=0; i<host_list_of_one_row.length; i++){
            const _hostTd = _create_host_td(host_list_of_one_row[i]);
            _$a.append(_hostTd.dom());
            _hosts_td[host_list_of_one_row[i].md5] =_hostTd;
            _hostTd.run(host_list_of_one_row[i]);
        }
        return this;
    }
    //@param host_info = {md5, hostTd}
    this.click_on_host=(host_info)=>{
        for(let i in _hosts_td){
            if(_hosts_td[i].md5() != host_info.md5){
                _hosts_td[i].set_highlight('1px solid red')
            }
        }
    }
}
function HostTd(hostHeader, hostLauncher, hostController, md5_id){
    this.hostHeader = hostHeader;//factory
    this.hostLauncher = hostLauncher;//factory
    this.hostController = hostController;//factory
    this.curHeader = undefined;
    this.curLauncher = undefined;
    this.curController = undefined;
    this.hTAnyClickListening = undefined;//init
    this.html=()=>{return _$a.html()}
    this.md5=()=>{return md5_id;}
    let _parent_width;
    let _a = "";
    let _$a = undefined;
    let $agents_wrapper;
    let _agents_wrapper_height = 72;
    this.set_highlight=(border_params)=>{
        _$a.css('border', border_params);
    }
    this.id=()=>{return _id;}
    this.instance=(md5_id)=>{return new HostTd(hostHeader, hostLauncher, hostController, md5_id);}
    this.init=(parent_width, hTAnyClickListening)=>{
        console.log("HostTr.init() md5=", this.md5())
        this.hTAnyClickListening = hTAnyClickListening;
        _parent_width = parent_width;
        _a += "<td valign='top' class = 'host' style='border:1px solid red;'>";
        _$a = $(_a);
        _$a.on('click', (evt)=>{
            console.log("clicked!");
            _$a.css('border', '2px solid #f2f');
            if(this.hTAnyClickListening){
                this.hTAnyClickListening.click_on_host({md5:this.md5(), hostTd: this})
            }
        })
        return this;
    }
    this.show_msg=(msg)=>{
        if(_$a){_$a.append(msg)}
        return this;
    }
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
    //@ E.g. server_msg_dto = { msg: "agent_work", value: "'disk_space_lte_25' job done", agent_type: "controller", md5: "fc59692915b9b0afd602ed573ee7deff" }
    this.agent_work=(server_msg_dto)=>{
        this.curController.agent_work(server_msg_dto.value, this)
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
        if(height > _agents_wrapper_height){
            console.log("HostTd.set_dom_height():", height)
            $agents_wrapper.height(height+"px");
        }
    }
    this.add_to_dom_height=(height)=>{
        const total_height = _agents_wrapper_height + height;
        $agents_wrapper.height(total_height+"px");
    }
    this.run=(data)=>{
        console.log("HostTd.run()");
        _$a.attr("id", "host_td__"+data.md5)
        _$a.append(hostHeader.instance(data).run().dom())
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
function HostHeader(hostBtnFutureJobs, data){
    const _data = data;
    let _a = "";
    let _$a = undefined;
    this.instance=(data)=>{return new HostHeader(hostBtnFutureJobs, data)}
    this.html=()=>{return _a}
    this.dom=()=>{return _$a}
    this.run=()=>{
        console.log("HostHeader.run()");
        _a += "<div id='host_header_md5__"+data.md5+"' style='border:1px solid green;'></div>"
        _$a = $(_a);
        _$a.append("<div><b>"+data.md5+"</b></div>")
        _$a.append(hostBtnFutureJobs.instance(data.md5).init().dom())
        return this;
    }
}
function HostBtnFutureJobs(md5){
    let _$a = undefined;
    this.instance=(md5)=>{
        return new HostBtnFutureJobs(md5);
    }
    this.dom=()=>{return _$a}
    this.init=()=>{
        _$a = $("<div class='future_jobs_btn_dock' style='width:150px; background-color:#ddf; cursor:pointer;'>get future jobs</div>")
        return this;
    }
}
function HostLauncher(data){
    const _data = data;
    let _a = "";
    let _$a = undefined;    
    this.instance=(data)=>{return new HostLauncher(data)}
    this.init=(parent_width, hostTd)=>{
        console.log("HostLauncher.init() ", data.md5, "parent_width/2 =", parent_width/2)
        _$a = $("<div id='host_launcher__"+data.md5+"' style='width:50%; height:auto; border:1px solid blue; position:absolute; top:0; left:0;'></div>");
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
function HostController(taskList, data){
    this.taskList = taskList;
    this.curTaskList = undefined;
    const _data = data;
    //console.log("HostController: data =", data)
    let _a = "";
    let _$a = true;
    this.instance=(data)=>{return new HostController(this.taskList, data)}
    this.init=(parent_width, hostTd)=>{
        _$a = $("<div id='host_controller__"+data.md5+"' style='width:50%; height:auto; border:1px solid orange; position:absolute; left:50%;'></div>");
        return this;
    }
    let _online = false;
    this.online=()=>{return _online}
    this.html=()=>{return _a}
    this.dom=()=>{return _$a}
    this.dom_height=()=>{return _$a.height()}
    //@param server_msg_dto = {msg: "agent_online", agent_type: "controller", agent_pid: 4904, agent_ppid: 5144, agent_apid: 5864, md5: "6e8bc6f1e3ef10adf9dd98617c133110"}
    this.agent_online=(server_msg_dto)=>{
        console.log("HostController.agent_online()")
        _online = true;
        _$a.empty().append(agent_data_html(server_msg_dto));
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
        this.curTaskList.agent_work(value, hostTd)
    }
    this.run=()=>{
        console.log("HostController.run()");
        if(_data.controller){
            _online = true;
            _$a.append(agent_data_html(_data.controller))
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
    this.run=(server_socket, hTApiForNavMenu, hTStructure, hTHostsVisualLocation)=>{
        hTSocketReqHosts.run(server_socket, hTApiForNavMenu);
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
    this.instance=()=>{return new HTSocketRespAgentWork();}
    this.run=(hTStructure, server_msg_dto)=>{
        //console.log("HTSocketRespAgentWork.run() not implemented");
        hTStructure.agent_work(server_msg_dto);
    }
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