
uniform mat4 M_camera;
uniform sampler2D other_t;
uniform sampler2D low1_t;
uniform sampler2D high1_t;

in vec2 vert_pos;
out vec3 xyz;
out vec2 xy;

void main(){
    xy = vert_pos;
    vec4 other = texture(other_t, xy);
    vec4 low1 = texture(low1_t, xy);
    vec4 high1 = texture(high1_t, xy);
    float elevation = other.z * z_scale;
    float temp = interp_elev(elevation, other.t, low1.t, high1.t, 0.);
    float water_depth = temp > freezing_temp ? other.w * water_scale : min(other.w * snow_scale, other.w * water_scale + floating_ice_thickness);
    // float water_depth = other.w * water_scale;
    xyz = vec3(vert_pos, elevation + water_depth);
    gl_Position = M_camera * vec4(xyz, 1.);
}
