let imgs = [];
let angle = 0;
let radius = 500;
let fr = 12;
let i=0;
let j=0;
let users = 3;
let characters = 4;
let sound;

function preload() {
  // Make an image from scratch
  //img = createImage(10, 10);
  // OR Load an image
  // img = loadImage("https://pbs.twimg.com/profile_images/378800000532546226/dbe5f0727b69487016ffd67a6689e75a_400x400.jpeg");
  soundFormats('mp3', 'ogg');
  sound = loadSound('singing-bowl-sound.mp3');
  var noMoreCharacter = false;
  var noMoreUser = false;
  for (var i=0; i<users; i++) {
    imgs[i]=[]
    for (var j=0; j<characters; j++) {
      imgs[i][j] = loadImage("sutra-"+String(i).padStart(3, '0')+"-"+String(j).padStart(3, '0')+".png", function(){
        console.log('img loaded.');
      }, function(){
        console.log('No More Character for user'+String(i).padStart(3, '0'));
        noMoreCharacter = true;
        if (j = 0) {
          console.log('No More Users');
          noMoreUser = true;
        }
      });
      if (noMoreCharacter) {break;}
    }
    if (noMoreUser) {break;}
  }
}

function setup() {
  createCanvas(displayWidth, displayHeight, WEBGL);
  // Draw the image to screen
  background(10);
  frameRate(fr);
  noStroke();
  sound.play();
}

function draw() {
  if (i>=users-1) { i=0; }
  if (j>=characters-1) { j=0; i++; }
	push();
  // translate((random(width)-width/2), (random(height)-height/2), -500);
  angle += PI / random(10,30);
  translate(cos(angle)*radius+random(-5,5), sin(angle)*radius+random(-5,5), -500);
  rotateX(HALF_PI * random(-.2,.2));
  rotateY(HALF_PI * random(-.2,.2));
  rotateZ(HALF_PI * random(-1,1));
  scale(random(0.05,0.3));
  fill(0,0,0,0);
  // console.log('i'+i+' : j'+j);
  texture(imgs[i][j]);
  plane(imgs[i][j].width, imgs[i][j].height);
  pop();
  j++;
  fill(10, 10);
	ellipse(0, 0, radius*1.25);
	fill(10, 3);
	rect(-displayWidth/2, -displayHeight/2, displayWidth, displayHeight);
}