"use strict";

const MEDIA_STREAM_CONSTRAINTS = {audio:true, video:true};

const ID_MAIN_WINDOW = "main-window";


//class that all Containers inherit from
//each Window in Liquid Galaxy cluster can have one or multiple Containers
//BaseContainer mostly handles universal display logic
class BaseContainer{
  constructor(){
    this.width = null;
    this.height = null;
    this.element = document.createElement("div");
  }
  
  setupContainer(){
    this.element.style.height = window.innerHeight;
    this.element.style.width = window.innerWidth;
  }
}

//Currently, zoeshow requires every instance to manually enter mutual peer 
//identifier and whether window is sending or receiving the stream.
//Eventually should only be needed for tablet/phone starting the program,
//where LiquidGalaxyManager will handle synchronizing
//the rest of the windows.
class SetupConnectionContainer extends BaseContainer{
  constructor(){
    super();
    
    this.form = document.createElement("div");
    this.isHosting = document.createElement("input");
    this.isHosting.setAttribute("type", "checkbox");
    this.textbox = document.createElement("input");
    this.textbox.setAttribute("type", "text");
    this.isSending = document.createElement("input");
    this.isSending.setAttribute("type", "checkbox");
    this.submit = document.createElement("input");
    this.submit.setAttribute("type", "button");
    this.submit.setAttribute("value", "Submit");
    
    this.form.appendChild(this.isHosting);
    this.form.appendChild(this.textbox);
    this.form.appendChild(this.isSending);
    this.form.appendChild(this.submit);
    
    this.element.appendChild(this.form);
    
    this.submit.addEventListener("click", this.startConnection.bind(this));
    
    this.setupContainer();
  }
  
  setupContainer(){
    super.setupContainer();
  }
  
  startConnection(){
    if(this.isHosting.checked){
      connection.hostRoom(this.textbox.value);
    } else {
      connection.joinRoom(this.textbox.value);
    }
    if(this.isSending.checked){
      windowManager.removeContainer();
      windowManager.addContainer(new VideoChatSendContainer());
    } else {
      windowManager.removeContainer();
      windowManager.addContainer(new VideoChatReceiveContainer());
    }
  }
}

class VideoChatSendContainer extends BaseContainer{
  constructor(){
    super();
    
    this.element.textContent = "Trying to establish a connection...";
    
    this.setupContainer();
    
    this.startStream();
  }
  
  setupContainer(){
    super.setupContainer();
  }
  
  startStream(){
    navigator.mediaDevices.getUserMedia(MEDIA_STREAM_CONSTRAINTS).then(this.displayStream.bind(this)).catch(function(err) {});
  }
  
  displayStream(stream){
    connection.startCall(stream);
    this.element.textContent = "";
    this.video = document.createElement("video");
    this.element.appendChild(this.video);
    this.video.srcObject = stream;
    this.video.muted = true;
    this.video.play();
  }
}

class VideoChatReceiveContainer extends BaseContainer{
  constructor(){
    super();
    
    this.element.textContent = "Waiting for stream to start...";
    
    this.setupContainer();
  }
  
  setupContainer(){
    super.setupContainer();
  }
  
  displayStream(stream){
    this.element.textContent = "";
    this.video = document.createElement("video");
    this.element.appendChild(this.video);
    this.video.srcObject = stream;
    this.video.play();
  }
}


//Each web browser instance has one Window with a WindowManager.
//This will be able to support multiple Containers + dynamic positioning,
//but currently only supports one Container at a time. 
//(see ConnectionManager.callReceived)
class WindowManager{
  constructor(){
    this.containers = [];
    //if Liquid Galaxy setup {
      //check if master already exists
    //} else {
      //this.screenId = 0;
      //this.isMaster = true;
    //}
  }
  
  addContainer(cont){
    this.containers.push(cont);
    console.log(this.containers);
    mainWindow.appendChild(cont.element);
    this.resize();
  }
  
  removeContainer(){
    mainWindow.removeChild(this.containers.pop().element);
  }
  
  resize(){
    mainWindow.style.height = window.innerHeight;
    mainWindow.style.width = window.innerWidth;
  }
}

//ConnectionManager handles sending and receiving streams.
//Each browser instance has one ConnectionManager.
//In the future, will be able to handle multiple streams at a time,
//as well as general data connections eventually.
class ConnectionManager{
  constructor(){
    this.flagIsSendingCamera = false;
    this.roomId = null;
    this.streamId = null;
    this.flagIsMaster = true;
    this.flagIsLg = false;
    this.callers = [];
    this.myStream = null;
  }

  hostRoom(roomName){
    this.roomId = roomName;
    this.occupants = [];
    this.peer = new Peer(this.roomId, {
      host: location.hostname,
      port: location.port || (location.protocol === 'https:' ? 443 : 80),
      path: '/peerjs'
    });
    this.peer.on('connection', this.occupantJoined.bind(this));
  }

  joinRoom(roomName){
    this.roomId = roomName;
    if(!this.flagIsLg){
      this.peer = new Peer({
        host: location.hostname,
        port: location.port || (location.protocol === 'https:' ? 443 : 80),
        path: '/peerjs'
      });
    }
    this.occupants = [this.peer.connect(this.roomId, {metadata:{isMaster:true}})];
    this.occupants[0].on('data', this.roomDataReceived.bind(this));
  }

