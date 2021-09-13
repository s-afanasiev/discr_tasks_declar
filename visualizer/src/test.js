function Controller(specialControllerMode, normalControllerMode, agent_ids, agent){
	this.specialControllerMode = specialControllerMode;
	this.normalControllerMode = normalControllerMode;
	this.agent_ids = agent_ids;
	this.agent = agent;
	//@----------------------------
	this.agentType=()=>{return this.agent.agentType("controller")}
	this.agentPid=()=>{return this.agent.agentPid()}
	this.agentPpid=()=>{return this.agent.agentPpid()}
	this.agentApid=()=>{return this.agent.agentApid()}
	this.socketio=()=>{return this.agent.socketio()}
	//@----------------------------
	this.isOnline=function(){return this.agent.isOnline()}
	this.switchOnline=function(is_online){this.switchOnline(is_online)}
	//@----------------------------
	this.isUpdateMode=()=>{return this.agent.isUpdateMode()}
	this.switchUpdateMode=(is_update_mode)=>{this.agent.switchUpdateMode(is_update_mode)}
	//@----------------------------
	this.isSpecialMode=()=>{return this.agent.isSpecialMode()}
	this.switchSpecialMode=(is_special_mode)=>{this.agent.switchSpecialMode(is_special_mode)}
	//@----------------------------
	this.instance=function(agent_ids){
				return new Controller(
						this.specialControllerMode,
						this.normalControllerMode, 
						agent_ids,
						new Agent(agent_ids)
				);
		}
	this.run=function(browserIoClients, host, agentUpdateChain){
			this.agent.run();
			this.normalControllerMode = this.normalControllerMode.instance()
	}
this.welcomeAgent = (agent_socket, agent_ids, manifest_snapshot, partner, mapped_mans_snapshot)=>{
		this.agent.welcomeAgent();
		this.firstComparingMappedMans(agent_socket, mapped_mans_snapshot).then(res=>{
				console.log("Controller.firstComparingMappedMans() res =", res);
		}).catch(err=>{
				console.error("Controller.firstComparingMappedMans() Error:", err);
		});
}
	this.add_flags=function(flags){this.agent.add_flags(flags)}
	this.listenForDisconnect=()=>{
			this.agent_socket.once('disconnect', (reason)=>{
					this.switchOnline(false);
					console.log("Controller.listenForDisconnect(): disconnect: reason =", reason);
					//@ Todo: higher at the host level - notify externalSource object
					this.gui_news({msg:"agent_offline"});
					this.host.agent_disconnected(this.agent_ids.ag_type, this.flags["me_was_killed_by_reason"]);
					this.normalControllerMode.drop_future_jobs();
					//this.specialControllerMode.drop_future_jobs();
					console.log("Controller.listenForDisconnect(): eventNames=", this.agent_socket.eventNames());
					//@ socket.eventNames()
					//@ socket.listeners(event)
					//@ socket.removeAllListeners([event])
					this.agent_socket.removeAllListeners();
					this.agent_socket = undefined;
			});
	}
	this.gui_news=(data, payload)=>{this.agent.gui_news(data, payload)}
	this.gui_ctrl=(msg, is_ext_kick)=>{
			//console.log("Controller.gui_ctrl(): msg=", msg);
			if(msg.type=="list_future_jobs"){
					this.normalControllerMode.list_future_jobs(list=>{
							console.log("Controller.gui_ctrl(): list_future_jobs=",list);
							this.gui_news({msg:"list_future_jobs", value:list});
					});
			}else if(msg.type=="drop_future_jobs"){
					this.normalControllerMode.drop_future_jobs(msg);
			}else if(msg.type=="jobs_config"){
					//@msg = {type: event_type, caller_id: <some id from external Object>, concrete_agent: <agent md5>}
					console.log("Controller.gui_ctrl(): '"+msg.type+"'-type msg")
					this.normalControllerMode.jobs_config(config=>{
							console.log("Controller.gui_ctrl(): returning jobs config from normalControllerMode")
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
	this.doNormalWork=()=>{
			if(this.isSpecialMode()){
					//@ Special Mode: for example some Render operation.
					this.gui_news({msg:"agent_work", value:"resume doing work in a special mode"});
					this.specialControllerMode.run(this, this.agent_socket);
			}else{
					//@ Normal Mode: 'diskSpace' and so on...
					this.gui_news({msg:"agent_work", value:"resume doing work in a normal mode"});
					this.normalControllerMode.run(this, this.agent_socket);
			}
	}
	//@ then partner disconnected - he says it to host - and then host say to partner that partner is offline
	this.partner_offline=(reason)=>{this.agent.partner_offline(reason)}
	this.kill_similar_outcasts=()=>{this.agent.kill_similar_outcasts()}
}