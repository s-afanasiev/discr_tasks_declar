const obj = {
    a:5,
    b:()=>{
        console.log("fu");
    }
}
const stringified = JSON.stringify(obj);
console.log("stringified=",stringified);
const stringified2 = JSON.stringify(stringified);
console.log("stringified2=",stringified2);
const stringified3 = JSON.stringify(stringified2);
console.log("stringified3=",stringified3);