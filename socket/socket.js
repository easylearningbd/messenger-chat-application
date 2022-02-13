const io = require('socket.io')(8000,{
     cors : {
          origin : '*',
          methods : ['GET','POST']
     }
})

io.on('connection',(socket)=>{
     console.log('Socket is connecting...')
})