
// TODO: update textures
uniform sampler2D low0_t;
uniform sampler2D high0_t;

in vec3 vert_pos;
out vec2 xy;

void main(){
    vec2 pos = vert_pos.xy;
    xy = pos * 0.5 + 0.5;
    float a = vert_pos.z;
    vec2 uv = texture(low0_t, xy).xy;
    gl_Position = vec4(pos + a * uv * 0.1, 0., 1.);
    // gl_Position = vec4(pos, 0., 1.);
}
