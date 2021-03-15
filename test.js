const so = new SocketIoHandlers().run()
function SocketIoHandlers(ioWrap, manifest){
    this.ioWrap= ioWrap;
    this.manifest= manifest;
    this.socket = undefined;
    this.run=(agent_ids)=>{
        //this.socket = this.ioWrap.run(agent_ids).socketio();
        console.log("this.tech_events=",this.tech_events);
		Object.keys(this.tech_events).forEach((ev)=>{
			console.log("hanging up '"+this.tech_events[ev]+"' event.");
			//@ hangs up all listeners
            if(this.tech_events.includes(this.tech_events[ev])){
                const t1 = this.tech_evt_handlers[this.tech_events[ev]].bind(this)();
            }
        });
	};
	this.tech_events = ['connect', 'disconnect', 'identifiers', 'compareManifest', 'partner_leaved', 'partner_appeared', 'same_md5_agents', 'sync_dirs', 'start_agent', 'kill_agent', 'update_folder'];
    this.tech_evt_handlers = {
		connect: function(){ console.log("'connect' event"); },
		disconnect: function(){ console.log("'disconnect' event"); },
		identifiers: function(){},
		compareManifest: function(remote_manifest){
            console.log("in compareManifest() this=",this);
        },
		partner_leaved: function(data){},
		partner_appeared: function(){},
		same_md5_agents: function(){},
		sync_dirs: function(){},
		start_agent: function(){},
		kill_agent: function(){},
		update_folder: function(){}
    }
}