

uniform vec2 mouse_pos;
uniform vec2 cursor_pos;
uniform int mouse_btns;
uniform int keys;
uniform vec2 sim_res;
uniform float pen_size;
uniform float pen_strength;
uniform int pen_type;
uniform vec2 pen_vel;
uniform mat4 M_sun;

uniform sampler2D low0_t;
uniform sampler2D low1_t;
uniform sampler2D high0_t;
uniform sampler2D high1_t;
uniform sampler2D mid_t;
uniform sampler2D other_t;
uniform sampler2D light_t;

in vec2 xy;
layout(location = 0) out vec4 low0_out;
layout(location = 1) out vec4 low1_out;
layout(location = 2) out vec4 high0_out;
layout(location = 3) out vec4 high1_out;
layout(location = 4) out vec4 mid_out;
layout(location = 5) out vec4 other_out;

// TODO: rename all variables to correct
void main(){

    // backward convection
    vec2 uv_low  = delta_t * texture(low0_t, xy).xy;
    vec2 uv_high = delta_t * texture(high0_t, xy).xy;
    vec2 uv_mid  = delta_t * (uv_low + uv_high) / 2.;
    vec2 northwest = xy + vec2(-1.,  1.) / sim_res;
    vec2 west      = xy + vec2(-1.,  0.) / sim_res;
    vec2 southwest = xy + vec2(-1., -1.) / sim_res;
    vec2 north     = xy + vec2( 0.,  1.) / sim_res;
    vec2 south     = xy + vec2( 0., -1.) / sim_res;
    vec2 northeast = xy + vec2( 1.,  1.) / sim_res;
    vec2 east      = xy + vec2( 1.,  0.) / sim_res;
    vec2 southeast = xy + vec2( 1., -1.) / sim_res;
    vec4 low0     = texture(low0_t,  xy        - uv_low);
    vec4 low0_nw  = texture(low0_t,  northwest - uv_low);
    vec4 low0_n   = texture(low0_t,  north     - uv_low);
    vec4 low0_ne  = texture(low0_t,  northeast - uv_low);
    vec4 low0_sw  = texture(low0_t,  southwest - uv_low);
    vec4 low0_s   = texture(low0_t,  south     - uv_low);
    vec4 low0_se  = texture(low0_t,  southeast - uv_low);
    vec4 low0_e   = texture(low0_t,  east      - uv_low);
    vec4 low0_w   = texture(low0_t,  west      - uv_low);
    vec4 high0    = texture(high0_t, xy        - uv_high);
    vec4 high0_nw = texture(high0_t, northwest - uv_high);
    vec4 high0_n  = texture(high0_t, north     - uv_high);
    vec4 high0_ne = texture(high0_t, northeast - uv_high);
    vec4 high0_sw = texture(high0_t, southwest - uv_high);
    vec4 high0_s  = texture(high0_t, south     - uv_high);
    vec4 high0_se = texture(high0_t, southeast - uv_high);
    vec4 high0_e  = texture(high0_t, east      - uv_high);
    vec4 high0_w  = texture(high0_t, west      - uv_high);
    vec4 low1     = texture(low1_t,  xy        - uv_low);
    vec4 low1_n   = texture(low1_t,  north     - uv_low);
    vec4 low1_s   = texture(low1_t,  south     - uv_low);
    vec4 low1_e   = texture(low1_t,  east      - uv_low);
    vec4 low1_w   = texture(low1_t,  west      - uv_low);
    vec4 high1    = texture(high1_t, xy        - uv_high);
    vec4 high1_n  = texture(high1_t, north     - uv_high);
    vec4 high1_s  = texture(high1_t, south     - uv_high);
    vec4 high1_e  = texture(high1_t, east      - uv_high);
    vec4 high1_w  = texture(high1_t, west      - uv_high);
    vec4 mid      = texture(mid_t,   xy        - uv_mid);
    vec4 mid_nw   = texture(mid_t,   northwest - uv_mid);
    vec4 mid_n    = texture(mid_t,   north     - uv_mid);
    vec4 mid_ne   = texture(mid_t,   northeast - uv_mid);
    vec4 mid_w    = texture(mid_t,   west      - uv_mid);
    vec4 mid_e    = texture(mid_t,   east      - uv_mid);
    vec4 mid_sw   = texture(mid_t,   southwest - uv_mid);
    vec4 mid_s    = texture(mid_t,   south     - uv_mid);
    vec4 mid_se   = texture(mid_t,   southeast - uv_mid);
    vec4 other    = texture(other_t, xy                );
    vec4 other_nw = texture(other_t, northwest         );
    vec4 other_n  = texture(other_t, north             );
    vec4 other_ne = texture(other_t, northeast         );
    vec4 other_sw = texture(other_t, southwest         );
    vec4 other_s  = texture(other_t, south             );
    vec4 other_se = texture(other_t, southeast         );
    vec4 other_e  = texture(other_t, east              );
    vec4 other_w  = texture(other_t, west              );

    // convection, low and high include uplift, mid is pure 2D
    low0_out  = low0  * clamp(1. + mid.w, 0., 1.) 
              + high0 * clamp(    -mid.w, 0., 1.);
    low1_out  = low1  * clamp(1. + mid.w, 0., 1.) 
              + high1 * clamp(    -mid.w, 0., 1.);
    high0_out = high0 * clamp(1. - mid.w, 0., 1.)
              + low0  * clamp(     mid.w, 0., 1.);
    high1_out = high1 * clamp(1. - mid.w, 0., 1.)
              + low1  * clamp(     mid.w, 0., 1.);
    mid_out = mid;
    other_out = other;

    // calculate divergence
    float dX = 1. / sim_res.x;
    float dY = 1. / sim_res.y;
    float uplift_flux = 0.0625 * (
               mid_nw.w + 2. * mid_n.w +      mid_ne.w
        + 2. * mid_w.w  + 4. * mid.w   + 2. * mid_e.w
        +      mid_sw.w + 2. * mid_s.w +      mid_se.w
    );
    float convergence_low = 0.125 * (
        dY * (
              (2. * low_elev - other_nw.z - other_nw.w - other_w.z - other_w.w) * (low0_nw.x + low0_w.x)
            + (2. * low_elev - other_w.z - other_w.w - other_sw.z - other_sw.w) * (low0_w.x + low0_sw.x)
            - (2. * low_elev - other_ne.z - other_ne.w - other_e.z - other_e.w) * (low0_ne.x + low0_e.x)
            - (2. * low_elev - other_e.z - other_e.w - other_se.z - other_se.w) * (low0_e.x + low0_se.x)
        ) + dX * (
              (2. * low_elev - other_sw.z - other_sw.w - other_s.z - other_s.w) * (low0_sw.y + low0_s.y)
            + (2. * low_elev - other_s.z - other_s.w - other_se.z - other_se.w) * (low0_s.y + low0_se.y)
            - (2. * low_elev - other_nw.z - other_nw.w - other_n.z - other_n.w) * (low0_nw.y + low0_n.y)
            - (2. * low_elev - other_n.z - other_n.w - other_ne.z - other_ne.w) * (low0_n.y + low0_ne.y)
        )
    );
    float convergence_high = 0.25 * (high_elev - low_elev) * (
        dY * (
              high0_nw.x + 2. * high0_w.x + high0_sw.x
            - high0_ne.x - 2. * high0_e.x - high0_se.x
        ) + dX * (
              high0_sw.y + 2. * high0_s.y + high0_se.y
            - high0_nw.y - 2. * high0_n.y - high0_ne.y
        )
    );
    
    // smooth pressure
    // TODO: improve filtering, maybe larger window
    low1_out.p = (low1_out.p + low1_n.p + low1_s.p + low1_e.p + low1_w.p) * 0.2;
    high1_out.p = (high1_out.p + high1_n.p + high1_s.p + high1_e.p + high1_w.p) * 0.2;
    low1_out.p = (1. - K_uplift_damping) * low1_out.p + K_uplift_damping * high1_out.p;
    high1_out.p = (1. - K_uplift_damping) * high1_out.p + K_uplift_damping * low1_out.p;
    low1_out.p *= K_pressure_decay;
    high1_out.p *= K_pressure_decay;

    // accumulate pressure
    low1_out.p += convergence_low - uplift_flux;
    high1_out.p += convergence_high + uplift_flux;

    // decend pressure
    low0_out.x += (low1_w.p - low1_e.p) * K_pressure;
    low0_out.y += (low1_s.p - low1_n.p) * K_pressure;
    high0_out.x += (high1_w.p - high1_e.p) * K_pressure;
    high0_out.y += (high1_s.p - high1_n.p) * K_pressure;
    mid_out.w += (low1_out.p - high1_out.p) * K_pressure_uplift;
    
    // flow water/ice
    float temp = interp_elev(other_out.z * z_scale + other_out.w * water_scale, other_out.t, low1_out.t, high1_out.t, 0.);
    float temp_n = interp_elev(other_n.z * z_scale + other_n.w * water_scale, other_n.t, low1_n.t, high1_n.t, 0.);
    float temp_s = interp_elev(other_s.z * z_scale + other_s.w * water_scale, other_s.t, low1_n.t, high1_s.t, 0.);
    float temp_e = interp_elev(other_e.z * z_scale + other_e.w * water_scale, other_e.t, low1_n.t, high1_e.t, 0.);
    float temp_w = interp_elev(other_w.z * z_scale + other_w.w * water_scale, other_w.t, low1_n.t, high1_w.t, 0.);
    float elev = water_scale * other_out.w + z_scale * other_out.z;
    vec4 flux = vec4(
        ((temp_n > freezing_temp) && (temp > freezing_temp) ? K_flow : K_flow_glacier) * clamp((water_scale * other_n.w + z_scale * other_n.z - elev) / 5., -water_scale * other_out.w / 5., water_scale * other_n.w / 5.) / water_scale,
        ((temp_s > freezing_temp) && (temp > freezing_temp) ? K_flow : K_flow_glacier) * clamp((water_scale * other_s.w + z_scale * other_s.z - elev) / 5., -water_scale * other_out.w / 5., water_scale * other_s.w / 5.) / water_scale,
        ((temp_e > freezing_temp) && (temp > freezing_temp) ? K_flow : K_flow_glacier) * clamp((water_scale * other_e.w + z_scale * other_e.z - elev) / 5., -water_scale * other_out.w / 5., water_scale * other_e.w / 5.) / water_scale,
        ((temp_w > freezing_temp) && (temp > freezing_temp) ? K_flow : K_flow_glacier) * clamp((water_scale * other_w.w + z_scale * other_w.z - elev) / 5., -water_scale * other_out.w / 5., water_scale * other_w.w / 5.) / water_scale
    );
    other_out.w += dot(flux, vec4(1.));

    // precipitation
    mid_out.x = get_precip(low1_out.a, low1_out.t);
    mid_out.y = get_precip(high1_out.a, high1_out.t);
    low1_out.a -= mid_out.x;
    high1_out.a -= mid_out.y;
    other_out.w += mid_out.x + mid_out.y;

    // handle temperature
    vec4 xyz = vec4(xy, other_out.z * z_scale, 1.);
    vec4 sun_coord = M_sun * xyz;
    vec4 light = texture(light_t, sun_coord.xy / 2. + 0.5);
    other_out.t += (
        mix(Q_in_shade, Q_in, (sun_coord.z - light.a > 0.001 ? 0. : light.x))        // heat from sun
        - other_out.t * K0                                                           // heat lost to radiation
        - (other_out.t - low1_out.t) * K1                                            // heat lost to air via convection
    ) / mix(C_surface, C_surface_water, max(other_out.w / lake_depth, 0.));
    low1_out.t += (other_out.t - low1_out.t) * K1;                        // heat gained from ground
    high1_out.t -= high1_out.t * K2;                                      // heat lost to radiation
    vec2 pen_vect = pen_vel * pen_strength;
    if ((length(cursor_pos - xy) < pen_size) && (mouse_btns == 1) && (keys == 0)){
        switch (pen_type){
        case 0:  // all velocity
            low0_out = vec4(pen_vect, 0., 1.);
            high0_out = vec4(pen_vect, 0., 1.);
            break;
        case 1:  // low velocity
            low0_out = vec4(pen_vect, 0., 1.);
            break;
        case 2:  // high velocity
            high0_out = vec4(pen_vect, 0., 1.);
            break;
        case 3:  // elevation
            float r = length(cursor_pos - xy) / pen_size;
            other_out.z += (2. * r * r * r - 3. * r * r + 1.) * pen_strength * K_elevation_strength;
            // other_out.w += (2. * r * r * r - 3. * r * r + 1.) * pen_strength * K_elevation_strength;
            break;
        case 4:  // rain
            other_out.w += 10. * (2. * r * r * r - 3. * r * r + 1.) * pen_strength * K_elevation_strength;
            // other_out.w = pen_strength;
            break;
        }
        low1_out.a = 1.;
    }
    
    // clip values to 0-1 
    other_out.z = clamp(other_out.z, 0., 1.);
    other_out.w = max(0., other_out.w);
}

