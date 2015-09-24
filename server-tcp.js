var express = require('express');
var app     = express();
var fs      = require('fs');
var net     = require('net');
var cp      = require('child_process');
var websocketStream = require('websocket-stream');


var ip = "172.19.21.140", port = 5001, width = 960, height = 540;



var server = require('http').createServer(app);



var WebSocketServer = require('ws').Server
var wss = new WebSocketServer({server: server});

var sent = 0;

wss.on('connection', function(socket){
  socket.send(JSON.stringify({action : "init", width: width, height : height}));


  var readStream = net.connect(port, ip, function(){
    console.log("remote stream ready");
  });

  var stream = websocketStream(socket);
  readStream.pipe(stream);

  console.log('New guy');


  socket.on('close', function() {
    console.log('stopping client interval');

  });
});


app.use('/feed', function(req, res){

  var readStream = net.connect(port, ip, function(){
    console.log("remote stream ready");
  });
  readStream.pipe(res);
  console.log('New guy http');


});
app.use(express.static(__dirname + '/public'));
server.listen(8080, "0.0.0.0");
