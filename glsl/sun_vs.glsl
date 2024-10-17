
uniform mat4 M_sun;
uniform sampler2D ground_t;

in vec2 vert_pos;
out vec4 xyz;
out vec4 sun_coord;

void main(){
    float elevation = texture(ground_t, vert_pos).z * z_scale;
    xyz = vec4(vert_pos, elevation, 1.);
    sun_coord = M_sun * xyz;
    gl_Position = sun_coord;
}
