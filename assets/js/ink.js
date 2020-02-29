// Fragment shader for protoplanet's position
var computeShaderPosition = `
	#define delta ( 1.0 / 60.0 )
	void main() {
		vec2 uv = gl_FragCoord.xy / resolution.xy;
		vec4 tmpPos = texture2D( texturePosition, uv );
		vec3 pos = tmpPos.xyz;
		vec4 tmpVel = texture2D( textureVelocity, uv );
		vec3 vel = tmpVel.xyz;
		float mass = tmpVel.w;
		if ( mass == 0.0 ) {
			vel = vec3( 0.0 );
		}
		// Dynamics
		pos += vel * delta;
		gl_FragColor = vec4( pos, 1.0 );
	}
`;

// Fragment shader for protoplanet's velocity
var computeShaderVelocity = `
	// For PI declaration:
	#include <common>
	#define delta ( 1.0 / 60.0 )
	uniform float gravityConstant;
	uniform float density;
	const float width = resolution.x;
	const float height = resolution.y;
	float radiusFromMass( float mass ) {
		// Calculate radius of a sphere from mass and density
		return pow( ( 3.0 / ( 4.0 * PI ) ) * mass / density, 1.0 / 3.0 );
	}
	void main()	{
		vec2 uv = gl_FragCoord.xy / resolution.xy;
		float idParticle = uv.y * resolution.x + uv.x;
		vec4 tmpPos = texture2D( texturePosition, uv );
		vec3 pos = tmpPos.xyz;
		vec4 tmpVel = texture2D( textureVelocity, uv );
		vec3 vel = tmpVel.xyz;
		float mass = tmpVel.w;
		if ( mass > 0.0 ) {
			float radius = radiusFromMass( mass );
			vec3 acceleration = vec3( 0.0 );
			// Gravity interaction
			for ( float y = 0.0; y < height; y++ ) {
				for ( float x = 0.0; x < width; x++ ) {
					vec2 secondParticleCoords = vec2( x + 0.5, y + 0.5 ) / resolution.xy;
					vec3 pos2 = texture2D( texturePosition, secondParticleCoords ).xyz;
					vec4 velTemp2 = texture2D( textureVelocity, secondParticleCoords );
					vec3 vel2 = velTemp2.xyz;
					float mass2 = velTemp2.w;
					float idParticle2 = secondParticleCoords.y * resolution.x + secondParticleCoords.x;
					if ( idParticle == idParticle2 ) {
						continue;
					}
					if ( mass2 == 0.0 ) {
						continue;
					}
					vec3 dPos = pos2 - pos;
					float distance = length( dPos );
					float radius2 = radiusFromMass( mass2 );
					if ( distance == 0.0 ) {
						continue;
					}
					// Checks collision
					if ( distance < radius + radius2 ) {
						if ( idParticle < idParticle2 ) {
							// This particle is aggregated by the other
							vel = ( vel * mass + vel2 * mass2 ) / ( mass + mass2 );
							mass += mass2;
							radius = radiusFromMass( mass );
						}
						else {
							// This particle dies
							mass = 0.0;
							radius = 0.0;
							vel = vec3( 0.0 );
							break;
						}
					}
					float distanceSq = distance * distance;
					float gravityField = gravityConstant * mass2 / distanceSq;
					gravityField = min( gravityField, 1000.0 );
					acceleration += gravityField * normalize( dPos );
				}
				if ( mass == 0.0 ) {
					break;
				}
			}
			// Dynamics
			vel += delta * acceleration;
		}
		gl_FragColor = vec4( vel, mass );
	}
`;

// Particles vertex shader
var particleVertexShader = `
	// For PI declaration:
	#include <common>
	uniform sampler2D texturePosition;
	uniform sampler2D textureVelocity;
	uniform float cameraConstant;
	uniform float density;
	varying vec4 vColor;
	float radiusFromMass( float mass ) {
		// Calculate radius of a sphere from mass and density
		return pow( ( 3.0 / ( 4.0 * PI ) ) * mass / density, 1.0 / 3.0 );
	}
	void main() {
		vec4 posTemp = texture2D( texturePosition, uv );
		vec3 pos = posTemp.xyz;
		vec4 velTemp = texture2D( textureVelocity, uv );
		vec3 vel = velTemp.xyz;
		float mass = velTemp.w;
		vColor = vec4( 0.1, 0.1, 0.1, 1.0 );
		vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0 );
		// Calculate radius of a sphere from mass and density
		//float radius = pow( ( 3.0 / ( 4.0 * PI ) ) * mass / density, 1.0 / 3.0 );
		float radius = radiusFromMass( mass );
		// Apparent size in pixels
		if ( mass == 0.0 ) {
			gl_PointSize = 0.0;
		}
		else {
			gl_PointSize = radius * cameraConstant / ( - mvPosition.z );
		}
		gl_Position = projectionMatrix * mvPosition;
	}
`;

