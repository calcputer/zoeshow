"use strict";

const MEDIA_STREAM_CONSTRAINTS = {audio:true, video:true};

const ID_MAIN_WINDOW = "main-window";

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

class VideoChatContainer extends BaseContainer{
  constructor(){
    super();
    
    this.element.textContent = "Webcam Loading...";
    
    navigator.mediaDevices.getUserMedia(MEDIA_STREAM_CONSTRAINTS).then(this.displayStream.bind(this)).catch(function(err) {});
    
    this.setupContainer();
  }
  
  setupContainer(){
    super.setupContainer();
  }
  
  displayStream(stream){
    console.log(stream);
    this.element.textContent = "";
    this.video = document.createElement("video");
    this.element.appendChild(this.video);
    this.video.srcObject = stream;
    this.video.play();
    console.log(this.element);
    //this.element.play();
  }
}

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
    mainWindow.appendChild(cont.element);
    this.resize();
  }
  
  resize(){
    mainWindow.style.height = window.innerHeight;
    mainWindow.style.width = window.innerWidth;
  }
}

var mainWindow = document.getElementById(ID_MAIN_WINDOW);
var windowManager = new WindowManager();

windowManager.addContainer(new VideoChatContainer());
