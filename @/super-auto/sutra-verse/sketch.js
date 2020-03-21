let imgs = [];
let angle = 0;
let radius = 500;
let fr = 12;
let i=0;
let cycle = 8;

function preload() {
  // Make an image from scratch
  //img = createImage(10, 10);
  // OR Load an image
  // img = loadImage("https://pbs.twimg.com/profile_images/378800000532546226/dbe5f0727b69487016ffd67a6689e75a_400x400.jpeg");
  for (var i=0; i<cycle; i++) {
    imgs[i] = loadImage("sutra-000-00"+i+".png"); 
  }
}

function setup() {
  createCanvas(displayWidth, displayHeight, WEBGL);
  // Draw the image to screen
  image(imgs[3], 0, 0);
  background(10);
  frameRate(fr);
  noStroke();
}

function draw() {
  if (i>=cycle) { i=0; }
	push();
  // translate((random(width)-width/2), (random(height)-height/2), -500);
  angle += PI / random(10,30);
  translate(cos(angle)*radius+random(-5,5), sin(angle)*radius+random(-5,5), -500);
  rotateX(HALF_PI * random(-.2,.2));
  rotateY(HALF_PI * random(-.2,.2));
  rotateZ(HALF_PI * random(-1,1));
  scale(random(0.05,0.3));
  fill(0,0,0,0);
  texture(imgs[i]);
  plane(imgs[i].width, imgs[i].height);
  pop();
  i++;
  fill(10, 10);
	ellipse(0, 0, radius*1.25);
	fill(10, 3);
	rect(-displayWidth/2, -displayHeight/2, displayWidth, displayHeight);
}