// Particles fragment shader
var particleFragmentShader = `
	varying vec4 vColor;
	void main() {
		float f = length( gl_PointCoord - vec2( 0.5, 0.5 ) );
		if ( f > 0.5 ) {
			discard;
		}
		gl_FragColor = vColor;
	}
`;

if ( ! Detector.webgl ) Detector.addGetWebGLMessage();
var isIE = /Trident/i.test( navigator.userAgent );
var isEdge = /Edge/i.test( navigator.userAgent );
var hash = document.location.hash.substr( 1 );
if ( hash ) hash = parseInt( hash, 0 );
// Texture width for simulation (each texel is a debris particle)
var WIDTH = hash || ( ( isIE || isEdge ) ? 4 : 64 );
var container, stats;
var camera, scene, renderer, geometry, controls;
var PARTICLES = WIDTH * WIDTH;
// document.getElementById( 'protoplanets' ).innerText = PARTICLES;
function change( n ) {
	location.hash = n;
	location.reload();
	return false;
}

window.mobilecheck = function() {
	var check = false;
	(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
	return check;
};
// var options = '';
// for ( var i = 1; i < 8; i++ ) {
// 	var j = Math.pow( 2, i );
// 	options += '<a href="#" onclick="return change(' + j + ')">' + ( j * j ) + '</a> ';
// }
// document.getElementById( 'options' ).innerHTML = options;
// if ( isEdge || isIE ) {
// 	document.getElementById( 'warning' ).innerText = 'particle counts greater than 16 may not render with ' + ( isEdge ? 'Edge' : 'IE11' );
// }
var gpuCompute;
var velocityVariable;
var positionVariable;
var positionUniforms;
var velocityUniforms;
var particleUniforms;
var effectController;
init();
animate();
function init() {
	container = document.getElementById( 'art' );

	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 5, 15000 );
	camera.position.y = 0;
	camera.position.z = 400;
	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xffffff );
	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );
	controls = new THREE.OrbitControls( camera, renderer.domElement );
	controls.enableKeys = false;
	controls.enablePan = false;
	controls.minDistance = 10.0;
	controls.maxDistance = 400.0;
	controls.addEventListener( 'change', render );
	effectController = {
		// Can be changed dynamically
		gravityConstant: 5.0,
		density: 6.0,
		// Must restart simulation
		radius: 660,
		height: 90,
		exponent: 0.1,
		maxMass: 15.0,
		velocity: 1,
		velocityExponent: 0.1,
		randVelocity: 0.05
	};
	initComputeRenderer();
	// stats = new Stats();
	// container.appendChild( stats.dom );
	window.addEventListener( 'resize', onWindowResize, false );
	if (!window.mobilecheck()) {
		window.addEventListener( 'scroll', onScroll, false );
	}
	// initGUI();
	initProtoplanets();
	dynamicValuesChanger();
}
function initComputeRenderer() {
	gpuCompute = new GPUComputationRenderer( WIDTH, WIDTH, renderer );
	var dtPosition = gpuCompute.createTexture();
	var dtVelocity = gpuCompute.createTexture();
	fillTextures( dtPosition, dtVelocity );
	velocityVariable = gpuCompute.addVariable( "textureVelocity", computeShaderVelocity, dtVelocity );
	positionVariable = gpuCompute.addVariable( "texturePosition", computeShaderPosition, dtPosition );
	gpuCompute.setVariableDependencies( velocityVariable, [ positionVariable, velocityVariable ] );
	gpuCompute.setVariableDependencies( positionVariable, [ positionVariable, velocityVariable ] );
	positionUniforms = positionVariable.material.uniforms;
	velocityUniforms = velocityVariable.material.uniforms;
	velocityUniforms.gravityConstant = { value: 0.0 };
	velocityUniforms.density = { value: 0.0 };
	var error = gpuCompute.init();
	if ( error !== null ) {
		console.error( error );
	}
}
function restartSimulation() {
	var dtPosition = gpuCompute.createTexture();
	var dtVelocity = gpuCompute.createTexture();
	fillTextures( dtPosition, dtVelocity );
	gpuCompute.renderTexture( dtPosition, positionVariable.renderTargets[ 0 ] );
	gpuCompute.renderTexture( dtPosition, positionVariable.renderTargets[ 1 ] );
	gpuCompute.renderTexture( dtVelocity, velocityVariable.renderTargets[ 0 ] );
	gpuCompute.renderTexture( dtVelocity, velocityVariable.renderTargets[ 1 ] );
}
function initProtoplanets() {
	geometry = new THREE.BufferGeometry();
	var positions = new Float32Array( PARTICLES * 3 );
	var p = 0;
	for ( var i = 0; i < PARTICLES; i++ ) {
		positions[ p++ ] = ( Math.random() * 2 - 1 ) * effectController.radius;
		positions[ p++ ] = 0; //( Math.random() * 2 - 1 ) * effectController.radius;
		positions[ p++ ] = ( Math.random() * 2 - 1 ) * effectController.radius;
	}
	var uvs = new Float32Array( PARTICLES * 2 );
	p = 0;
	for ( var j = 0; j < WIDTH; j++ ) {
		for ( var i = 0; i < WIDTH; i++ ) {
			uvs[ p++ ] = i / ( WIDTH - 1 );
			uvs[ p++ ] = j / ( WIDTH - 1 );
		}
	}
	geometry.addAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
	geometry.addAttribute( 'uv', new THREE.BufferAttribute( uvs, 2 ) );
	particleUniforms = {
		texturePosition: { value: null },
		textureVelocity: { value: null },
		cameraConstant: { value: getCameraConstant( camera ) },
		density: { value: 0.0 }
	};
	// ShaderMaterial
	var material = new THREE.ShaderMaterial( {
		uniforms:       particleUniforms,
		vertexShader:   particleVertexShader,
		fragmentShader: particleFragmentShader
	} );
	material.extensions.drawBuffers = true;
	var particles = new THREE.Points( geometry, material );
	particles.matrixAutoUpdate = false;
	particles.updateMatrix();
	scene.add( particles );
}
function fillTextures( texturePosition, textureVelocity ) {
	var posArray = texturePosition.image.data;
	var velArray = textureVelocity.image.data;
	var radius = effectController.radius;
	var height = effectController.height;
	var exponent = effectController.exponent;
	var maxMass = effectController.maxMass * 1024 / PARTICLES;
	var maxVel = effectController.velocity;
	var velExponent = effectController.velocityExponent;
	var randVel = effectController.randVelocity;
	for ( var k = 0, kl = posArray.length; k < kl; k += 4 ) {
		// Position
		var x, y, z, rr;
		do {
			x = ( Math.random() * 2 - 1 );
			z = ( Math.random() * 2 - 1 );
			rr = x * x + z * z;
		} while ( rr > 1 );
		rr = Math.sqrt( rr );
		var rExp = radius * Math.pow( rr, exponent );
		// Velocity
		var vel = maxVel * Math.pow( rr, velExponent );
		var vx = vel * z + ( Math.random() * 2 - 1 ) * randVel;
		var vy = ( Math.random() * 2 - 1 ) * randVel * 0.05;
		var vz = - vel * x + ( Math.random() * 2 - 1 ) * randVel;
		x *= rExp;
		z *= rExp;
		y = ( Math.random() * 2 - 1 ) * height;
		var mass = Math.random() * maxMass + 1;
		// Fill in texture values
		posArray[ k + 0 ] = x;
		posArray[ k + 1 ] = y;
		posArray[ k + 2 ] = z;
		posArray[ k + 3 ] = 1;
		velArray[ k + 0 ] = vx;
		velArray[ k + 1 ] = vy;
		velArray[ k + 2 ] = vz;
		velArray[ k + 3 ] = mass;
	}
}
function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize( window.innerWidth, window.innerHeight );
	particleUniforms.cameraConstant.value = getCameraConstant( camera );
}
function getScrollPercent() {
    var h = document.documentElement, 
        b = document.body,
        st = 'scrollTop',
        sh = 'scrollHeight';
    return (h[st]||b[st]) / ((h[sh]||b[sh]) - h.clientHeight) * 100;
}
function onScroll() {
	var position = +getScrollPercent()
	// console.log('scroll: ' + position );
	camera.position.set( 0, -position, 400.0 );
	controls.update();
}
function dynamicValuesChanger() {
	velocityUniforms.gravityConstant.value = effectController.gravityConstant;
	velocityUniforms.density.value = effectController.density;
	particleUniforms.density.value = effectController.density;
}
function getCameraConstant( camera ) {
	return window.innerHeight / ( Math.tan( THREE.Math.DEG2RAD * 0.5 * camera.fov ) / camera.zoom );
}
function animate() {
	render();
	requestAnimationFrame( animate );
}
function render() {
	gpuCompute.compute();
	particleUniforms.texturePosition.value = gpuCompute.getCurrentRenderTarget( positionVariable ).texture;
	particleUniforms.textureVelocity.value = gpuCompute.getCurrentRenderTarget( velocityVariable ).texture;
	renderer.render( scene, camera );
}