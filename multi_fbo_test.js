let sim_vs_src = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 vert_pos;
out vec2 xy;

void main(){
    gl_Position = vec4(vert_pos, 0., 1.);
    xy = vert_pos * 0.5 + 0.5;
}

`;

let sim_fs_src = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

#define K_pressure 0.01
#define K_p_decay 0.99

uniform vec2 mouse_pos;
uniform int mouse_btns;
uniform vec2 res;

uniform sampler2D low0;
uniform sampler2D low1;
uniform sampler2D high0;
uniform sampler2D high1;
uniform sampler2D other0;

in vec2 xy;
layout(location = 0) out vec4 low0_out;
layout(location = 1) out vec4 low1_out;
layout(location = 2) out vec4 high0_out;
layout(location = 3) out vec4 high1_out;
layout(location = 4) out vec4 other0_out;


void main(){

    // backward convection
    vec2 uv_low = texture(low0, xy).xy;
    vec4 low0_n = texture(low0, xy + (vec2(0., 1.)- uv_low) / res);
    vec4 low0_s = texture(low0, xy + (vec2(0., -1.)- uv_low) / res);
    vec4 low0_e = texture(low0, xy + (vec2(1., 0.)- uv_low) / res);
    vec4 low0_w = texture(low0, xy + (vec2(-1., 0.)- uv_low) / res);
    vec2 uv_high = texture(high0, xy).xy;
    vec4 high0_n = texture(high0, xy + (vec2(0., 1.)- uv_high) / res);
    vec4 high0_s = texture(high0, xy + (vec2(0., -1.)- uv_high) / res);
    vec4 high0_e = texture(high0, xy + (vec2(1., 0.)- uv_high) / res);
    vec4 high0_w = texture(high0, xy + (vec2(-1., 0.)- uv_high) / res);
    low0_out = texture(low0, xy - uv_low / res);
    low1_out = texture(low1, xy - uv_low / res);
    high0_out = texture(high0, xy - uv_low / res);
    high1_out = texture(high1, xy - uv_low / res);

    // accumulate pressure
    low0_out.p += low0_w.x - low0_e.x + low0_s.y - low0_n.y;
    low0_out.p *= K_p_decay;
    high0_out.p += high0_w.x - high0_e.x + high0_s.y - high0_n.y;
    high0_out.p *= K_p_decay;

    // decend pressure
    low0_out.x += (low0_w.p - low0_e.p) * K_pressure;
    low0_out.y += (low0_s.p - low0_n.p) * K_pressure;
    high0_out.x += (high0_w.p - high0_e.p) * K_pressure;
    high0_out.y += (high0_s.p - high0_n.p) * K_pressure;
    
    
    // handle elevation, water, and erosion
    other0_out = vec4(0.5, 1., 0., 1.);

    if ((length(mouse_pos - xy) < 0.01) && (mouse_btns == 1)){
        low0_out = vec4(1.);
        high0_out = vec4(1.);
        low1_out = vec4(0., 0., 0., 1.);
        high1_out = vec4(0., 0., 0., 1.);
    }
}

`;

let render_vs_src = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 vert_pos;
out vec2 xy;

void main(){
    gl_Position = vec4(vert_pos, 0., 1.);
    xy = vert_pos * 0.5 + 0.5;
}

`;

let render_fs_src = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;

in vec2 xy;
out vec4 frag_color;
uniform sampler2D low0;
uniform sampler2D low1;
uniform sampler2D high0;
uniform sampler2D high1;
uniform sampler2D other0;


void main(){
    vec4 low0_val = texture(low0, xy);
    float vel = length(low0_val.xy);
    float p = low0_val.p;
    frag_color = vec4(p, vec2(vel), 1.);
}

`;


var [width, height] = [1, 1];
let mouse_state = {
    x: 0.5,
    y: 0.5,
    buttons: 0
};
var canvas = null;
const fps = 30;


function mouse_move(event){
    mouse_state.x = event.offsetX / width;
    mouse_state.y = 1 - event.offsetY / height;
    mouse_state.buttons = event.buttons;
}


