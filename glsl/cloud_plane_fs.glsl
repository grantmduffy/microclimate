
uniform sampler2D low0_t;
uniform sampler2D low1_t;
uniform sampler2D high0_t;
uniform sampler2D high1_t;
uniform sampler2D mid_t;
uniform sampler2D other_t;
uniform sampler2D light_t;
uniform int cloud_mode;
uniform float cloud_density;
uniform mat4 M_camera_inv;
uniform mat4 M_sun;
uniform float near;
uniform float far;
uniform vec2 sim_res;
uniform vec3 camera_pos;
uniform vec3 sun_dir;

in vec4 xyz;
out vec4 frag_color;

void main(){
    vec2 xy = xyz.xy;
    if (
               (xyz.x < 0.) 
            || (xyz.y < 0.) 
            || (xyz.x > 1.) 
            || (xyz.y > 1.)
            || (xyz.z < 0.)
            || (xyz.z > max_elev)
        ){
        discard;
    }
    float ground_temp = texture(other_t, xyz.xy).t;
    float low_temp = texture(low1_t, xyz.xy).t;
    float high_temp = texture(high1_t, xyz.xy).t;
    float temp = interp_elev(xyz.z, ground_temp, low_temp, high_temp, 0.);
    switch (cloud_mode){
        case 0:  // velocity

            break;
        case 1:  // uplift
            break;
        case 2:  // pressure
            break;
        case 3:  // realistic
            vec4 sun_coord = M_sun * xyz;
            vec4 light = texture(light_t, sun_coord.xy / 2. + 0.5 + rand2d(sun_coord.xy) / sim_res);
            float brightness = sun_coord.z > light.a ? 0. : clamp(
                (xyz.z - light.y) * (1. - light.x) / (light.z - light.y) + light.x, 
                light.x, 1.
            );
            float low_cloud = texture(low1_t, xyz.xy + rand2d(sun_coord.xy) / sim_res).a;
            float high_cloud = texture(high1_t, xyz.xy + rand2d(sun_coord.xy) / sim_res).a;
            float cloud = get_cloud_density(interp_elev(
                xyz.z, 0., low_cloud, high_cloud, 0.
            ), temp);
            vec2 precip = texture(mid_t, xyz.xy).xy;
            precip.x += precip.y;
            float rain = clamp(rain_density * interp_rain(xyz.z, precip.x, precip.x, precip.y, 0.), 0., 1.);
            float cos_angle = dot(sun_dir, normalize(camera_pos - xyz.xyz));
            vec3 light_color = mix(
                ambient_color.xyz, 
                sun_color.xyz * mix(
                    vec3(1.), 
                    get_rainbow(cos_angle), 
                    rain * (1. - cloud)
                ), brightness
            );
            frag_color = vec4(
                light_color,
                max(cloud, rain)
            );
            // frag_color = get_rainbow(cos_angle);
            break;
        case 4:  // temp
            frag_color = heatmap(temp);
            frag_color.a = 0.03 * float(temp > 0.5);
        default:
            break;
    }

}