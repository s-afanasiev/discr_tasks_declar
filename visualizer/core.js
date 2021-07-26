'use strict'
	console.log("file core.js connected!")
	const EVENT_NAME = 'browser_commands';
	const grey_pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEUAAACnej3aAAAAAXRSTlMz/za5cAAAAA pJREFUCNdjYAAAAAIAAeIhvDMAAAAASUVORK5CYII=";

	//------------------------------------
	//---------main-----------------------
	//------------------------------------
	function page_constructor(data_pointer)
	{
		//console.log("page_constructor");
		//$("#main_div").empty().append(a);
		RENDER.ww = $(window).width();
		RENDER.wh = $(window).height();
		
		bind_mouse_events_for_document();
	}
	function test_in_core_fu(){
		console.log("test_in_core_fu test")
	}
	//привязка к элементу document
	function bind_mouse_events_for_document(namespace){
		$(document).unbind("mousedown");
		$(document).unbind("mousemove");
		$(document).unbind("mouseup");
		//@-----------------------------------------
		$(document).bind("mousedown", function(mouse_ev){
			window["document_last_ms"] = new Date().getTime();
			//console.log("mousedown: ID =", mouse_ev.target.id, ", ClassName =", mouse_ev.target.className);
			window["curr_elem_id"] = mouse_ev.target.id;
			//- if not such class - then return empty string ""
			window["curr_elem_class"] = mouse_ev.target.className;
			window["document_xd"] = mouse_ev.pageX;
			window["document_yd"] = mouse_ev.pageY;
		});
		$(document).bind("mousemove", function(e) {});
		$(document).bind("mouseup", function(e){
			if(window["curr_elem_class"].endsWith("_input")){
				//-? 'mouseup' event happened in input and no reaction is required
			}else{
				var dx = Math.abs(window["document_xd"] - e.pageX);
				var dy = Math.abs(window["document_yd"] - e.pageY);
				var timestamp = new Date().getTime();
				var dt = Math.abs(window["document_last_ms"] - timestamp);
				if(dx < 20 && dy < 20 && dt > 30){	
					var this_id_decode = window["curr_elem_id"].split("-");
						//console.log("curr elem id decode =", this_id_decode);
					var custom_function = this_id_decode[1];
					if(typeof window[custom_function] == 'function') {
						window[custom_function](window["curr_elem_id"]);
					}else{ 
						//console.log("couldn't find function: "+ custom_function); 
					}
				}
				//console.log("mouseup:", e.target.id);
			}
		});
	}
	
	function main_id_decode(clickant)
	{
		var this_id = $(clickant).attr("id");
		var this_id_decode = this_id.split("-");

		if (typeof this_id_decode[0] != "undefined") 
			var prefix = this_id_decode[0];
		if (typeof this_id_decode[1] != "undefined") 
			var data_pointer = this_id_decode[1];
		if (typeof this_id_decode[2] != "undefined") 
			var current_input_id = this_id_decode[2];

		return { prefix, data_pointer, current_input_id};
	}
	
	function main_bind(namespace)
	{
		//console.log("main_bind");
		var {use_touch, use_mouse} = define_touch_and_mouse();
		
		window[namespace+"_last_ms"] = (new Date).getTime();

		$("."+namespace+"_input").unbind();
		$("."+namespace+"_input").bind("keyup", function(e)
		{
			var { prefix, data_pointer, current_input_id} = main_id_decode(this);
			var this_id = $(this).attr("id");
			
			window[data_pointer]["inputs"][current_input_id]["val"] = $(this).val();
			
			main_input_validator_fu(this_id);
			
		}).bind("paste", function(e)
		{
			// this is decide which free us of calling delayed functions
			var pastedData = e.originalEvent.clipboardData.getData('text');
			
			var { prefix, data_pointer, current_input_id} = main_id_decode(this);
			window[data_pointer]["inputs"][current_input_id]["val"] = pastedData;
				
			var this_id = $(this).attr("id");
			main_input_validator_fu(this_id);
		});
		
		//========================================
		
		$("."+namespace+"_btn").unbind();
		
		if(use_mouse == 1)
		{
			$("."+namespace+"_btn").bind("mousedown", function(e) {
				window[namespace+"_btnid"] = $(this).attr("id");
			});

			$("."+namespace+"_btn").unbind();
			
			
		}
		
		if(use_touch == 1)
		{
			
			$("."+namespace+"_btn").bind("touchstart", function(e)
			{
				window[namespace+"_btnid"] = $(this).attr("id");
			});
			

			if(window[namespace+"_touch_bound"] != 1)
			{
				$(document).bind("touchstart", function(e)
				{
					window[namespace+"_xd"] = e.originalEvent.touches[0].pageX;
					window[namespace+"_xu"] = e.originalEvent.touches[0].pageX;
					window[namespace+"_yd"] = e.originalEvent.touches[0].pageY;
					window[namespace+"_yu"] = e.originalEvent.touches[0].pageY;
				});
				
				$(document).bind("touchmove", function(e)
				{
					window[namespace+"_xu"] = e.originalEvent.touches[0].pageX;
					window[namespace+"_yu"] = e.originalEvent.touches[0].pageY;
				});
				
				$(document).bind("touchend", function(e)
				{
					if(typeof window[namespace+"_global_mouse_up"] == 'function')
					{
						window[namespace+"_global_mouse_up"](namespace, 40, (new Date).getTime(), 30);
					}
					else
					{
						alert(namespace+"_global_mouse_up is not a function ");
					}
				});
				window[namespace+"_touch_bound"] = 1;
			}
		}
		
	}


  // ------- GARBAGE ----------
  function delete_this_later_if_class_input() 
  {
    //- this condition rejects cases when there are no classes for the clicked element
    if(window["curr_elem_class"].length == 0) {
      return "current element has no classes"
    }
    
      if(window["curr_elem_class"].endsWith("_input"))
      {
        //let input_class = window["curr_elem_class"];
        //$('.'+input_class).unbind();
        $('#'+window["curr_elem_id"]).unbind();
        //$('.'+input_class).bind('blur', (key_ev)=>
        $('#'+window["curr_elem_id"]).bind('blur', (key_ev)=>
        {
          //console.log("input BLUR!!! unbind");
          //$('.'+input_class).unbind('keyup');
          $('#'+window["curr_elem_id"]).unbind('keyup');
        });

        //$('.'+input_class).bind('keyup', (key_ev)=>
        $('#'+window["curr_elem_id"]).bind('keyup', (key_ev)=>
        {
          //- WRITE KEYSUP TO VARIABLES
          //window[mouse_ev.target.id] = key_ev.target.value;
          //- ALTERNATIVE:
          //- window[window["curr_elem_id"]] = $("#"+window["curr_elem_id"]).val()
          //console.log("window["+ mouse_ev.target.id + "] value =" + key_ev.target.value);

          //- key_ev.which == 13 - it means that key "Enter" was pressed
          if ((key_ev.which == 13)||(key_ev.key == "Enter"))
          {
            //nav-id_nav_input-agent_index
            //nav-id_nav_input-command
            if(window["nav-id_nav_input-agent_index"])
            {
              let agent_index = window["nav-id_nav_input-agent_index"];
              //console.log("AGENT INDEX = "+ agent_index + ", type = " + typeof agent_index);

              make_agent_uniq_id_and_send_to_server(agent_index);
              
            }
          }
          
        });
      } 
  }

  function make_agent_uniq_id_and_send_to_server(agent_index)
  {
    let agent_uniq;
    console.log("AGENT =", global_agent_table);
    if (global_agent_table[agent_index]) 
    {
      let md5 = global_agent_table[agent_index][2];
      let type = global_agent_table[agent_index][0];
      agent_uniq = md5 + "_" + type;
    }
    console.log("AGENT UNIQ =", agent_uniq);
    //----------------------------
    if(agent_uniq)
    {
      let agent_command = window["nav-id_nav_input-command"];
      console.log("typeof agent_command = ", typeof agent_command);
      if((typeof agent_command == 'string')&&(agent_command.length>0))
      {
        console.log("AGENT COMMAND =", agent_command);

        let parcel = {
          what: agent_command,
          whom: agent_uniq
        }
        console.log("JOBS command parcel = ", parcel);

        server_.emit(EVENT_NAME, parcel );
      }

      let arbitrary_command = window["nav-id_nav_input-arbitrary_cmd"];
      console.log("typeof arbitrary_command = ", typeof arbitrary_command);
      if((typeof arbitrary_command == 'string')&&(arbitrary_command.length>0))
      {
        
        console.log("arbitrary_command =", arbitrary_command);

        let parcel = {
          what: "arbitrary_cmd",
          whom: agent_uniq,
          how: arbitrary_command
        }
        console.log("Arbitrary cmd parcel = ", parcel);

        server_.emit(EVENT_NAME, parcel );
      }
    }
  }

  function make_agent_uniq_id_and_send_to_server_2(agent_index, btn_and_input_same_part_id)
  {
    //console.log("AGENT TABLE =", global_agent_table);
    if ( !Array.isArray(global_agent_table[Number(agent_index)]) ) {
		return "global_agent_table does not contain agent info"
	}
	let md5 = global_agent_table[agent_index][2];
	let agent_type = global_agent_table[agent_index][0];
	if ( (typeof md5 != "string") || (typeof agent_type != "string") ) {
		return "can't receive md5 or agent_type"
	}
	let agent_uniq = md5 + "_" + agent_type;
	
	let parcel = { whom: agent_uniq }

	const same_input_value = $("#nav_inputs-"+btn_and_input_same_part_id).val();
	console.log("same_input_value =", same_input_value);

	console.log("btn_and_input_same_part_id =", btn_and_input_same_part_id);
	if (btn_and_input_same_part_id == "arbitrary_cmd") {
		parcel.what = btn_and_input_same_part_id; //arbitrary_cmd
		parcel.how = same_input_value; //e.g.: 'notepad.exe'
		console.log("arbitrary_cmd!!!");
		console.log(parcel);
	}
	else if (btn_and_input_same_part_id == "job_cmd") {
		parcel.what = same_input_value;
		console.log("job_cmd!!! parcel =");
		console.log(parcel);
	}
	
	server_.emit(EVENT_NAME, parcel );
	
  }
  //-----------------------------
  
 
	
	function console_out_event_keys(e)
	{				
		for (let i in e) {
			if (typeof e[i] == 'number') console.log("e["+i+"] ="+ e[i] );
			else if (typeof e[i] == 'string') console.log("e["+i+"] ="+ e[i] );
			else if (typeof e[i] == 'boolean') console.log("e["+i+"] ="+ e[i] );
			else if (typeof e[i] == 'object') {
				if (i == 'view') continue;
				else console.log("e["+i+"] = <<"+ JSON.stringify(e[i]) + ">>" );
			}
			else if (typeof e[i] == 'function') console.log("e["+i+"] ="+e[i]() );
		}	
	}
				
	function define_touch_and_mouse()
	{
		console.log("BrowserDetect.OS =",BrowserDetect.OS);
		var use_touch = 0;
		var use_mouse = 0;
		if(BrowserDetect.OS == 'Windows'||BrowserDetect.OS == 'Linux'||BrowserDetect.OS == 'Mac')
		{
			try 
			{  
				use_touch = 1;
				document.createEvent("TouchEvent");
			}
			catch(e) 
			{
				use_touch = 0;
			}
			console.log("set use_mouse = 1");
			use_mouse = 1;
		}
		else
		{
			use_touch = 1;
		}
		return {use_touch, use_mouse}
	}
	
	//-------------------------------------------------
	//-id actions, when press buttons, parse their IDs and calling them functions
	//-------------------------------------------------
	function id_stop_repeated_task(btn_id) {
		console.log("id_stop_repeated_task()...");
		let id_dec = btn_id.split("-");
		console.log("id_dec =", id_dec);
		server_.emit(EVENT_NAME, {
			operation: "stop_repeated_task", 
			//because index 0 is master
			agent_md5: id_dec[2],
			agent_type: id_dec[3],
			job_id: id_dec[4],
			task_name: id_dec[5]
		});
		server_.once("stop_repeated_task", res=>{
			alert(res);
		});
	}

	function id_jobs_behavior_templates(btn_id) {
		console.log("id_jobs_behavior_templates()");
		server_.emit(EVENT_NAME,"get_jobs_bt");
		server_.once('get_jobs_bt', res=>{
			console.log("server answer on 'get_jobs_bt'");
			let modal = RENDER.modal_jobs_bt();
			//$("#"+"main_div").empty().append(RENDER.modal_jobs_bt(res));
			$("body").append(modal.a);
			//let table = RENDER.prepare_table(2);
			$("#"+modal.id_contain).append(RENDER.draw_table_will(res));
			//bind_mouse_events_for_document();
		});
	}
	//- button 'disk_space' in UI under agent name
	function id_call_some_task(btn_id) {
		console.log("id_call_some_task()...");
		//var this_id_decode = window["curr_elem_id"].split("-");
		console.log("typeof server_ =", typeof server_);
		// "process-id_call_some_task-<agent md5>-<agent type>"
		let id_dec = btn_id.split("-");
		console.log("id_dec =", id_dec);
		let agent_uniq = id_dec[2]
		
		server_.emit(EVENT_NAME, {what: "disk_space", whom: agent_uniq});
  }
  function arbitrary_cmd(btn_id)
  {
    console.log("now in arbitrary_cmd(), id:", btn_id);	
	const btn_name = extract_btn_name(btn_id)
	const agent_index = extract_agent_index(btn_id);
	  
    make_agent_uniq_id_and_send_to_server_2(agent_index, btn_name);
  }
  function job_cmd(btn_id)
  {
	console.log("now in job_cmd(), id:", btn_id);	
	const btn_name = extract_btn_name(btn_id);
	const agent_index = extract_agent_index(btn_id);

	make_agent_uniq_id_and_send_to_server_2(agent_index, btn_name);
  }
  
  function extract_btn_name(btn_id){
	var id_dec = btn_id.split("-");
	if (window["my_btns"][id_dec[1]]) {
		var same_input_name = $("#nav_inputs-"+id_dec[1]);
	    console.log("same_input_name=", same_input_name.val());	
		return id_dec[1];
	}

  }
	
  function extract_agent_index(btn_id){
	var id_dec = btn_id.split("-");
	if (window["my_btns"][id_dec[1]]) {
		let dependent_input = window["my_btns"][id_dec[1]].dependent_inputs;
		
		const agent_index = $("#nav_inputs-"+dependent_input[0]).val();
		
		return agent_index;
	}

  }
	//-------------UI---------------------
	//------------------------------------
	//------------------------------------
	function ui_fill_nav_menu(options){
    //options = {id: String, hang_listeners_on_inputs: Boolean}
		var ntw = $("#"+options.id).width();
		var nth = $("#"+options.id).height();

		$("#"+"nav_transition").width((ntw*.1)+"px").height(nth).css("left", 0+"px").css("top", 0+"px").css("border","1px solid blue");
		$("#"+"nav_board").width((ntw*.9)+"px").height(nth).css("left", "10%").css("top", 0+"px").css("border","1px solid red");

		let table_id = 'nav_table';
		let table = RENDER.draw_table(4, 2, table_id);
		$("#"+"nav_board").append(table);
    
    insert_inputs_in_table({
      table_id: table_id, 
      input_names:["job_cmd", "agent_index", "arbitrary_cmd"],
      hang_listeners_on_inputs: options.hang_listeners_on_inputs
    });
    insert_btns_in_table({
      table_id: table_id, 
      btn_names:["arbitrary_cmd", "job_cmd"],
      dependent_inputs: ["agent_index"]
    });
		

		
    // functions
    function insert_inputs_in_table(options){
      //- Class of input must ends with '..._input', to bind listeners of keydown
      if (!Array.isArray(options.input_names)) {
        return {err:"no inputs names"};
      }
      const names = options.input_names;

      for (let i=0; i<names.length; i++) {
        $("#"+table_id+"-td-0-"+i).append(names[i]);
        let input_object = new CreateElement({tag: "input", classes: "main_input", id: "nav_inputs-"+names[i]});
        $("#"+table_id+"-td-1-"+i).append(input_object.a);
        if (options.hang_listeners_on_inputs) {
          //$("#"+input_object_object.id).bind('keyup')
        }
      }
    }
    function insert_btns_in_table(options){
      if (!Array.isArray(options.btn_names)) {
        return {err:"no btns names"};
      }
      if (!window["my_btns"]) { window["my_btns"] = {}; }

      for (let i=0; i<options.btn_names.length; i++) {
        let btn_obj = new CreateElement({
          tag: "button", 
          name: options.btn_names[i], 
          id: "nav_btns-"+options.btn_names[i]});
        btn_obj = Object.assign(btn_obj, options);
        //в глобальном объекте windows сохраняем информацию о кнопке, её id, связь с неодноименными input-ами
        window["my_btns"][options.btn_names[i]] = btn_obj;
        $("#"+table_id+"-td-"+i+"-3").append(btn_obj.a);
      }
    }
	}
	function modal_close(button_id) {
		console.log("modal_close(): button_id = ", button_id);
		//modal-jobs_bt
		let id_dec = button_id.split("-");
		id_dec[1] = "modal_wrapper";
		let wrapper_id = id_dec.join("-");
		console.log("modal_close(): wrapper_id = ", wrapper_id);
		$("#"+wrapper_id).remove();
		//$("#"+wrapper_id).remove();
		//$("body").remove("#"+wrapper_id);
	}

	function CreateElement(obj) 
	{
		//console.log("CreateElement param =", obj);
		// obj = {id: String, classes: String, tag: <"button"||"input"||"label">}
		this.width = 100;
		this.height = 20;
		this.related_items = {};
		this.id = obj.id || "undef";
		this.classes = obj.classes || "undef";
		
		this.draw_a = function() 
		{
			let a = "";
			if (typeof obj.tag == 'undefined') {
				a = "tag name is not declared";
				console.log("draw_a(): err:" + a);
				return a;
			}
			
			if (obj.tag == "input") 
			{
				//console.log("draw_a input");
				a += "<div style = ' width:"+(this.width)+"px; height:"+this.height+"px; box-shadow: 0 2px 1px -1px #dddddd; overflow:hidden; border: 1px solid #dde; margin:3px; '>";
					a += "<input class = '"+this.classes+"' id='"+this.id+"' style = 'background-color:"+"#eff6f8"+"; width:"+(this.width)+"px; height:"+(this.height)+"px;'>";
				a += "</div>";
			}
			else if (obj.tag == "button")
			{
				//console.log("draw_a button");
				let btn_name = obj.name || "test_btn";
				a += "<div style = ' width:"+this.width+"px; height:"+this.height+"px; box-shadow: 0 4px 2px -2px #dddddd; overflow:hidden; border: 1px solid #dde; margin:auto; '>";
					a += "<div class='"+this.classes+"'  id='"+this.id+"' style='margin: auto; position:absolute; cursor:pointer; width:"+this.width+"px; height:"+this.height+"px;line-height:"+this.height+"px; text-align:center;font-size:12px;' >" +btn_name+ "</div>"
				a += "</div>";
			}
			return a;
		}

		this.a = this.draw_a();
	}

	var RENDER = 
	{
		ww: 0,
		wh: 0,
		modal_jobs_bt: function(obj) {
			let a = "";
			let id = 'modal_jbt-modal_wrapper';
			let id_close = 'modal_jbt-modal_close';
			let id_contain = 'modal_jbt-modal_contain';
			
			var modal_w = this.ww * 0.8;
			var modal_h = this.wh * 0.8;
			var mt = this.wh * 0.1;
			var ml = this.ww * 0.1;
			//draw background
			//a += "<div class = '"+"blabla"+"' id = '"+"modal_jbt-background"+"' style = 'position:absolute; width:"+ww+"px; height:"+wh+"px; opacity:1;left:0px;top:0px;'>";
				//a += "<img style = 'opacity:0;position:absolute; width:"+ww+"px; height:"+wh+"px;' src = '"+grey_pixel+"'/>";
			//a += "</div>";
			//Modal block
			a += "<div id='"+id+"' style='text-align:center;font-family:arial; color:#666666; font-weight:bold; font-size:13px; top:"+mt+"px; left:"+ml+"px; position:absolute; width:"+modal_w+"px; height:"+modal_h+"px; box-shadow: 1px 2px 8px 3px #dddddd; background-color:#ffffff;' >";
				//Container
				a += "<div id ='"+id_contain+"' style='border:1px solid red; line-height:"+mt+"px;width:"+(modal_w)+"px;height:"+(modal_h - mt)+"px;'>";
				a += "</div>";
				/*
				a += RENDER.draw_table(2);
				a += "<div id ='info_text' style='width:"+(modal_w)+"px;height:"+(modal_h - mt)+"px;vertical-align:middle; display:table-cell;'>";
					if(obj instanceof Object) {
						if(obj.jobs instanceof Object) {
							a += "<ul>";
							let arr = Object.keys(obj.jobs);
							for (let i in arr) {
								a += "<li>";
									a += arr[i];
								a += "</li>";
							}
							a += "</ul>";
						}
					}
					else {a =+ "nothing!"}
					a += "</div>";
					*/
				// Button OK
				a += "<div id ='"+id_close+"' style='border:1px solid green; line-height:"+mt+"px;width:"+(modal_w)+"px;height:"+(mt)+"px;'>";
						a += "OK";
				a += "</div>";
			a += "</div>";
			//$('body').append(a);
			return {a:a, id:id};

		},
		center_button: function(btn_name , agent_md5, agent_type){
			var a = "";
			a += "<div style = ' width:"+100+"px; height:"+20+"px; box-shadow: 0 4px 2px -2px #dddddd; overflow:hidden; border: 1px solid #dde; margin:auto; display: inline-block;'>";
				a += "<div class = '"+"render_btn"+"'  id = '"+"process-id_call_some_task-"+agent_md5+"_"+agent_type+"' style = 'margin: auto; position:absolute; cursor:pointer; width:"+100+"px; height:"+20+"px;line-height:"+20+"px; text-align:center;font-size:16px;' >" +btn_name+ "</div>"
			a += "</div>";
			return a;
		},
		stop_button: function(btn_name , agent_md5, agent_type, task_id, task_name){
			var a = "";
			let width = 40, height = 15;
			let id = "process-id_stop_repeated_task-"+agent_md5+"-"+agent_type+"-"+task_id+"-"+task_name;
			a += "<div style = ' width:"+width+"px; height:"+height+"px; box-shadow: 0 4px 2px -2px #dddddd; overflow:hidden; border: 1px solid #dde; margin:auto; '>";
				a += "<div class = '"+"render_btn"+"'  id = '"+id+"' style = 'margin: auto; position:absolute; cursor:pointer; width:"+width+"px; height:"+height+"px;line-height:"+height+"px; text-align:center;font-size:12px;' >" +btn_name+ "</div>"
			a += "</div>";
			return a;
		},
		nav_button: function(btn_name, width){
			var a = "";
			width = width*.15;
			let height = width*.1;
			let font_size = 14;
			let id = "nav-id_jobs_behavior_templates-";
			a += "<div style = ' width:"+(width)+"px; height:"+height+"px; box-shadow: 0 2px 1px -1px #dddddd; overflow:hidden; border: 1px solid #dde; margin:3px; '>";
				a += "<div class = '"+"render_btn"+"'  id = '"+id+"' style = ' position:absolute; cursor:pointer; width:"+width+"px; height:"+height+"px;line-height:"+height+"px; text-align:center;font-size:"+font_size+"px;' >" +btn_name+ "</div>"
			a += "</div>";
			return a;
		},
		nav_input: function(className, width, id_suffix){
			var a = "";
			width = width*.15;
			let height = width*.1;
			let font_size = 14;
			let id = "nav-id_nav_input-"+id_suffix;
			a += "<div style = ' width:"+(width)+"px; height:"+height+"px; box-shadow: 0 2px 1px -1px #dddddd; overflow:hidden; border: 1px solid #dde; margin:3px; '>";
				a += "<input class = '"+className+"' id='"+id+"' style = 'background-color:"+"#eff6f8"+"; width:"+(width)+"px; height:"+(height)+"px;'>";
			a += "</div>";
			return a;
		},
		agent_input: function(className, agent_sid, agent_index){
			var a = "";
			let width = 100;
			let height = 20;
			let font_size = 14;
			let id = "nav-id_agent_input"+agent_index;
			a += "<div style = ' width:"+(width)+"px; height:"+height+"px; box-shadow: 0 2px 1px -1px #dddddd; overflow:hidden; border: 1px solid #dde; margin:3px; '>";
				a += "<input class = '"+className+"' id = '"+id+"' style = 'background-color:"+"#eff6f8"+"; width:"+(width)+"px; height:"+(height)+"px;'>";
			a += "</div>";
			return a;
		},
		draw_table: function(cols, rows_, id){
			var a = "";
			let rows = rows_ || 1;
			//width='100%' height='100%'
			let id_name = id;

			a += "<table border='1' style ='border-collapse: collapse;' >";
				for (let i=0; i<rows; i++) 
				{
					a += "<tr id='"+id_name+"-tr-"+i+"'>";
					for (let j=0; j<cols; j++) 
					{
						a += "<td id='"+id_name+"-td-"+i+"-"+j+"'></td>";
					}
					a += "</tr>";
				}
			a += "</table>";

			return a;
		},
		draw_table_will: function(jobs_bt) {
			console.log("jobs_bt = ", jobs_bt);
			var max_width = 3;
			var cur_row_index = 0;
			var cur_col_index = 0;

			
			var a = "";
			
			a += "<table style = 'width:100%; height:100%'>";
			a += "<tr>";
			
			for(var i = 0; i<jobs_bt.length; i++)
			{
				cur_col_index = cur_col_index + 1;
				if(cur_col_index == max_width)
				{
					cur_col_index = 0;
					cur_row_index = cur_row_index + 1;
					a += "</tr><tr>";
				}
				
				a += "<td valign = 'top'>";
					a +="<table style = 'border:1px solid red; width:100%;'>";
						a +="<tr><td colspan = '3'>";
							a += "jobs : "+ jobs_bt[i];
						a +="</td></tr>";
						
						a +="<tr><td colspan = '3' style = 'border-bottom:1px solid black;'>";
							a += jobs_bt[i][0];
						a +="</td></tr>";
						/*
						for(var j = 0; j< jobs_bt[i][7].length; j++)
						{
							a +="<tr>";
							a +="<td>";
								let task_repeated = jobs_bt[i][7][j][14];
								let t_name = jobs_bt[i][7][j][1];
								if (task_repeated > 1) {
									a += RENDER.stop_button('stop', i, t_name);
								}
							a +="</td>"
							a +="<td>";
								let task_name = jobs_bt[i][7][j][1];
								a += task_name + ": ";
							a +="</td>"
							a +="<td>";
								let state = TSTATES[jobs_bt[i][7][j][2]];
								a += state;
							a +="</td>"
							a +="</tr>";
						}
						*/

					a +="</table>";
				a += "</td>";
				
			}
			
			a += "</tr>";
			a += "</table>";
			
			return a;
		},
		prepare_table: function(cols, max_cols){
			var a = "";
			var id = "table-"+part_id;
			//width='100%' height='100%'
			a += "<table id='"+id+"' border='1' >";
			a += "</table>";
			return {a:a, id:id};
		},
		TableConstructor: function(id, max_cols){
			this.id = id;
			this.max_cols = max_cols;
			this.cols = 0;
			this.rows = 0;
			this.add_column = function(){
				if (this.rows == 0) {
					$('#'+this.id).append(this.draw_tr());
				}
				if (this.cols < this.max_cols) {
					$('#'+this.id)
				}
			}
			this.draw_tr = function(){
				let a = "";
				a += "<tr id='"+this.id+"-tr-"+this.rows+"'></tr>"
				return a;
			}
		}
	}

	//-----------------------------------------------------
	//-polyfill for string.endsWith() method
	if (!String.prototype.endsWith) {
		Object.defineProperty(String.prototype, 'endsWith', {
		  value: function(searchString, position) {
			var subjectString = this.toString();
			if (position === undefined || position > subjectString.length) {
			  position = subjectString.length;
			}
			position -= searchString.length;
			var lastIndex = subjectString.indexOf(searchString, position);
			return lastIndex !== -1 && lastIndex === position;
		  }
		});
	  }
	  //-----------------------------------------------------