function init(){
    canvas = document.getElementById('gl-canvas')
    setup_gl(canvas);
    [width, height] = [canvas.width, canvas.height];
    
    // compile shaders
    let sim_vs = compile_shader(sim_vs_src, gl.VERTEX_SHADER, '');
    let sim_fs = compile_shader(sim_fs_src, gl.FRAGMENT_SHADER, '');
    let sim_program = link_program(sim_vs, sim_fs);
    let render_vs = compile_shader(render_vs_src, gl.VERTEX_SHADER, '');
    let render_fs = compile_shader(render_fs_src, gl.FRAGMENT_SHADER, '');
    let render_program = link_program(render_vs, render_fs);

    // setup buffers
    let vertex_buffer = create_buffer(new Float32Array(screen_mesh[0].flat()), gl.ARRAY_BUFFER, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
    let tri_buffer = create_buffer(new Uint16Array(screen_mesh[1].flat()), gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tri_buffer)
    let sim_pos_attr_loc = gl.getAttribLocation(sim_program, 'vert_pos');
    gl.vertexAttribPointer(
        sim_pos_attr_loc, 2,
        gl.FLOAT, gl.FALSE,
        2 * 4, 0
    );
    gl.enableVertexAttribArray(sim_pos_attr_loc);
    let render_pos_attr_loc = gl.getAttribLocation(render_program, 'vert_pos');
    gl.vertexAttribPointer(
        render_pos_attr_loc, 2,
        gl.FLOAT, gl.FALSE,
        2 * 4, 0
    );
    gl.enableVertexAttribArray(render_pos_attr_loc);


    // textures
    let sim_fbo = gl.createFramebuffer();
    let sim_depthbuffer = gl.createRenderbuffer();
    let tex_names = ['low0', 'low1', 'high0', 'high1', 'other0'];
    let textures = [];
    for (var i = 0; i < tex_names.length; i++){
        textures.push({
            'name': tex_names[i],
            'in_tex': create_texture(width, height, [0, 0, 0, 1], i),
            'out_tex': create_texture(width, height, [0, 0, 0, 1], i)
        });
    }

    // setup fbo
    gl.bindRenderbuffer(gl.RENDERBUFFER, sim_depthbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, sim_fbo);
    gl.drawBuffers([
        gl.COLOR_ATTACHMENT0,
        gl.COLOR_ATTACHMENT1,
        gl.COLOR_ATTACHMENT2,
        gl.COLOR_ATTACHMENT3,
        gl.COLOR_ATTACHMENT4,
        // gl.COLOR_ATTACHMENT5,
        // gl.COLOR_ATTACHMENT6,
        // gl.COLOR_ATTACHMENT7,
    ]);

    let loop = function(){

        // sim program
        gl.useProgram(sim_program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, sim_fbo);
        for (var i = 0; i < textures.length; i++){

            // swap textures
            [textures[i].in_tex, textures[i].out_tex] = [textures[i].out_tex, textures[i].in_tex];

            // set active in textures (for all programs)
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, textures[i].in_tex);

            // set in texture uniforms for sim_program
            gl.uniform1i(gl.getUniformLocation(sim_program, textures[i].name), i);

            // set out textures for sim_fbo
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i,
                gl.TEXTURE_2D, textures[i].out_tex, 0
            );

        }
        gl.uniform2f(gl.getUniformLocation(sim_program, 'mouse_pos'), mouse_state.x, mouse_state.y);
        gl.uniform1i(gl.getUniformLocation(sim_program, 'mouse_btns'), mouse_state.buttons);
        gl.uniform2f(gl.getUniformLocation(sim_program, 'res'), width, height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
        gl.drawElements(gl.TRIANGLES, 3 * screen_mesh[1].length, gl.UNSIGNED_SHORT, 0);

        // draw render
        gl.useProgram(render_program);
        for (var i = 0; i < textures.length; i++){
            gl.uniform1i(gl.getUniformLocation(render_program, textures[i].name), i);
        }
        gl.uniform2f(gl.getUniformLocation(render_program, 'res'), width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
        gl.drawElements(gl.TRIANGLES, 3 * screen_mesh[1].length, gl.UNSIGNED_SHORT, 0);

        // setTimeout(() =>{requestAnimationFrame(loop);}, 1000 / fps);
        requestAnimationFrame(loop);  // unlimited fps
    }
    requestAnimationFrame(loop);
}