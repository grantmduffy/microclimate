
uniform vec2 sim_res;
uniform sampler2D ground_t;
uniform sampler2D water0_t;
uniform vec3 sun_dir;
uniform vec3 camera_pos;
uniform sampler2D light_t;
uniform mat4 M_sun;

in vec3 xyz;
in vec2 xy;
out vec4 frag_color;

void main(){
    vec4 water    = texture(water0_t, xy);
    vec4 water_n  = texture(water0_t, xy + vec2(0., 1.) / sim_res);
    vec4 water_s  = texture(water0_t, xy + vec2(0., -1.) / sim_res);
    vec4 water_e  = texture(water0_t, xy + vec2(1., 0.) / sim_res);
    vec4 water_w  = texture(water0_t, xy + vec2(-1., 0.) / sim_res);
    vec4 ground   = texture(ground_t, xy);
    vec4 ground_n = texture(ground_t, xy + vec2(0., 1.) / sim_res);
    vec4 ground_s = texture(ground_t, xy + vec2(0., -1.) / sim_res);
    vec4 ground_e = texture(ground_t, xy + vec2(1., 0.) / sim_res);
    vec4 ground_w = texture(ground_t, xy + vec2(-1., 0.) / sim_res);
    vec4 atm1 = texture(atm1_t, xy);
    vec4 sun_coord = M_sun * vec4(xyz, 1.);
    vec4 light = texture(light_t, sun_coord.xy / 2. + 0.5 + rand2d(sun_coord.xy) / render_res);
    vec3 norm = normalize(vec3(z_scale * vec2(
        ground_w.z + water_w.z - ground_e.z - water_e.z, 
        ground_s.z + water_s.z - ground_n.z - water_n.z
    ) * sim_res, 1.));
    vec3 camera_vec = normalize(camera_pos - xyz);
    float cos_angle = dot(camera_vec, norm);
    float sunlight = sun_coord.z - light.a > 0.001 ? 0. : clamp(dot(norm, sun_dir), 0., 1.) * light.x;
    float temp = ground.t;

    frag_color = get_water_color(temp, sunlight, cos_angle, ground.w);
}
