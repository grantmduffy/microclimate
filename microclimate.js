/*
textures:

value  | x | y | z | w |
       | r | g | b | a |
       | s | t | p | a | loc |
-------|---|---|---|---|-----|
low0   | u | v | - | - |  0  |
low1   | - | T | P | H |  1  |
high2  | u | v | - | - |  2  |
high3  | - | T | P | H |  3  |
mid    | r | r | - | U |  4  |
other  | s | T | z | w |  5  |
light  | g | l | h | d |  6  |

Velocity         | uv |  low0/high0.xy
Temperature      | T  |  low1/high1.t
Humidity         | H  |  low1/high1.a
Pressure         | P  |  low1/high1.p
Uplift           | U  |  mid.w
Sediment         | s  |  other.s
Surface Temp     | T  |  other.t
Elevation        | z  |  other.z
Water            | w  |  other.w
Surface Light    | g  |  light.x
Low Cloud Light  | l  |  light.y
High Cloud Light | h  |  light.z
Surface Depth    | d  |  light.w
Low/High Precip  | r  |  mid.xy

*/

var [width, height] = [1, 1];
let mouse_state = {
    x: 0.5,
    y: 0.5,
    physical_x: 0.5,
    physical_y: 0.5,
    vel_x: 0.0,
    vel_y: 0.0,
    buttons: 0
};
var canvas = null;
const fps = 10;
const K_drag = 100;
const render_width = 640;
const render_height = 480;
let M_camera = new Float32Array(16);
let M_camera_inv = new Float32Array(16);
let M_perspective = new Float32Array(16);
let camera_rot = [45, 0];
let near = 0.03
let far = 1.5
const PI = 3.14159
const walk_speed = 0.003;
const look_speed = 1.;
const vert_speed = 0.001;
const n_cloud_planes = 400;
const z_max = 0.3  // max_elev
const z_min = -0.01
var render_t0 = 0;
var fps_filtered = 0;
const fps_filt_const = 0.99;
let data = {};


function invert_vect(arr){
    let out = [];
    for (var i = 0; i < arr.length; i++){
        out.push(-arr[i]);
    }
    return out;
}


function norm_vect(arr){
    var mag = 0
    for (var i = 0; i < arr.length; i++){
        mag += arr[i] ** 2;
    }
    mag = mag ** 0.5;
    for (var i = 0; i < arr.length; i++){
        arr[i] = arr[i] / mag;
    }
}


function mouse_move(event){
    let new_x = event.offsetX / canvas.width;
    let new_y = 1 - event.offsetY / canvas.height;
    let [x, y] = get_cursor_point(new_x, new_y);
    mouse_state.physical_vel_x = (x - mouse_state.physical_x) * K_drag;
    mouse_state.physical_vel_y = (y - mouse_state.physical_y) * K_drag;
    mouse_state.physical_x = x;
    mouse_state.physical_y = y;
    mouse_state.vel_x = (new_x - mouse_state.x) * K_drag;
    mouse_state.vel_y = (new_y - mouse_state.y) * K_drag;
    mouse_state.x = new_x;
    mouse_state.y = new_y;
    mouse_state.buttons = event.buttons;
    if (event.shiftKey){
        mouse_state.keys = 1;
    } else if (event.ctrlKey){
        mouse_state.keys = 2;
    } else if (event.altKey){
        mouse_state.keys = 3;
    } else {
        mouse_state.keys = 0;
    }
    document.getElementById('debug').innerText = x.toFixed(2) + ', ' + y.toFixed(2);

    if (mouse_state.buttons == 1){
        if (mouse_state.keys == 1){
            // rotate camera
            camera_rot[0] -= mouse_state.vel_y * look_speed;
            camera_rot[1] += mouse_state.vel_x * look_speed;
        }
        if (mouse_state.keys == 2){
            // translate camera
            let t = camera_rot[1] * PI / 180;
            data.uniforms.camera_pos.value[0] -= walk_speed * (mouse_state.vel_x * Math.cos(t) - mouse_state.vel_y * Math.sin(t));
            data.uniforms.camera_pos.value[1] -= walk_speed * (mouse_state.vel_x * Math.sin(t) + mouse_state.vel_y * Math.cos(t));
        }
        if (mouse_state.keys == 3){
            data.uniforms.camera_pos.value[2] -= vert_speed * mouse_state.vel_y;
        }
    
    }

    data.uniforms.mouse_pos.value[0] = mouse_state.x;
    data.uniforms.mouse_pos.value[1] = mouse_state.y;
    data.uniforms.cursor_pos.value[0] = mouse_state.physical_x;
    data.uniforms.cursor_pos.value[1] = mouse_state.physical_y;
    data.uniforms.mouse_btns.value = mouse_state.buttons;
    data.uniforms.keys.value = mouse_state.keys;
    data.uniforms.pen_vel.value[0] = mouse_state.physical_vel_x;
    data.uniforms.pen_vel.value[1] = mouse_state.physical_vel_y;

}


