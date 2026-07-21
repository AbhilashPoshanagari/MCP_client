precision highp float;

uniform vec3 uLightPosition;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {

    vec3 normal = normalize(vNormal);

    vec3 lightDirection =
        normalize(uLightPosition - vPosition);

    float diffuse =
        max(dot(normal, lightDirection), 0.0);

    float ambient = 0.25;

    float lighting =
        ambient + diffuse * 0.75;

    vec3 baseColor =
        vec3(0.035, 0.045, 0.065);

    vec3 lightColor =
        vec3(0.25, 0.55, 1.0);

    vec3 finalColor =
        baseColor * lighting;

    finalColor +=
        lightColor * diffuse * 0.15;

    gl_FragColor =
        vec4(finalColor, 1.0);
}