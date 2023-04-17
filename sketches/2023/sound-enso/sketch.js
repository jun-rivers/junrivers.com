var canvas;
var mic;

function setup() {
  canvas = createCanvas(windowWidth, windowHeight);
  canvas.position(0, 0);
  canvas.style('z-index','-1');
  mic = new p5.AudioIn();
  mic.start();
}

function windowResize() {
  // console.log('resized');
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  if (mouseIsPressed) {
    fill(0);
  } else {
    fill(255);
  }
  var vol = mic.getLevel();
  // console.log(vol);
  ellipse(mouseX, mouseY, vol*300, vol*300);
}

function touchStarted() {
  getAudioContext().resume();
}