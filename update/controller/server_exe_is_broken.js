// test_fork();
test_exec();

function test_exec(){
    say_to_console()
}
function test_spawn(){
    say_to_console()
}
function test_fork(){
    say_to_console()

    process.on("message", (m) => {
        console.log("Child got message: " + m);
    });
    process.send('hi from child!');
}
function say_to_console(){
    console.log("i'am check_server_exe_is_broken.js file!")
    setTimeout(()=>{
        console.log("i'am check_server_exe_is_broken.js file and hello again!")
    }, 5000)
}