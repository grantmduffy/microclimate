
uniform vec2 sim_res;
uniform sampler2D other_t;
uniform vec3 sun_dir;
uniform vec3 camera_pos;
uniform sampler2D light_t;
uniform mat4 M_sun;
uniform sampler2D low1_t;
uniform sampler2D high1_t;

in vec3 xyz;
in vec2 xy;
out vec4 frag_color;

void main(){
    vec4 other = texture(other_t, xy);
    vec4 other_n = texture(other_t, xy + vec2(0., 1.) / sim_res);
    vec4 other_s = texture(other_t, xy + vec2(0., -1.) / sim_res);
    vec4 other_e = texture(other_t, xy + vec2(1., 0.) / sim_res);
    vec4 other_w = texture(other_t, xy + vec2(-1., 0.) / sim_res);
    vec4 low1 = texture(low1_t, xy);
    vec4 high1 = texture(high1_t, xy);
    vec4 sun_coord = M_sun * vec4(xyz, 1.);
    vec4 light = texture(light_t, sun_coord.xy / 2. + 0.5 + rand2d(sun_coord.xy) / render_res);
    vec3 norm = normalize(vec3(z_scale * vec2(other_w.z - other_e.z, other_s.z - other_n.z) * sim_res, 1.));
    vec3 camera_vec = normalize(camera_pos - xyz);
    float cos_angle = dot(camera_vec, norm);
    float sunlight = sun_coord.z - light.a > 0.001 ? 0. : clamp(dot(norm, sun_dir), 0., 1.) * light.x;
    float temp = interp_elev(xyz.z, other.t, low1.t, high1.t, 0.);
    // frag_color = get_water_color(temp) * mix(ambient_color, sun_color, sunlight);
    // frag_color.a = (1. - cos_angle) * (1. - water_transparency) + water_transparency;
    // frag_color.a *= clamp(other.w * shoreline_sharpness, 0., 1.);

    frag_color = get_water_color(temp, sunlight, cos_angle, other.w);
}
