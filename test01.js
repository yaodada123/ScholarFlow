// EventEmmiter

const { rejects } = require("node:assert");
const { resolve } = require("node:dns");

// const { log } = require("node:console");


// class myEventEmmiter {
//     constructor() {
//         this.event = {};
//     }

//     on(eventName, callback) {
//         if (typeof callback !== 'function') {
//             throw Error("function 要求");
//         }
//         let callbacks = this.event[eventName] ? this.event[eventName] : [];

//         callbacks.push(callback);

//         this.event[eventName] = callbacks;

//     }

//     emmiter(eventName, ...args) {
//         if (!this.event[eventName]) {
//             console.log("无该事件");
//             return;
//         }
//         let callbacks = this.event[eventName];

//         for (let cb of callbacks) {
//             cb(...args);
//         }

//     }
// }

// function sayHello(name) {
//     console.log("hello,", name);
// }

// function sayHi(name) {
//     console.log("hi, ", name);

// }

// let EventEmmiter01 = new myEventEmmiter();

// EventEmmiter01.on("hello", sayHello);
// EventEmmiter01.on("hello", sayHi);

// EventEmmiter01.emmiter("hello", "yhc")


// function sumWithfreetime(n, time = 15) {
//     return new Promise((resolve, reject) => {
//         if (typeof n !== 'number') {
//             reject(new Error("n应为数值"))
//         }
//         let sum = 0,
//             cur = 1;

//         function run(deadline) {
//             let remainTime = deadline.timeRemaining;
//             while (cur <= n && remainTime > 0) {
//                 sum += cur;
//                 cur++;
//                 remainTime = deadline.timeRemaining;
//             }

//             if (cur > n) {
//                 resolve(sum);
//             } else {
//                 requestIdleCallback(run, { timeout: time });
//             }
//         }

//         requestIdleCallback(run, { timeout: time });
//     })
// }

// sumWithfreetime(100).then((res) => {
//     console.log(res);

// })












// function requestSum(n, time = 15) {
//     return new Promise((resolve, reject) => {
//         if (typeof n !== 'number') {
//             reject(new Error("非数字"));
//         }

//         let sum = 0,
//             current = 1;

//         function run(deadline) {
//             let remainTime = deadline.timeRemaining();
//             while (current < n && remainTime > 0) {
//                 sum += current;
//                 current++;
//                 remainTime = deadline.timeRemaining();
//             }

//             if (current > n) {
//                 resolve(sum);
//             } else {
//                 requestIdleCallback(run, { timeout: time });
//             }
//         }
//         run();
//     })
// }

// requestSum(100, 15).then(res => {
//     console.log(res);

// })




// 时间分片计数

function requestSum(n, timeout = 15) {
    return new Promise((resolve, reject) => {
        let sum = 0,
            index = 1;

        function run(deadline) {
            let remainTime = deadline.timeRemaining();
            while (index <= n && remainTime > 0) {
                sum += index;
                index++;
                remainTime = deadline.timeRemaining();
            }

            if (index <= n) {
                requestIdleCallback(run, { timeout: timeout });
            } else {
                resolve(sum);
            }
        }
    })
}

requestSum(100).then(res => {
    console.log(res);

})












//