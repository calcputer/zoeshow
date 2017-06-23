var express = require('express');
var path = require('path');
var app = express();
var ExpressPeerServer = require('peer').ExpressPeerServer;

app.get('/', function(req, res){
    res.sendFile(path.join(__dirname, 'zoeshow.html'));
});
app.use('/src/resources', express.static('resources'));

var server = app.listen(process.env.PORT);

app.use('/peerjs', require('peer').ExpressPeerServer(server, {}))
