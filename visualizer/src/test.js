const dev = {}
let counter = 0;

dev[counter++] = "a";
dev[++counter] = "b";

console.log(dev)