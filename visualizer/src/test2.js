const os = require('os')
console.log(os.hostname())
console.log(Object.prototype)
console.log(Object.__proto__)
console.log(Function.prototype)
console.log(Function.__proto__)

console.log(Object.__proto__ === Function.prototype)
console.log(Object.__proto__ === Function.__proto__)
console.log(Function.prototype === Function.__proto__)

const obj = {}
console.log(obj.prototype)
console.log(obj.__proto__.__proto__)
console.log(obj.__proto__ === Object.prototype)
console.log("-----")
console.log(Object.__proto__.__proto__ === Object.prototype)
console.log(Object.prototype === obj.prototype)
console.log(Object.__proto__ === obj.prototype)
console.log(Object.__proto__ === obj.prototype)

function abc(){}
console.log(abc.prototype)
console.log(abc.__proto__)