function get_cursor_point(x, y){
    let uv0 = new Float32Array([x * 2 - 1, y * 2 - 1, -1, 1]);
    let uv1 = new Float32Array([x * 2 - 1, y * 2 - 1, 1, 1]);
    let xyz0 = new Float32Array(4);
    let xyz1 = new Float32Array(4);
    mat4.multiply(xyz0, data.uniforms.M_camera_inv.value, uv0);
    mat4.multiply(xyz1, data.uniforms.M_camera_inv.value, uv1);
    let t = -(xyz0[2] / xyz0[3]) / (xyz1[2] / xyz1[3] - xyz0[2] / xyz0[3]);
    let x_out = xyz0[0] / xyz0[3] + t * (xyz1[0] / xyz1[3] - xyz0[0] / xyz0[3]);
    let y_out = xyz0[1] / xyz0[3] + t * (xyz1[1] / xyz1[3] - xyz0[1] / xyz0[3]);
    return [x_out, y_out];
}


function get_arrows(n = 20){
    let out = [];
    for (var i = 0; i < n; i++){
        let x = 2 * i / (n - 1) - 1;
        for (var j = 0; j < n; j++){
            let y = 2 * j / (n - 1) - 1;
            out.push([x, y, 0, x, y, 1]);
        }
    }
    return out;
}


function get_grid_mesh(n = 512, m = 512){
    let out = [];
    for (var i = 0; i < n; i++){
        for (var j = 0; j < m; j++){
            let x0 = j / m;
            let y0 = i / n;
            let x1 = (j + 1) / m;
            let y1 = (i + 1) / n;
            // x0 += 0.1 / m;
            // y0 += 0.1 / n;
            out.push([
                x0, y0,
                x1, y0,
                x1, y1,
            ]);
            out.push([
                x0, y0,
                x1, y1,
                x0, y1
            ]);
        }
    }
    return out;
}


function get_cloud_planes(n=2){
    let out = [];
    for (var i = 0; i < n; i++){
        out.push([
            0., 0., 1. - i / (n - 1),
            0., 1., 1. - i / (n - 1),
            1., 1., 1. - i / (n - 1)
        ]);
        out.push([
            0., 0., 1. - i / (n - 1),
            1., 1., 1. - i / (n - 1),
            1., 0., 1. - i / (n - 1),
        ]);
    }
    return out;
}


function set_sun_matrix(M){

    // row 0
    M[0] = 2;
    M[1] = 0;
    M[2] = 0;
    M[3] = 0;

    // row 1
    M[4] = 0;
    M[5] = 2;
    M[6] = 0;
    M[7] = 0;

    // row 2
    M[8] = -data.uniforms.sun_dir.value[0] / data.uniforms.sun_dir.value[2];
    M[9] = -data.uniforms.sun_dir.value[1] / data.uniforms.sun_dir.value[2];
    M[10] = -2 / (z_max - z_min);
    M[11] = 0;

    // row 3
    M[12] = -1;
    M[13] = -1;
    M[14] = (z_max + z_min) / (z_max - z_min);
    M[15] = 1;

}


