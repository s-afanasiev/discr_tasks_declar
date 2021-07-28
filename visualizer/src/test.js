function AddedJob(){}
const obj = new AddedJob()
console.log(Object.getPrototypeOf(obj) === obj.prototype.prototype)
console.log(Object.prototype)