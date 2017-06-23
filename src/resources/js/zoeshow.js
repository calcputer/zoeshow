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
    this.textbox = document.createElement("input");
    this.textbox.setAttribute("type", "text");
    this.isSending = document.createElement("input");
    this.isSending.setAttribute("type", "checkbox");
    this.submit = document.createElement("input");
    this.submit.setAttribute("type", "button");
    this.submit.setAttribute("value", "Submit");
    
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
    if(this.isSending.checked){
      connection.setupSendCamera(this.textbox.value);
      windowManager.removeContainer();
      windowManager.addContainer(new VideoChatSendContainer());
    } else {
      connection.setupReceiveCamera(this.textbox.value);
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
      this.screenId = 0;
      this.isMaster = true;
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
    this.flagIsSending = false;
    this.roomId = null;
  }
  
  setupReceiveCamera(id){
    this.roomId = id;
    this.peer = new Peer(this.roomId, {
      host: location.hostname,
      port: location.port || (location.protocol === 'https:' ? 443 : 80),
      path: '/peerjs'
    })
    this.flagIsSending = true;
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
    })
    this.flagIsSending = false;
    
  }
  
  startCall(stream){
    this.mediaConnection = this.peer.call(this.roomId, stream);
  }
}

var mainWindow = document.getElementById(ID_MAIN_WINDOW);
var windowManager = new WindowManager();
var connection = new ConnectionManager();

windowManager.addContainer(new SetupConnectionContainer());