function set_camera_matrix(M_camera, M_camera_inv, camera_pos){
    mat4.identity(M_camera);
    mat4.rotateX(M_camera, M_camera, -camera_rot[0] * PI / 180);
    mat4.rotateZ(M_camera, M_camera, -camera_rot[1] * PI / 180);
    mat4.translate(M_camera, M_camera, invert_vect(camera_pos));
    mat4.perspective(M_perspective, 45 * PI / 180, render_width / render_height, near, far);
    mat4.multiply(M_camera, M_perspective, M_camera);
    mat4.invert(M_camera_inv, M_camera);
}


function add_slider(parent, k, uniform, n_steps=1000){
    min = uniform.input.min;
    max = uniform.input.max;
    default_value = uniform.input.default;
    div = document.createElement('div');
    div.classList.add('row');
    div.classList.add('slider');
    l = document.createElement('label');
    l.innerText = k;
    l.classList.add('col-3');
    min_input = document.createElement('input');
    min_input.type = 'number';
    min_input.value = min;
    max_input = document.createElement('input');
    max_input.type = 'number';
    max_input.value = max;
    range_input = document.createElement('input');
    range_input.type = 'range';
    range_input.classList.add('col')
    range_input.min = min;
    range_input.max = max;
    range_input.step = (max - min) / n_steps;
    range_input.value = default_value;
    bubble = document.createElement('input')
    bubble.type = 'number';
    bubble.value = default_value;
    bubble.classList.add('bubble');
    hover_func = function(){
        b = this.parentElement.children[1];
        r = this.parentElement.children[3];
        let [min, max] = [r.min, r.max];
        val = parseFloat(r.value);
        r.style.zIndex = 4;
        b.style.top = (this.parentElement.offsetTop + this.parentElement.clientHeight * 1.1 - b.clientHeight / 2) + 'px';
        b.style.left = ((r.clientWidth - b.clientWidth) * (val - min) / (max - min) + r.offsetLeft) + 'px';
        b.classList.add('bubble-active');
    };
    end_hover_func = function(){
        b = this.parentElement.children[1];
        r = this.parentElement.children[3];
        let [min, max] = [r.min, r.max];
        val = parseFloat(r.value);
        r.style.zIndex = 1;
        b.style.top = (this.parentElement.offsetTop + this.parentElement.clientHeight / 2 - b.clientHeight / 2) + 'px';
        b.style.left = ((r.clientWidth - b.clientWidth) * (val - min) / (max - min) + r.offsetLeft) + 'px';
        b.classList.remove('bubble-active');
    };
    range_input.addEventListener('input', function(){
        val = parseFloat(this.value);
        b = this.parentElement.children[1];
        r = this.parentElement.children[3];
        let [min, max] = [r.min, r.max];
        b.value = val;
        b.style.left = ((r.clientWidth - b.clientWidth) * (val - min) / (max - min) + r.offsetLeft) + 'px';
        uniform.value = val;
    });
    range_input.addEventListener('mouseenter', hover_func);
    bubble.addEventListener('mouseenter', hover_func);
    range_input.addEventListener('mouseout', end_hover_func);
    bubble.addEventListener('mouseout', end_hover_func);
    min_input.addEventListener('change', function(){
        val = parseFloat(this.value);
        r = this.parentElement.children[3];
        r.min = val;
        r.step = (r.max - r.min) / n_steps;
        r.dispatchEvent(new Event('input'));
    });
    max_input.addEventListener('change', function(){
        val = parseFloat(this.value);
        r = this.parentElement.children[3];
        r.max = val;
        r.step = (r.max - r.min) / n_steps;
        r.dispatchEvent(new Event('input'));
    });
    bubble.addEventListener('change', function(){
        val = parseFloat(this.value);
        r = this.parentElement.children[3];
        r.value = val;
        r.dispatchEvent(new Event('input'));
    });
    div.appendChild(l);
    div.appendChild(bubble);
    div.appendChild(min_input);
    div.appendChild(range_input);
    div.appendChild(max_input);
    
    parent.appendChild(div);
    // bubble.style.left = ((range_input.clientWidth - bubble.clientWidth) * (default_value - min) / (max - min) + range_input.offsetLeft) + 'px';
    // bubble.style.top = (range_input.offsetTop + range_input.clientHeight / 2 - bubble.clientHeight / 2) + 'px';
    range_input.dispatchEvent(new Event('input'));
    return div;
}


