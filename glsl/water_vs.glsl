
uniform mat4 M_camera;
uniform sampler2D ground_t;
uniform sampler2D water_t;
uniform sampler2D high1_t;

in vec2 vert_pos;
out vec3 xyz;
out vec2 xy;

void main(){
    xy = vert_pos;
    vec4 ground = texture(ground_t, xy);
    vec4 water = texture(water_t, xy);
    float elevation = ground.z * z_scale;
    float water_depth = water.z * water_scale;
    xyz = vec3(vert_pos, elevation + water_depth);
    gl_Position = M_camera * vec4(xyz, 1.);
}
