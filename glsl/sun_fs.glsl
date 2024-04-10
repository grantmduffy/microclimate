
uniform sampler2D low1_t;
uniform sampler2D high1_t;
uniform sampler2D other_t;
uniform sampler2D mid_t;
uniform vec3 sun_dir;
uniform mat4 M_sun;

#define n_light_samples 80
#define cloud_start 0.1
#define cloud_density_sun 1.5
#define cloud_end_density 0.3

// out vec4 frag_color;
in vec4 xyz;  // surface point
in vec4 sun_coord;
layout(location = 0) out vec4 light_out;

void main(){

    light_out = vec4(1., 0., 0., 0.);
    for (int i = n_light_samples; i > 0; i--){
        float z_sample = xyz.z + (max_elev - xyz.z) * float(i) / float(n_light_samples);
        vec2 xy_sample = xyz.xy + 0.5 * (z_sample - xyz.z) * sun_dir.xy / sun_dir.z;
        float low_cloud = texture(low1_t, xy_sample).a;
        float high_cloud = texture(high1_t, xy_sample).a;
        float ground_temp = texture(other_t, xyz.xy).t;
        float low_temp = texture(low1_t, xyz.xy + 0.5 * (z_sample - xyz.z) * sun_dir.xy / sun_dir.z).t;
        float high_temp = texture(high1_t, xy_sample).t;
        float temp = interp_elev(z_sample, ground_temp, low_temp, high_temp, 0.);
        float cloud = get_cloud_density(interp_elev(
            z_sample, 0., low_cloud, high_cloud, 0.
        ), temp);

        // rain
        // vec2 precip = texture(mid_t, xy_sample).xy;
        // precip.x += precip.y;
        // float rain = clamp(rain_density * interp_rain(z_sample, precip.x, precip.x, precip.y, 0.), 0., 1.);
        // light_out.x *= (1. - cloud_density_sun * max(cloud, rain) * (max_elev - xyz.z));
        
        // no rain
        light_out.x *= (1. - cloud_density_sun * cloud * (max_elev - xyz.z));
        
        // cloud lower edge
        light_out.y = (cloud > cloud_start) && (light_out.x > cloud_end_density) ? z_sample : light_out.y;
        
        // cloud upper edge
        light_out.z = (cloud > cloud_start) && (light_out.z == 0.) ? z_sample : light_out.z;
    }

    light_out.a = sun_coord.z;  // for shaddow mapping
}