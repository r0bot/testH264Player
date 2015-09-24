var Class   = require('uclass');
var indexOf = require('nyks/buffer/indexOf');


var NALFeeder = new Class({
  
  initialize : function(separator, options, onflush) {
    if(!options)
      options = {};

    this.offset      = 0;
    this.bodyOffset  = 0;

    this.bufferSize  = options.bufferSize  || 1024 * 1024 * 50  ; //1Mb
    this.bufferFlush = options.bufferFlush || Math.floor(this.bufferSize * 0.1); //10% buffer size

    this.buffer      = new Uint8Array(this.bufferSize); 
    this.separator   = separator;
    this.onflush     = onflush;

  },

  feed : function(chunk) {

    if (this.offset + chunk.length > this.bufferSize - this.bufferFlush) {
        var minimalLength = this.bufferSize - this.bodyOffset + chunk.length;
        if(this.bufferSize < minimalLength) {
          //console.warn("Increasing buffer size to ", minimalLength);
          this.bufferSize = minimalLength;
        }

        var tmp = new Uint8Array(this.bufferSize);

        throw "looping";
        //this.buffer.copy(tmp, 0, this.bodyOffset);
        this.buffer = tmp;
        this.offset = this.offset - this.bodyOffset;
        this.bodyOffset = 0;
    }

    this.buffer.set(chunk, this.offset);

    var i, start, stop = this.offset + chunk.length;
    do {
      start = Math.max(this.bodyOffset ? this.bodyOffset : 0, this.offset - this.separator.length);
      i = indexOf(this.buffer, this.separator, start, stop);

      if (i == -1)
        break;

      //console.log("found buffer at", i, img);
      if(true) {
       // debugger;
        var img = this.buffer.subarray(Math.max(this.bodyOffset - this.separator.length, 0), i);
        this.onflush(img);
      }
      this.bodyOffset = i + this.separator.length;
    } while(true);

    this.offset += chunk.length;

  },


});


module.exports = NALFeeder;