  roomDataReceived(data){
    switch(data.type){
      case "occupantJoined":
        this.newOccupant(data.id);
      break;
    }
  }

  occupantJoined(conn){ //room host
    if(conn.metadata.isMaster){
      this.occupants.push(conn);
      conn.on('data', this.roomDataReceived.bind(this));
      conn.on('call', this.streamRequested.bind(this));
      for(var o of this.occupants){
        if(o.peer != conn.peer){
          o.send({type:"occupantJoined", id:conn.peer});
          conn.send({type:"occupantJoined", id:o.peer}); //everyone in the room is new to peer who just joined
        }
      }
    } else {
      //conn.on('data', this.roomDataReceived.bind(this));
      conn.on('call', this.streamRequested.bind(this));
    }
  }

  //need to implement ending connections in general
  //occupantLeft(id){
    //remove occupant from list and broadcast
  //}

  newOccupant(id){ //room members (only master when using lg)
    var conn = this.peer.connect(id);
    this.occupants.push(conn);
    conn.on('data', this.roomDataReceived.bind(this));
    if(this.flagIsLg){
      //need to do a better job of assigning occupants to lgs once we get multiple containers per page
      if(this.lgsUsed < this.lgDisplays.length){
        this.lgDisplays[this.lgsUsed].send({type:"occupantJoined", id:id});
      }
    } else {
      //open data connection with id and request stream from id
      this.receiveOccupant(id);
    }
  }

  receiveOccupant(id){
    var conn = this.peer.call(id, null);
    this.callers.push(conn);
    conn.on('stream', this.callReceived.bind(this));
  }

  hostLg(lgId){
    this.lgId = lgId;
    this.flagIsLg = true;
    this.lgDisplays = [];
    this.peer = new Peer(this.lgId, {
      host: location.hostname,
      port: location.port || (location.protocol === 'https:' ? 443 : 80),
      path: '/peerjs'
    });
    this.peer.on('connection', this.lgJoined.bind(this));
    this.lgsUsed = 0;
  }

  joinLg(lgId){
    this.lgId = id;
    this.flagIsMaster = false;
    this.flagIsLg = true;
    this.peer = new Peer({
      host: location.hostname,
      port: location.port || (location.protocol === 'https:' ? 443 : 80),
      path: '/peerjs'
    });
    this.lgConnection = this.peer.connect(this.lgId, {metadata:{isLg:true}});
    this.lgConnection.on('data', this.lgDataReceived.bind(this));
  }

  lgJoined(conn){
    this.lgDisplays.push(conn);
    conn.on('data', this.lgDataReceived.bind(this));
  }

  lgDataReceived(data){
    switch(data.type){
      case "occupantJoined":
        this.receiveOccupant(data.id);
      break;
    }
  }

  streamRequested(conn){
    this.callers.push(conn);
    if(this.flagIsSendingCamera){
      conn.answer(this.myStream);
    }
  }

  startCall(stream){
    if(!this.flagIsSendingCamera){
      this.myStream = stream;
      this.flagIsSendingCamera = true;
      for(var c of this.callers){
        c.answer(this.myStream)
      }
    }
  }

  callReceived(stream){
    windowManager.containers[0].displayStream(stream);
  }
  
  /*setupReceiveCamera(id){
    this.roomId = id;
    var peer = new Peer(this.roomId, {
      host: location.hostname,
      port: location.port || (location.protocol === 'https:' ? 443 : 80),
      path: '/peerjs'
    });
    this.peer.on('call', this.connectionInitiatedReceive.bind(this));
  }
  
  connectionInitiatedReceive(conn){
    this.mediaConnection = conn;
    this.mediaConnection.answer(null);
    this.mediaConnection.on('stream', this.callReceived.bind(this));
  }
  
  callReceived(stream){
    windowManager.containers[0].displayStream(stream);
  }
  
  setupSendCamera(id){
    this.roomId = id;
    this.peer = new Peer({
      host: location.hostname,
      port: location.port || (location.protocol === 'https:' ? 443 : 80),
      path: '/peerjs'
    });
    
  }
  
  startCall(stream){
    this.mediaConnection = this.peer.call(this.roomId, stream);
    this.flagIsSendingCamera = true;
  }*/
}

var mainWindow = document.getElementById(ID_MAIN_WINDOW);
var windowManager = new WindowManager();
var connection = new ConnectionManager();

//use the hash portion of the URL to determine which mode we are in
switch(window.location.hash){
  case "#lgadmin":
    // handle room connection, send video feed to room members, delegate other connections
    windowManager.addContainer(new SetupConnectionContainer());
    connection.hostLg(window.location.querystring);
  break;
  case "#lg":
    // use peerjs to connect to admin, display a video feed
    windowManager.addContainer(new VideoChatReceiveContainer());
    connection.joinLg(window.location.querystring);
  break;
  default:
    // handle connection, send video feed, display all feeds
    windowManager.addContainer(new SetupConnectionContainer());
}