async function initialize_uniforms(){
    let inputs_el = document.getElementById('inputs');
    return load_file('uniforms.json').then((uniforms) => {
        uniforms = JSON.parse(uniforms);
        for (let k in uniforms){

            // setup value buffers
            if (!('value' in uniforms[k])){
                switch(uniforms[k].type){
                    case 'bool':
                        uniforms[k].value = false;
                        break;
                    case 'int':
                        uniforms[k].value = 0;
                        break;
                    case 'uint':
                        uniforms[k].value = 0;
                        break;
                    case 'float':
                        uniforms[k].value = 0.0;
                        break;
                    case 'double':
                        uniforms[k].value = 0.0;
                        break;
                    default:
                        let vec_re = /([biud]?)vec([234]?)$/.exec(uniforms[k].type);
                        if (vec_re != null){
                            [_, dtype, n] = vec_re;
                            n = parseFloat(n);
                            switch (dtype){
                                case '':
                                    uniforms[k].value = new Float32Array(n);
                                    break;
                                case 'b':
                                    uniforms[k].value = new Uint8Array(n);
                                    break;
                                case 'i':
                                    uniforms[k].value = new Int32Array(n);
                                    break;
                                case 'u':
                                    uniforms[k].value = new Uint32Array(n);
                                    break;
                                case 'd':
                                    uniforms[k].value = new Float64Array(n);
                                    break;
                            }
                        }
                        let mat_re = /(d?)mat([234])x?([234]?)/.exec(uniforms[k].type);
                        if (mat_re != null){
                            [_, dtype, n, m] = mat_re;
                            n = m == '' ? parseInt(n) ** 2: parseInt(n) * parseInt(m);
                            if (dtype == 'd'){
                                uniforms[k].value = new Float64Array(n);
                            } else {
                                uniforms[k].value = new Float32Array(n);
                            }
                        }
                    
                }
            }

            // setup UI for uniforms
            if ('input' in uniforms[k]){
                var d = null;
                switch (uniforms[k].input.type){
                    case 'range':
                        add_slider(
                            inputs_el, 
                            k,
                            uniforms[k]
                        );
                        // d = document.createElement('div');
                        // d.classList.add('row');
                        // l = document.createElement('label');
                        // l.innerText = k + ': ';
                        // l.classList.add('col');
                        // e = document.createElement('input');
                        // e.type = 'range';
                        // e.classList.add('col-8');
                        // if ('min' in uniforms[k].input) e.min = uniforms[k].input.min;
                        // if ('max' in uniforms[k].input) e.max = uniforms[k].input.max;
                        // if ('default' in uniforms[k].input){
                        //     e.value = uniforms[k].input.default;
                        //     uniforms[k].value = uniforms[k].input.default;
                        // };
                        // e.step = ('step' in uniforms[k].input) ? uniforms[k].input.step : 0.001;
                        // e.addEventListener('input', function(){
                        //     this.parentElement.children[0].innerText = k + ': ' + parseFloat(this.value).toFixed(2);
                        //     uniforms[k].value = parseFloat(this.value);
                        // });
                        // d.appendChild(l);
                        // d.appendChild(e);
                        // inputs_el.appendChild(d);
                        break;
                    case 'dropdown':
                        d = document.createElement('div');
                        d.classList.add('row');
                        l = document.createElement('label');
                        l.innerText = k;
                        l.classList.add('col-3');
                        e = document.createElement('select');
                        e.classList.add('col');
                        for (let i = 0; i < uniforms[k].input.options.length; i++){
                            o = document.createElement('option');
                            o.value = i;
                            o.innerText = uniforms[k].input.options[i];
                            if ('default' in uniforms[k].input && uniforms[k].input.default == uniforms[k].input.options[i]){
                                o.selected = true;
                                uniforms[k].value = i;
                            };
                            e.appendChild(o);
                        }
                        e.addEventListener('input', function(){
                            uniforms[k].value = parseInt(this.value);
                        });
                        d.appendChild(l);
                        d.appendChild(e);
                        inputs_el.appendChild(d);
                        break;
                    case 'color':
                        d = document.createElement('div');
                        d.classList.add('row');
                        l = document.createElement('label');
                        l.innerText = k;
                        l.classList.add('col-3');
                        e = document.createElement('input');
                        e.classList.add('col');
                        e.type = 'color';
                        if ('default' in uniforms[k].input) {
                            uniforms[k].value = uniforms[k].input.default;
                            e.value = rgba2hex(uniforms[k].input.default);
                        }
                        e.addEventListener('input', function(){
                            uniforms[k].value = hex2rgba(this.value);
                        });
                        d.appendChild(l);
                        d.appendChild(e);
                        inputs_el.appendChild(d);
                        break;
                }
            }
        }
        data.uniforms = uniforms;
        for (const program_name in data.programs){
            data.programs[program_name].uniform_locations = {};
            // console.log(program_name);
            for (const uniform_name in data.uniforms){
                let loc = gl.getUniformLocation(
                    data.programs[program_name].program,
                    uniform_name
                );
                if (loc != null){
                    // console.log('\t' + uniform_name);
                    data.programs[program_name].uniform_locations[uniform_name] = loc;
                }
            }
        }
    });
}


