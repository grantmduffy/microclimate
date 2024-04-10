#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

#define render_res vec2(640., 480.)

// simulation parameters
#define K_pressure 0.1
#define K_pressure_uplift 0.01
#define K_pressure_uplift_acc 10.
#define K_pressure_decay 0.999
#define K_uplift_damping 0.05
#define K_p_decay .9
#define K_smooth 1.0
#define K_elevation_strength 0.01

// thermal properties, Tao units in frames
#define T_eq_surface 1.
#define T_eq_shade 0.6
#define Tao_surface 100.
#define Tao_surface_to_air 3000.
// #define Tao_surface_to_air_water (100000. * Tao_surface_to_air)
// #define Tao_surface_to_air_water 3000.
#define lake_depth 0.1
#define Tao_air_from_surface 100.
#define Tao_radiation 5.
#define C_surface (Tao_surface_to_air / Tao_air_from_surface)
#define C_surface_water (C_surface * 100.)
#define K0 (C_surface / Tao_surface)
#define K1 (1. / Tao_air_from_surface)
#define K2 (1. / Tao_radiation)
#define Q_in (T_eq_surface * K0)
#define Q_in_shade (T_eq_shade * K0)
#define freezing_temp 0.6

// surface properties
#define K_flow 1.2
#define K_flow_glacier 0.05

#define z_scale 0.1
#define water_scale 0.002
#define snow_scale 0.005
#define floating_ice_thickness 0.001

#define low_elev 0.04
#define high_elev 0.12
#define max_elev 0.3
#define cloud_transparency 0.05
#define rain_density 100.

#define cloud_threshold 0.6
#define cloud_sharpness 1.5
#define precip_threshold 0.8
#define shoreline_sharpness 1.0
#define rainbow_min 0.743
#define rainbow_max 0.766

#define ambient_color vec4( 30. / 255.,  40. / 255.,  45. / 255., 1.0)
#define sun_color     vec4(255. / 255., 255. / 255., 237. / 255., 1.0)
#define grass_color  vec4(122. / 255., 261. / 255., 112. / 255., 1.0)
#define water_color   vec4( 66. / 255., 135. / 255., 245. / 255., 1.0)
#define water_transparency 0.2

float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 rand2d(vec2 co){
    float a = rand(co);
    return vec2(
        rand(vec2(co.x, a)),
        rand(vec2(co.y, a))
    );
}

float interp_elev(float z, float v_ground, float v_low, float v_high, float v_max){
    if (z < low_elev){  // below low clouds
        return z * (v_low - v_ground) / low_elev + v_ground;
    } else if (z < high_elev){  // between low and high clouds
        return (z - low_elev) * (v_high - v_low) / (high_elev - low_elev) + v_low;
    } else {  // above high clouds
        return (z - high_elev) * (v_max - v_high) / (max_elev - high_elev) + v_high;
    }
}

float interp_rain(float z, float v_ground, float v_low, float v_high, float v_max){
    float z0 = low_elev / 2.;
    float z1 = (low_elev + high_elev) / 2.;
    if (z < z0){  // below low clouds
        return z * (v_low - v_ground) / z0 + v_ground;
    } else if (z < z1){  // between low and high clouds
        return (z - z0) * (v_high - v_low) / (z1 - z0) + v_low;
    } else {  // above high clouds
        return (z - z1) * (v_max - v_high) / (high_elev - z1) + v_high;
    }
}

float get_cloud_density(float h, float t){
    return clamp((h - t - cloud_threshold) / (precip_threshold - cloud_threshold), 0., 1.);
}

float get_precip(float h, float t){
    return max(h - t - precip_threshold, 0.);
}

vec4 heatmap(float temp){
    // 0:   (0, 0, 1) x=0
    // fl:  (0, 0, 0) x=1
    // 2fl: (1, 0, 0) x=2
    // 3fl: (1, 1, 0) x=3
    // 4fl: (1, 1, 1) x=4
    float x = temp / freezing_temp;
    return float(mod(x, 0.25) > 0.01) * vec4(
        x - 1., 
        x - 2., 
        max(1. - x, x - 3.), 
        1.
    );
}

vec3 hsv2rgb(vec3 c){
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 get_rainbow(float cos_angle){
    float amt = (cos_angle - rainbow_min) / (rainbow_max - rainbow_min);
    float a = clamp(abs(2. * amt - 1.) - 1., 0., 1.);
    return mix(
        hsv2rgb(vec3(clamp(amt, 0., .72), 1., 1.)),
        vec3(1.),
        a
    );
}

vec4 get_ground_color(float temp){
    return temp > freezing_temp ? grass_color : vec4(0.5, 0.5, 0.5, 1.);
}

vec4 get_water_color(float temp, float sunlight, float cos_angle, float depth){
    vec4 white_color =  mix(ambient_color, sun_color, sunlight);
    return temp > freezing_temp ? vec4(
        white_color.rgb * water_color.rgb,
        ((1. - cos_angle) * (1. - water_transparency) + water_transparency) * clamp(depth * shoreline_sharpness, 0., 1.)
    ) : white_color;
}