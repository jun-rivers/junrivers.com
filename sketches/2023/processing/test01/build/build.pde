void setup() {
	String name = "John";
	Number missionDuration = 30*60;
	Int enValue = 1200;

	size(640,640,P3D);
	H.init(this).background(#202020).use3D(true).autoClear(true);
	smooth();
}

void draw(){
	H.drawStage();

	// saveFrame("frames/#########.tif"); if (frameCount == 900) exit();
}