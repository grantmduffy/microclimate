
uniform mat4 M_camera;
uniform sampler2D other_t;

in vec2 vert_pos;
out vec3 xyz;
out vec2 xy;

void main(){
    xy = vert_pos;
    vec4 other = texture(other_t, xy);
    float elevation = other.z * z_scale;
    xyz = vec3(vert_pos, elevation);
    gl_Position = M_camera * vec4(xyz, 1.);
}