function set_uniforms(){
    for (program_name in data.programs){
        gl.useProgram(data.programs[program_name].program);
        for (uniform_name in data.programs[program_name].uniform_locations){
            let loc = data.programs[program_name].uniform_locations[uniform_name];
            let value = data.uniforms[uniform_name].value;
            switch (data.uniforms[uniform_name].type){
                case 'bool':
                case 'int':
                case 'uint':  
                case 'sampler2D':      
                    gl.uniform1i(loc, value);
                    break;
                case 'float':
                case 'double':
                    gl.uniform1f(loc, value);
                    break;
                case 'bvec2':
                case 'ivec2':
                case 'uvec2':
                    gl.uniform2iv(loc, value);
                    break;
                case 'vec2':
                case 'dvec2':
                    gl.uniform2fv(loc, value);
                    break;
                case 'bvec3':
                case 'ivec3':
                case 'uvec3':
                    gl.uniform3iv(loc, value);
                    break;
                case 'vec3':
                case 'dvec3':
                    gl.uniform3fv(loc, value);
                    break;
                case 'bvec4':
                case 'ivec4':
                case 'uvec4':
                    gl.uniform4iv(loc, value);
                    break;
                case 'vec4':
                case 'dvec4':
                    gl.uniform4fv(loc, value);
                    break;
                case 'mat2':
                case 'dmat2':
                    gl.uniformMatrix2fv(loc, gl.FALSE, value);
                    break;
                case 'dmat3':
                case 'mat3':
                    gl.uniformMatrix3fv(loc, gl.FALSE, value);
                    break;
                case 'dmat4':
                case 'mat4':
                    gl.uniformMatrix4fv(loc, gl.FALSE, value);
                    break;
            }
        }
    }
}

