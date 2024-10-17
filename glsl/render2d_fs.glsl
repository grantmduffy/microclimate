
uniform int view_mode;
uniform sampler2D atm0_t;
uniform sampler2D atm1_t;
uniform sampler2D water0_t;
uniform sampler2D water1_t;
uniform sampler2D ground_t;
uniform sampler2D light_t;
uniform float pen_size;
uniform vec2 mouse_pos;
uniform vec2 cursor_pos;
uniform int mouse_btns;
uniform vec2 sim_res;
uniform vec3 sun_dir;
uniform mat4 M_sun;
uniform vec2 camera_pos;

in vec2 xy;
in vec3 xyz;
out vec4 frag_color;

vec4 atm0;
vec4 atm1;
vec4 water0;
vec4 water1;
vec4 ground;
vec4 ground_n;
vec4 ground_s;
vec4 ground_e;
vec4 ground_w;
vec4 light;
float vel;
float pressure;
float humidity;
float elevation;
float temp;

void main(){
    switch (view_mode){
    case 0:  // low velocity
    case 1:  // all velocity
        atm0 = texture(atm0_t, xy);
        vel = length(atm0.xy);
        pressure = atm0.z - 1.0;
        frag_color = vec4(pressure, vel, -pressure, 1.);
        break;
    case 2:  // uplift
        frag_color = vec4(0., 0., 0., 1.);
        break;
    case 3:  // elevation
        ground = texture(ground_t, xy);
        elevation = ground.z;
        frag_color = vec4(0., elevation, 0., 1.);
        break;
    case 4:  // clouds
        break;
    case 5:  // realistic
        ground = texture(ground_t, xy);
        ground_n = texture(ground_t, xy + vec2(0., 1.) / sim_res);
        ground_s = texture(ground_t, xy + vec2(0., -1.) / sim_res);
        ground_e = texture(ground_t, xy + vec2(1., 0.) / sim_res);
        ground_w = texture(ground_t, xy + vec2(-1., 0.) / sim_res);
        vec4 sun_coord = M_sun * vec4(xyz, 1.);
        light = texture(light_t, sun_coord.xy / 2. + 0.5 + rand2d(sun_coord.xy) / render_res);
        vec3 norm = normalize(vec3(z_scale * vec2(ground_w.z - ground_e.z, ground_s.z - ground_n.z) * sim_res, 1.));
        float sunlight = sun_coord.z - light.a > 0.001 ? 0. : clamp(dot(norm, sun_dir), 0., 1.) * light.x;
        frag_color = (sun_color * sunlight + ambient_color * (1. - sunlight)) * get_ground_color(temp);
        break;
    case 6:  // temp
        ground = texture(ground_t, xy);
        frag_color = heatmap(temp, ground.t);
        break;
    case 7:  // low pressure
    case 8:  // high pressure
        atm0 = texture(atm0_t, xy);
        pressure = atm0.z - 1.0;
        frag_color = vec4(pressure, 0., -pressure, 1.);
        break;
    }
    if (abs(length(cursor_pos - xy) - pen_size) < 0.001){
        frag_color = vec4(1.);
    }
}
