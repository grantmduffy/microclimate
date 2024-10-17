

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
layout(location = 0) out vec4 atm0_out;
layout(location = 1) out vec4 atm1_out;
layout(location = 2) out vec4 water0_out;
layout(location = 3) out vec4 water1_out;
layout(location = 4) out vec4 ground_out;


void main(){

    // backward convection
    vec2 uv  = delta_t * texture(atm0_t, xy).xy;
    vec2 northwest = xy + vec2(-1.,  1.) / sim_res;
    vec2 west      = xy + vec2(-1.,  0.) / sim_res;
    vec2 southwest = xy + vec2(-1., -1.) / sim_res;
    vec2 north     = xy + vec2( 0.,  1.) / sim_res;
    vec2 south     = xy + vec2( 0., -1.) / sim_res;
    vec2 northeast = xy + vec2( 1.,  1.) / sim_res;
    vec2 east      = xy + vec2( 1.,  0.) / sim_res;
    vec2 southeast = xy + vec2( 1., -1.) / sim_res;
    vec4 atm0      = texture(atm0_t,  xy        - uv);
    vec4 atm0_nw   = texture(atm0_t,  northwest - uv);
    vec4 atm0_n    = texture(atm0_t,  north     - uv);
    vec4 atm0_ne   = texture(atm0_t,  northeast - uv);
    vec4 atm0_sw   = texture(atm0_t,  southwest - uv);
    vec4 atm0_s    = texture(atm0_t,  south     - uv);
    vec4 atm0_se   = texture(atm0_t,  southeast - uv);
    vec4 atm0_e    = texture(atm0_t,  east      - uv);
    vec4 atm0_w    = texture(atm0_t,  west      - uv);
    vec4 atm1      = texture(atm1_t,  xy        - uv);
    vec4 atm1_n    = texture(atm1_t,  north     - uv);
    vec4 atm1_s    = texture(atm1_t,  south     - uv);
    vec4 atm1_e    = texture(atm1_t,  east      - uv);
    vec4 atm1_w    = texture(atm1_t,  west      - uv);
    vec4 ground    = texture(ground_t, xy                );
    vec4 ground_nw = texture(ground_t, northwest         );
    vec4 ground_n  = texture(ground_t, north             );
    vec4 ground_ne = texture(ground_t, northeast         );
    vec4 ground_sw = texture(ground_t, southwest         );
    vec4 ground_s  = texture(ground_t, south             );
    vec4 ground_se = texture(ground_t, southeast         );
    vec4 ground_e  = texture(ground_t, east              );
    vec4 ground_w  = texture(ground_t, west              );

    // convection, low and high include uplift, mid is pure 2D
    atm0_out  = atm0;
    low1_out  = atm1;
    ground_out = ground;

    // TODO: calculate atm convergence
    // TODO: smooth atm thickness?
    // TODO: descend thickness

    // TODO: calculate water convergence
    // TODO: smooth water depth?
    // TODO: descend water depth

    // TODO: precipitation

    // TODO: handle temperature
    
    // 
    if ((length(cursor_pos - xy) < pen_size) && (mouse_btns == 1) && (keys == 0)){
        switch (pen_type){
        case 0:  // all velocity
        case 1:  // low velocity
        case 2:  // high velocity
            atm0_out = vec4(pen_vect, 0., 1.);
            break;
        case 3:  // elevation
            float r = length(cursor_pos - xy) / pen_size;
            ground.z += (2. * r * r * r - 3. * r * r + 1.) * pen_strength * K_elevation_strength;
            break;
        case 4:  // rain
            water0.z += 10. * (2. * r * r * r - 3. * r * r + 1.) * pen_strength * K_elevation_strength;
            break;
        }
    }
    
    // clip values to 0-1 
    ground_out.z = clamp(ground_out.z, 0., 1.);
    ground_out.w = max(0., ground_out.w);
}

