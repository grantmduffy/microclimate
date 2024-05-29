
uniform int view_mode;
uniform sampler2D low0_t;
uniform sampler2D low1_t;
uniform sampler2D high0_t;
uniform sampler2D high1_t;
uniform sampler2D mid_t;
uniform sampler2D other_t;
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

vec4 low0;
vec4 low1;
vec4 high0;
vec4 high1;
vec4 mid;
vec4 other;
vec4 other_n;
vec4 other_s;
vec4 other_e;
vec4 other_w;
vec4 light;
float vel_low;
float vel_high;
float pressure;
float h_low;
float h_high;
float uplift;
float elevation;
float temp;

void main(){
    switch (view_mode){
    case 0:  // low velocity
        low0 = texture(low0_t, xy);
        low1 = texture(low1_t, xy);
        vel_low = length(low0.xy);
        pressure = low1.p * K_pressure * 10.;
        h_low = low1.a;
        frag_color = vec4(pressure, vel_low, h_low, 1.);        
        break;
    case 1:  // all velocity
        low0 = texture(low0_t, xy);
        low1 = texture(low1_t, xy);
        high0 = texture(high0_t, xy);
        high1 = texture(high1_t, xy);
        mid = texture(mid_t, xy);
        vel_low = length(low0.xy);
        vel_high = length(high0.xy);
        pressure = 0.5 * (low1.p + high1.p) * 10.;
        frag_color = vec4(pressure, vel_low, vel_high, 1.);
        break;
    case 2:  // uplift
        low1 = texture(low1_t, xy);
        high1 = texture(high1_t, xy);
        mid = texture(mid_t, xy);
        pressure = 0.5 * (low1.p + high1.p) * 10. * K_pressure;
        uplift = 100. * mid.w;
        frag_color = vec4(uplift, pressure, -uplift, 1.);
        break;
    case 3:  // elevation
        low0 = texture(low0_t, xy);
        high0 = texture(high0_t, xy);
        mid = texture(mid_t, xy);
        other = texture(other_t, xy);
        uplift = 100. * mid.w;
        elevation = other.z;
        frag_color = vec4(uplift, elevation, -uplift, 1.);
        break;
    case 4:  // clouds
        other = texture(other_t, xy);
        frag_color = float(mod(other.w, 0.25) > 0.01) * vec4(0., other.w * 0.5, other.w, 1.);
        break;
    case 5:  // realistic
        other = texture(other_t, xy);
        other_n = texture(other_t, xy + vec2(0., 1.) / sim_res);
        other_s = texture(other_t, xy + vec2(0., -1.) / sim_res);
        other_e = texture(other_t, xy + vec2(1., 0.) / sim_res);
        other_w = texture(other_t, xy + vec2(-1., 0.) / sim_res);
        low1 = texture(low1_t, xy);
        high1 = texture(high1_t, xy);
        vec4 sun_coord = M_sun * vec4(xyz, 1.);
        light = texture(light_t, sun_coord.xy / 2. + 0.5 + rand2d(sun_coord.xy) / render_res);
        vec3 norm = normalize(vec3(z_scale * vec2(other_w.z - other_e.z, other_s.z - other_n.z) * sim_res, 1.));
        float sunlight = sun_coord.z - light.a > 0.001 ? 0. : clamp(dot(norm, sun_dir), 0., 1.) * light.x;
        temp = interp_elev(z_scale * other.z, other.t, low1.t, high1.t, 0.);
        frag_color = (sun_color * sunlight + ambient_color * (1. - sunlight)) * get_ground_color(temp);
        // frag_color = vec4(vec3(float(temp < freezing_temp)), 1.);
        break;
    case 6:  // temp
        other = texture(other_t, xy);
        low1 = texture(low1_t, xy);
        high1 = texture(high1_t, xy);
        temp = interp_elev(z_scale * other.z, other.t, low1.t, high1.t, 0.);
        frag_color = heatmap(temp);
        break;
    }
    if (abs(length(cursor_pos - xy) - pen_size) < 0.001){
        frag_color = vec4(1.);
    }
}
