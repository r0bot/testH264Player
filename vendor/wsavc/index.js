"use strict";

var Avc            = require('../broadway/Decoder');
var YUVWebGLCanvas = require('../canvas/YUVWebGLCanvas');
var Size           = require('../utils/Size');

var NALStream = require('./nalfeed');


var available = true;


function WSAvcPlayer(canvas, canvastype, nals, delay) {
  this.canvas = canvas;
  this.nals = nals;
  this.delay = delay;
  // AVC codec initialization
  this.avc = new Avc();
  if(false) this.avc.configure({
    filter: "original",
    filterHorLuma: "optimized",
    filterVerLumaEdge: "optimized",
    getBoundaryStrengthsA: "optimized"
  });

  //WebSocket variable
  this.ws;
  this.pktnum = 0;
  this.prevframe;
  var separator = new Uint8Array([0,0,0,1]);


  var self = this, cpt =0, last = 0;

  setInterval(function(){
    console.log( (cpt - last) / 2, "fps");
    last = cpt;

  }, 2000);


  this.nalstream = new NALStream(separator, {}, function(frame){
    cpt ++;
    if(false && !available) {
      console.log("Not available, dropping frame");
      return;
    }

    available = false;

    console.log("Got grame", cpt);
    self.decode(frame);
    self.prevframe = frame;
  });

  function onPictureDecodedWebGL(buffer, width, height) {
    if (!buffer) {
      return;
    }
    var lumaSize = width * height;
    var chromaSize = lumaSize >> 2;

    this.webGLCanvas.YTexture.fill(buffer.subarray(0, lumaSize));
    this.webGLCanvas.UTexture.fill(buffer.subarray(lumaSize, lumaSize + chromaSize));
    this.webGLCanvas.VTexture.fill(buffer.subarray(lumaSize + chromaSize, lumaSize + 2 * chromaSize));
    this.webGLCanvas.drawScene();
    available = true;

  }
  
  function onPictureDecodedCanvas(buffer, width, height) {
    if (!buffer) {
      return;
    }
    var lumaSize = width * height;
    var chromaSize = lumaSize >> 2;
    
    var ybuf = buffer.subarray(0, lumaSize);
    var ubuf = buffer.subarray(lumaSize, lumaSize + chromaSize);
    var vbuf = buffer.subarray(lumaSize + chromaSize, lumaSize + 2 * chromaSize);
    
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var yIndex = x + y * width;
        var uIndex = ~~(y / 2) * ~~(width / 2) + ~~(x / 2);
        var vIndex = ~~(y / 2) * ~~(width / 2) + ~~(x / 2);
        var R = 1.164 * (ybuf[yIndex] - 16) + 1.596 * (vbuf[vIndex] - 128);
        var G = 1.164 * (ybuf[yIndex] - 16) - 0.813 * (vbuf[vIndex] - 128) - 0.391 * (ubuf[uIndex] - 128);
        var B = 1.164 * (ybuf[yIndex] - 16) + 2.018 * (ubuf[uIndex] - 128);
        
        var rgbIndex = yIndex * 4;
        this.canvasBuffer.data[rgbIndex+0] = R;
        this.canvasBuffer.data[rgbIndex+1] = G;
        this.canvasBuffer.data[rgbIndex+2] = B;
        this.canvasBuffer.data[rgbIndex+3] = 0xff;
      }
    }
    
    this.canvasCtx.putImageData(this.canvasBuffer, 0, 0);
    

  }

  this.decode = function(data) {
    var naltype = "invalid frame";
    if (data.length > 4) {
      if (data[4] == 0x65) {
        naltype = "I frame";
      }
      else if (data[4] == 0x41) {
        naltype = "P frame";
      }
      else if (data[4] == 0x67) {
        naltype = "SPS";
      }
      else if (data[4] == 0x68) {
        naltype = "PPS";
      }
    }
    //console.log("WSAvcPlayer: Passed " + naltype + " to decoder");
    /* Decode Pictures */
    this.avc.decode(data);
  };


  this.connectws = function(url) {		
    // Websocket initialization
    if (this.ws != undefined) {
      this.ws.close();
      delete this.ws;
    }
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";
    this.ws.onopen = function() {
      console.log("WSAvcPlayer: Connected to " + url);
    }.bind(this);
    this.ws.onmessage = function(evt) {
      if(typeof evt.data == "string")
        return this.cmd(JSON.parse(evt.data));

      this.pktnum++;
      var data = new Uint8Array(evt.data);

      this.nalstream.feed(data);
     // console.log("WSAvcPlayer: [Pkt " + this.pktnum + " (" + evt.data.byteLength + " bytes)]");
    }.bind(this);
    this.ws.onclose = function()	{ 
      // websocket is closed.
      console.log("WSAvcPlayer: Connection closed")
    };
  };

  this.connect = this.connectws;

  this.initCanvas = function(width, height){
    if (canvastype == "webgl") {
      this.webGLCanvas = new YUVWebGLCanvas(this.canvas, new Size(width, height));
      this.avc.onPictureDecoded = onPictureDecodedWebGL.bind(this);
    } else if (canvastype == "canvas") {
      this.avc.onPictureDecoded = onPictureDecodedCanvas.bind(this);
      this.canvasCtx = this.canvas.getContext("2d");
      this.canvasBuffer = this.canvasCtx.createImageData(width, height);
    }
  };

  this.cmd = function(cmd){
    console.log("Incoming request", cmd);

    if(cmd.action == "init") {
      this.initCanvas(cmd.width, cmd.height);
      this.canvas.width  = cmd.width;
      this.canvas.height = cmd.height;
    }
  };
  
  this.disconnect = function() {
    this.ws.close();
  };
  
  this.playStream = function() {
    var message = "REQUESTSTREAM " + this.nals + "NAL " + this.delay + "MS";
    this.ws.send(message);
    console.log("WSAvcPlayer: Sent " + message);
  };
  
  this.stopStream = function() {
    this.ws.send("STOPSTREAM");
    console.log("WSAvcPlayer: Sent STOPSTREAM");
  }
  
  this.playNAL = function() {
    var message = "REQUEST " + this.nals + "NAL";
    this.ws.send(message);
    console.log("WSAvcPlayer: Sent " + message);
  };
  
  this.flush = function() {
    console.log("Flush: " + this.prevframe.length);
    this.decode(this.prevframe);
  };
}

module.exports = WSAvcPlayer;