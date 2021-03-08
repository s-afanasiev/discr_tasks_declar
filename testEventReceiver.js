new EventReceive(
    new ManifestCompare(
        new PartnerKill(
            new filesUpdate(
                new PartnerStart()
            )
        )
    )
)

new MicroTask(
    "manifestCompare",
    new MicroTask(
        "killThePartner",
        new MicroTask(
            "updateTheFiles",
            new MicroTask(
                "startThePartner",
                new MicroTask()
            )
        )
    )
)

function MicroTask(task_name, nextTask){
    this.task_name=task_name;
    this.nextTask=nextTask;
    this.run=(data, cbUp)=>{
        this.cbUp = cbUp;
        socket.emit(this.task_name, data);
        socket.once(this.task_name, (res)=>{
            this.nextTask.run();
        })
        setTimeout(()=>{
            this.cbUp("timeout")
        }, 5000);
    }
}
function ManifestCompare(nextTask){
    this.nextTask=nextTask;
    this.run=(cbUp)=>{
        this.cbUp = cbUp;
        socket.emit("upd", manifest);
        socket.once("upd", (changes)=>{
            this.nextTask.run();
        })
        setTimeout(()=>{
            this.cbUp("timeout")
        }, 5000);
    }
}
function PartnerKill(nextTask){
    this.nextTask=nextTask;
    this.run=()=>{
        socket.emit("kill");
        socket.once("kill", (done)=>{
            this.nextTask.run();
        })
    }
}
function filesUpdate(){}
function PartnerStart(){}