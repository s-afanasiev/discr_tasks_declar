'use strict'
console.log("file mytable.js connected!")
function MyTable(params, host_list, myTr){    
    let _cur_row = 0;
    let _a = "<table>";
    this.run=()=>{
        console.log("MyTable.run()");
        //@ params.max_td_count - max count of TD in one TR
        const _max_td_count = params.max_td_count;
        const _tr_count = Math.ceil(host_list.table.length / _max_td_count);
        for(let i=0; i<_tr_count; i++){
            _a += myTr.instance().run(
                host_list.table.slice(
                    _cur_row, 
                    _cur_row = _cur_row + _max_td_count
                )
            )
        }
        return _a += "</table>";
    }
}
function MyTr(myTd){
    this.myTd = myTd;
    let _a = "<tr>";
    this.instance=()=>{return new MyTr(myTd);}
    this.run=(hosts_info)=>{
        //console.log("MyTr.run()");
        for(let i=0; i<hosts_info.length; i++){
            _a += myTd.instance().run(hosts_info[i])
        }
        return _a += "</tr>";
    }
}
function MyTd(){
    let _a = "";
    this.instance=()=>{return new MyTd();}
    this.run=(data)=>{
        //console.log("MyTd.run()");
        _a += "<td valign='top' class = 'host' id='md5__"+data.md5+"'>";
            _a +="<table style = 'border:1px solid red; width:100%;'>";
                _a +="<tr><td colspan = '2'>";
                    _a += "host : <b>"+data.md5+"</b>";
                    _a += "<div class='future_jobs_btn_dock' style='width:100px; height:30px; background-color:#ddf; cursor:pointer;'>get future jobs</div>";
                _a +="</td></tr>";
                _a +="<tr class = 'agents'>";
                    _a +="<td class = 'agent_type__launcher'>"
                        if(data.launcher){
                            _a += agent_data(data.launcher);
                        }
                    _a += "</td>";
                    _a +="<td class = 'agent_type__controller'>";
                        if(data.controller){
                            _a += agent_data(data.controller);
                        }
                    _a += "</td>";
                _a +="</tr>";
            _a +="</table>";
        _a +="</td>";
        return _a;
    }
}
const agent_data=(agent_data, status)=>{
    console.log("mytablejs agent_data()")
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