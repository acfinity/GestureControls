import * as THREE from "../libs/three.module.js"

function axisGeometry(target, color) {
    let geometry = new THREE.BufferGeometry();
    geometry.addAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0].concat(target), 3));
    let rgb = new THREE.Color(color).toArray();
    geometry.addAttribute('color', new THREE.Float32BufferAttribute(rgb.concat(rgb), 3));
    return geometry;
}

function addAxises(scene, {
    xAxis = true,
    yAxis = true,
    zAxis = true,
    axisLen = 500,
    xAxisColor = 0xff0000,
    yAxisColor = 0x00ff00,
    zAxisColor = 0x0000ff,
} = {}) {
    let material = new THREE.LineBasicMaterial({ color: 0xffffff, vertexColors: THREE.VertexColors });

    xAxis && scene.add(new THREE.Line(axisGeometry([axisLen, 0, 0], xAxisColor), material));
    yAxis && scene.add(new THREE.Line(axisGeometry([0, axisLen, 0], yAxisColor), material));
    zAxis && scene.add(new THREE.Line(axisGeometry([0, 0, axisLen], zAxisColor), material));
}

function addGround(scene, { size = 2000, divisions = 40 } = {}) {
    var helper = new THREE.GridHelper(size, divisions, 0xffffff, 0x888888);
    scene.add(helper);
}

function addParticles(scene, { spread = 5000 } = {}) {
    var geometry = new THREE.BufferGeometry();
    var vertices = [];

    for (var i = 0; i < 10000; i++) {

        vertices.push(THREE.Math.randFloatSpread(spread)); // x
        vertices.push(THREE.Math.randFloatSpread(spread)); // y
        vertices.push(THREE.Math.randFloatSpread(spread)); // z

    }
    geometry.addAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    var particles = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x888888 }));
    scene.add(particles);
}

export { addAxises, addGround, addParticles };