function init(){
    canvas = document.getElementById('gl-canvas')
    setup_gl(canvas);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE);
    
    [width, height] = [canvas.width, canvas.height];
    let pen_type_options = [];
    let pen_type_el = document.getElementById('pen-type');
    let render_mode_el = document.getElementById('render-mode');
    for (var i = 0; i < pen_type_el.children.length; i++){
        pen_type_options.push(pen_type_el.children[i].value);
    }
    let view_mode_options = [];
    let view_mode_el = document.getElementById('view-mode');
    for (var i = 0; i < view_mode_el.children.length; i++){
        view_mode_options.push(view_mode_el.children[i].value);
    }
    let cloud_mode_options = [];
    let cloud_mode_el = document.getElementById('cloud-mode');
    for (var i = 0; i < cloud_mode_el.children.length; i++){
        cloud_mode_options.push(cloud_mode_el.children[i].value);
    }

    let loop = function(){

        set_sun_matrix(data.uniforms.M_sun.value);
        set_camera_matrix(
            data.uniforms.M_camera.value, 
            data.uniforms.M_camera_inv.value,
            data.uniforms.camera_pos.value
        );
        norm_vect(data.uniforms.sun_dir.value);
        set_uniforms();

        gl.disable(gl.BLEND);
        gl.enable(gl.DEPTH_TEST);

        // sim program
        gl.useProgram(data.programs.sim.program);
        gl.viewport(0, 0, data.uniforms.sim_res.value[1], data.uniforms.sim_res.value[0]);
        gl.bindBuffer(gl.ARRAY_BUFFER, data.buffers.vertex_buffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, data.buffers.tri_buffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, data.fbos.sim_fbo);
        gl.vertexAttribPointer(
            data.programs.render2d.pos_attr_loc, 2,
            gl.FLOAT, gl.FALSE,
            2 * 4, 0
        );
        for (var i = 0; i < data.textures.length; i++){

            // swap textures
            [data.textures[i].in_tex, data.textures[i].out_tex] = [data.textures[i].out_tex, data.textures[i].in_tex];

            // set active in textures (for all programs)
            gl.activeTexture(gl.TEXTURE0 + i);
            gl.bindTexture(gl.TEXTURE_2D, data.textures[i].in_tex);

            // set out textures for sim_fbo
            gl.framebufferTexture2D(
                gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i,
                gl.TEXTURE_2D, data.textures[i].out_tex, 0
            );

        }
        
        // draw
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
        gl.drawElements(gl.TRIANGLES, 3 * screen_mesh[1].length, gl.UNSIGNED_SHORT, 0);

        
        // draw sun layer
        gl.useProgram(data.programs.sun.program);
        if (render_mode_el.value != 'sun'){
            gl.bindFramebuffer(gl.FRAMEBUFFER, data.fbos.sun_fbo);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, data.buffers.grid_mesh_buffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.vertexAttribPointer(
            data.programs.sun.pos_attr_loc, 2,
            gl.FLOAT, gl.FALSE,
            2 * 4, 0
        );
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, grid_mesh.length * 3);

        if (render_mode_el.value == '2d'){

            canvas.width = data.uniforms.sim_res.value[1];
            canvas.height = data.uniforms.sim_res.value[0];
            
            // draw render2d
            gl.useProgram(data.programs.render2d.program);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
            gl.drawElements(gl.TRIANGLES, 3 * screen_mesh[1].length, gl.UNSIGNED_SHORT, 0);

            // draw arrows
            gl.useProgram(data.programs.arrow.program);
            gl.bindBuffer(gl.ARRAY_BUFFER, data.buffers.arrow_buffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            gl.vertexAttribPointer(
                data.programs.arrow.pos_attr_loc, 3,
                gl.FLOAT, gl.FALSE,
                3 * 4, 0
            );
            gl.drawArrays(gl.LINES, 0, arrows.length * 2);
        } else if (render_mode_el.value == '3d'){

            // drawing 3D
            canvas.width = render_width;
            canvas.height = render_height;

            gl.viewport(0, 0, render_width, render_height);
            gl.useProgram(data.programs.render3d.program);
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.bindBuffer(gl.ARRAY_BUFFER, data.buffers.grid_mesh_buffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            gl.vertexAttribPointer(
                data.programs.render3d.pos_attr_loc, 2,
                gl.FLOAT, gl.FALSE,
                2 * 4, 0
            );
            gl.clearColor(...data.uniforms.sky_color.value);
            gl.clear(gl.DEPTH_BUFFER_BIT | gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, grid_mesh.length * 3);

            // draw water
            gl.useProgram(data.programs.water.program);
            gl.enable(gl.BLEND);
            gl.drawArrays(gl.TRIANGLES, 0, grid_mesh.length * 3);


            // draw plane clouds
            gl.useProgram(data.programs.cloud_plane.program);
            gl.bindBuffer(gl.ARRAY_BUFFER, data.buffers.cloud_planes_buffer);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
            gl.vertexAttribPointer(
                data.programs.cloud_plane.pos_attr_loc, 3,
                gl.FLOAT, gl.FALSE,
                3 * 4, 0
            );
            gl.drawArrays(gl.TRIANGLES, 0, 3 * cloud_planes.length);
        } else if (render_mode_el.value == 'sun'){
            

        }

        let now = performance.now();
        fps_filtered = fps_filt_const * fps_filtered + (1 - fps_filt_const) * (1000 / (now - render_t0));
        // document.getElementById('debug').innerText = (fps_filtered).toFixed(2);
        render_t0 = now;
        // setTimeout(() =>{requestAnimationFrame(loop);}, 1000 / fps);
        requestAnimationFrame(loop);  // unlimited fps
    }
    
    // compile shaders
    data.programs = {};
    Promise.all([
        compile_program('glsl/sim_vs.glsl', 'glsl/sim_fs.glsl').then((program) => {
            let pos_attr_loc = gl.getAttribLocation(program, 'vert_pos');
            gl.enableVertexAttribArray(pos_attr_loc);    
            data.programs.sim = {
                program: program,
                pos_attr_loc: pos_attr_loc
            };
        }),
        compile_program('glsl/render2d_vs.glsl', 'glsl/render2d_fs.glsl').then((program) => {
            let pos_attr_loc = gl.getAttribLocation(program, 'vert_pos');
            gl.enableVertexAttribArray(pos_attr_loc);
            data.programs.render2d = {
                program: program,
                pos_attr_loc: pos_attr_loc
            };
        }),
        compile_program('glsl/arrow_vs.glsl', 'glsl/arrow_fs.glsl').then((program) => {
            let pos_attr_loc = gl.getAttribLocation(program, 'vert_pos');
            gl.enableVertexAttribArray(pos_attr_loc);
            data.programs.arrow = {
                program: program,
                pos_attr_loc: pos_attr_loc
            };
        }),
        compile_program('glsl/render3d_vs.glsl', 'glsl/render2d_fs.glsl').then((program) => {
            let mesh_attr_loc = gl.getAttribLocation(program, 'vert_pos');
            gl.enableVertexAttribArray(mesh_attr_loc);
            data.programs.render3d = {
                program: program,
                pos_attr_loc: mesh_attr_loc
            };
        }),
        compile_program('glsl/water_vs.glsl', 'glsl/water_fs.glsl').then((program) => {
            let pos_attr_loc = gl.getAttribLocation(program, 'vert_pos');
            gl.enableVertexAttribArray(pos_attr_loc);
            data.programs.water = {
                program: program,
                pos_attr_loc: pos_attr_loc
            };
        }),
        compile_program('glsl/cloud_plane_vs.glsl', 'glsl/cloud_plane_fs.glsl').then((program) => {
            let pos_attr_loc = gl.getAttribLocation(program, 'vert_pos');
            gl.enableVertexAttribArray(pos_attr_loc);
            data.programs.cloud_plane = {
                program: program,
                pos_attr_loc: pos_attr_loc
            };
        }),
        compile_program('glsl/sun_vs.glsl', 'glsl/sun_fs.glsl').then((program) => {
            let pos_attr_loc = gl.getAttribLocation(program, 'vert_pos');
            gl.enableVertexAttribArray(pos_attr_loc);
            data.programs.sun = {
                program: program,
                pos_attr_loc: pos_attr_loc
            };
        })
    ]).then(initialize_uniforms).then(() => {

        let sim_res = data.uniforms.sim_res.value[0];  // TODO: update

        // setup buffers
        let vertex_buffer = create_buffer(new Float32Array(screen_mesh[0].flat()), gl.ARRAY_BUFFER, gl.STATIC_DRAW);
        let tri_buffer = create_buffer(new Uint16Array(screen_mesh[1].flat()), gl.ELEMENT_ARRAY_BUFFER, gl.STATIC_DRAW);
        arrows = get_arrows(50);
        let arrow_buffer = create_buffer(new Float32Array(arrows.flat()), gl.ARRAY_BUFFER, gl.STATIC_DRAW);
        grid_mesh = get_grid_mesh(sim_res, sim_res);
        let grid_mesh_buffer = create_buffer(new Float32Array(grid_mesh.flat()), gl.ARRAY_BUFFER, gl.STATIC_DRAW);
        cloud_planes = get_cloud_planes(n_cloud_planes);
        let cloud_planes_buffer = create_buffer(new Float32Array(cloud_planes.flat()), gl.ARRAY_BUFFER, gl.STATIC_DRAW);
        data.buffers = {
            vertex_buffer: vertex_buffer,
            tri_buffer: tri_buffer,
            arrow_buffer: arrow_buffer,
            grid_mesh_buffer: grid_mesh_buffer,
            cloud_planes_buffer: cloud_planes_buffer
        };

        // textures
        let sim_fbo = gl.createFramebuffer();
        let sim_depthbuffer = gl.createRenderbuffer();
        let tex_names = ['low0_t', 'low1_t', 'high0_t', 'high1_t', 'mid_t', 'other_t'];
        let tex_defaults = [
            [0.3, 0, 0, 0],  // low0 wind [0.3, 0.3] 
            [0, 1, 0, 0],    // low1 surface temp 1
            [0.3, 0, 0, 0],  // high0
            [0, 0.5, 0, 0],  // high1
            [0, 1, 0, 0],    // other temp 1
            [0, 0, 0, 0]     // light
        ];
        data.textures = [];
        for (var i = 0; i < tex_names.length; i++){
            data.textures.push({
                'name': tex_names[i],
                'in_tex': create_texture(sim_res, sim_res, tex_defaults[i], i, 'tile'),
                'out_tex': create_texture(sim_res, sim_res, tex_defaults[i], i, 'tile')
            });
            data.uniforms[tex_names[i]] = {
                'type': 'sampler2D',
                'value': i
            };
        }
        for (const program_name in data.programs){
            for (var i = 0; i < data.textures.length; i++){
                // console.log(program_name, data.textures[i].name);
                let loc = gl.getUniformLocation(
                    data.programs[program_name].program,
                    data.textures[i].name
                );
                if (loc != null){
                    data.programs[program_name].uniform_locations[data.textures[i].name] = loc;
                }
            }
        }
        
        // setup fbo
        gl.bindRenderbuffer(gl.RENDERBUFFER, sim_depthbuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, sim_res, sim_res);
        gl.bindFramebuffer(gl.FRAMEBUFFER, sim_fbo);
        gl.drawBuffers([
            gl.COLOR_ATTACHMENT0,
            gl.COLOR_ATTACHMENT1,
            gl.COLOR_ATTACHMENT2,
            gl.COLOR_ATTACHMENT3,
            gl.COLOR_ATTACHMENT4,
            gl.COLOR_ATTACHMENT5,
            // gl.COLOR_ATTACHMENT6,
            // gl.COLOR_ATTACHMENT7,
        ]);
        
        let sun_fbo = gl.createFramebuffer();
        let sun_depthbuffer = gl.createRenderbuffer();
        let sun_tex = create_texture(sim_res, sim_res, [1, 1, 1, 1], 6, 'tile');
        gl.bindRenderbuffer(gl.RENDERBUFFER, sun_depthbuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, sim_res, sim_res);
        gl.bindFramebuffer(gl.FRAMEBUFFER, sun_fbo);
        gl.drawBuffers([
            gl.COLOR_ATTACHMENT0
        ]);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D, sun_tex, 0
        );
        gl.activeTexture(gl.TEXTURE0 + 6);
        gl.bindTexture(gl.TEXTURE_2D, sun_tex);

        data.fbos = {
            sim_fbo: sim_fbo,
            sun_fbo: sun_fbo
        };
        
        requestAnimationFrame(loop);
    });
}