const ws = require('ws');

const server = new ws.Server({ port: 10086, perMessageDeflate: true }, () => { console.log('server up') })

server.on('connection', (socket, req) => {
    setInterval(() => {
        socket.send(`${new Date()} server hello`);
    }, 100);
    socket.on('message', (data) => {
        console.log(data.toString());
    })
})