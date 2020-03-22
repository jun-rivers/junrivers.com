var weightFactor = 3;
var speed, weight, pweight;
// var sutra = ['hello', 'people', 'of', 'the', 'earth'];
var user = 2;
var index = 0;
var splash = true;
let sutra;
let pg;
let button;

function setup() {
  createCanvas(windowWidth, windowHeight);
  let url = './sutras.json';
  var sutras = loadJSON(url, function(data) {
    sutra = data.sutras[0];
    console.log(sutra);
  });
  background(10);
  // fullscreen(true);
  pg = createGraphics(windowWidth, windowHeight);
  pg.stroke(245);
  pg.smooth();

  button = createButton('→');
  button.class('next');
  button.mousePressed(submitWriting);
  button.mousePressed(submitWriting);
}

// void setup(){
  
//  float diameter = 150;
//  pg.noStroke();
//  pg.fill(0,128);
//  pg.ellipse(pg.width/2,pg.height/2,diameter,diameter);
//  pg.fill(255,196);
//  pg.ellipse(pg.width/2,pg.height/2,diameter*0.9,diameter*0.9);
//  pg.endDraw();
//  pg.save("transparent.png");
// }


// function draw() {
//   // Draw only when mouse is pressed
//   if (mouseIsPressed === true) {
//     angle += 5;
//     var val = cos(radians(angle)) * 12.0;
//     // for (var a = 0; a < 360; a += 75) {
//     //   var xoff = cos(radians(a)) * val;
//     //   var yoff = sin(radians(a)) * val;
//     //   // ellipse(mouseX + xoff, mouseY + yoff, val, val);
//     // }
//     ellipse(mouseX, mouseY, val, val);
//     px = mouseX;
//     py = mouseY;
//     // fill(255);
//     // ellipse(mouseX, mouseY, 2, 2);
//   }
// }

function draw() { 
  background(10);
  image(pg, 0, 0);
  fill(245, 50);
  textAlign(CENTER);
  textSize(40);
  if (sutra) {
    text(sutra.content[index].cnCharacter, 80, 100);
    if (index > sutra.content.length - 1){
      index = 0;
    }
  }
}

// function touchStarted() {  
//   pg.fill(245);
//   // pg.ellipse(mouseX, mouseY, 50, 50);
//   if (random(1) > .33) { //Splash only happens two thirds of the time.
//     var splashCount = random(5);
//     for (var i=0; i<splashCount; i++) {
//       var size = random(10);
//       pg.ellipse(mouseX+random(-100, 100), mouseY+random(-100, 100), size, size)
//     }
//   }
//   return false;
// }

function touchMoved() {
  speed = abs(mouseX-pmouseX) + abs(mouseY-pmouseY);
  weight = weightFactor*abs(12-Math.sqrt(speed))
  if (splash) {
    splash = false;
    pg.fill(245);
    if (random(1) > .66) { //Splash only happens two thirds of the time.
      var splashCount = random(5);
      for (var i=0; i<splashCount; i++) {
        var size = random(10);
        pg.ellipse(mouseX+random(-100, 100), mouseY+random(-100, 100), size, size)
      }
    }
  }
  // pg.startDraw();
  pg.fill(10);
  pg.ellipse(mouseX, mouseY, weight*1.2, weight*1.2);
  pg.strokeWeight((weight+pweight)/2);
  pg.line(mouseX, mouseY, pmouseX, pmouseY);
  pg.strokeWeight(0);
  // pg.ellipse(mouseX, mouseY, weight*.5, weight*.5);
  pweight = weight;
  // pg.endDraw();
  return false;
}

function touchEnded() {
  splash = true;
}

function keyPressed() {
  if (key == ' ') {
    fill(240);
    rect(0, 0, windowWidth, windowHeight);
    fill(0, 200);
  };
  if (key == 's') {
    submitWriting();
  }
}

function doubleClicked() {
  pg.clear();
}

function submitWriting() {
  pg.save("sutra-"+String(user).padStart(3, '0')+"-"+String(index).padStart(3, '0')+".png");
  // TODO: upload to server
  index++;
  pg.clear();
}