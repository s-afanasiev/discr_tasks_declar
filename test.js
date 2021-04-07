const arr = ['a', 'b', 'c', 'd', 'e'];
arr.forEach((el,i)=>{
    console.log("el=",el);
    if (el=='b' || el=='c'){
        arr.splice(i,1);
    }
})
console.log("arr=",arr);