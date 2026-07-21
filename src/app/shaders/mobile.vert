precision highp float;

uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;

uniform float uRotationX;
uniform float uRotationY;
uniform float uRotationZ;

attribute vec3 aPosition;
attribute vec3 aNormal;

varying vec3 vNormal;
varying vec3 vPosition;

mat3 rotationX(float angle) {
    float s = sin(angle);
    float c = cos(angle);

    return mat3(
        1.0, 0.0, 0.0,
        0.0, c, -s,
        0.0, s, c
    );
}

mat3 rotationY(float angle) {
    float s = sin(angle);
    float c = cos(angle);

    return mat3(
        c, 0.0, s,
        0.0, 1.0, 0.0,
        -s, 0.0, c
    );
}

mat3 rotationZ(float angle) {
    float s = sin(angle);
    float c = cos(angle);

    return mat3(
        c, -s, 0.0,
        s, c, 0.0,
        0.0, 0.0, 1.0
    );
}

void main() {

    mat3 rotation =
        rotationZ(uRotationZ) *
        rotationY(uRotationY) *
        rotationX(uRotationX);

    vec3 rotatedPosition = rotation * aPosition;
    vec3 rotatedNormal = rotation * aNormal;

    vec4 worldPosition =
        uModelViewMatrix *
        vec4(rotatedPosition, 1.0);

    gl_Position =
        uProjectionMatrix *
        worldPosition;

    vPosition = worldPosition.xyz;

    vNormal =
        normalize(
            mat3(uModelViewMatrix) *
            rotatedNormal
        );
}